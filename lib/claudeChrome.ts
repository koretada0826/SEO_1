// ─────────────────────────────────────────────────────────────
// Claude in Chrome 連携レイヤー
//   - 規約配慮型の操作プロンプト生成
//   - Claude出力（JSON）のパース → 案件登録フォーム用 Partial<Job> へマッピング
// 大量スクレイピング/高速巡回/CAPTCHA回避は一切想定しない。
// 「ユーザーが通常閲覧できる範囲」を人間確認速度で整理する補助に限定する。
// ─────────────────────────────────────────────────────────────
import type { Job, Platform, Category, AiPolicy, Permission, Continuity } from "./types";
import { scoreJobRule, labelFromScores } from "./scoring";
import { detectCategory } from "./mockAI";

export const MAX_ITEMS = 5;

// ── 検索対象 ──
export type TargetPlatform = "crowdworks" | "lancers" | "both" | "other";
export const TARGET_LABEL: Record<TargetPlatform, string> = {
  crowdworks: "クラウドワークス",
  lancers: "ランサーズ",
  both: "両方",
  other: "その他",
};

// ── 案件タイプ（UI選択用。検索キーワードに展開する） ──
export const JOB_TYPES: { key: string; label: string; keywords: string[] }[] = [
  { key: "seo_outline", label: "SEO構成案", keywords: ["SEO 構成", "記事構成", "見出し 作成"] },
  { key: "rewrite", label: "SEOリライト", keywords: ["SEO リライト", "記事 リライト", "リライト 改善"] },
  { key: "seo_writing", label: "SEO記事作成", keywords: ["SEO記事", "SEO ライティング"] },
  { key: "competitor", label: "競合分析", keywords: ["競合分析", "競合 記事 分析", "上位 分析"] },
  { key: "wordpress", label: "WordPress入稿", keywords: ["WordPress 入稿", "WP 入稿", "入稿 SEO"] },
  { key: "faq", label: "FAQ作成", keywords: ["FAQ 作成", "よくある質問 作成"] },
  { key: "proofreading", label: "記事校正", keywords: ["記事 校正", "SEO 校正", "添削"] },
  { key: "ai_fix", label: "AI記事修正", keywords: ["AI記事 修正", "AI 文章 修正", "AIっぽさ 除去"] },
  { key: "meta_description", label: "メタディスクリプション作成", keywords: ["メタディスクリプション", "ディスクリプション 作成"] },
  { key: "owned_media", label: "オウンドメディア改善", keywords: ["オウンドメディア 改善", "記事 改善"] },
  { key: "content_seo", label: "コンテンツSEO", keywords: ["コンテンツSEO", "SEO 改善 提案"] },
];

export const JOB_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  JOB_TYPES.map((t) => [t.key, t.label])
);

// ── 取得モード ──
export type AcquisitionMode =
  | "current_page"
  | "search_results"
  | "keyword_search"
  | "paste_json"
  | "form_fill"
  | "manual";

export const ACQ_MODE_LABEL: Record<AcquisitionMode, string> = {
  current_page: "現在開いている案件ページから取得",
  search_results: "検索結果ページから候補抽出",
  keyword_search: "指定キーワードで案件検索",
  paste_json: "Claude出力JSONを貼り付け",
  form_fill: "Claudeがフォームに直接入力する",
  manual: "手動入力",
};

// ── 安全設定 ──
export const SAFETY_ITEMS: { key: string; label: string }[] = [
  { key: "no_fast_crawl", label: "高速巡回・大量自動取得をしない" },
  { key: "no_captcha", label: "CAPTCHA・アクセス制限を回避しない" },
  { key: "no_private", label: "ログイン後の非公開情報を保存しない" },
  { key: "no_personal", label: "個人情報を不要に保存しない" },
  { key: "user_confirm", label: "保存前に必ずユーザーが内容を確認する" },
  { key: "max_items", label: `取得件数を最大${MAX_ITEMS}件に制限する` },
  { key: "respect_tos", label: "robots.txt・利用規約・サイト負荷に配慮する" },
];

export interface PromptOptions {
  target: TargetPlatform;
  jobTypeKeys: string[]; // JOB_TYPES の key
  mode: AcquisitionMode;
  maxItems: number;
  keywords?: string; // keyword_search 用の自由入力
}

// 選択された案件タイプから検索キーワード候補を自動生成
export function suggestedKeywords(jobTypeKeys: string[]): string[] {
  const set = new Set<string>();
  for (const k of jobTypeKeys) {
    const t = JOB_TYPES.find((j) => j.key === k);
    t?.keywords.forEach((kw) => set.add(kw));
  }
  return [...set];
}

const SAFETY_BLOCK = `【安全・規約配慮（厳守）】
- 大量自動取得や高速巡回はせず、通常のブラウザ閲覧の範囲で、人間が確認できる速度で進めてください。
- CAPTCHAやアクセス制限の回避はしないでください。
- ログイン後の非公開情報・個人情報は保存しないでください。
- robots.txt・各サービスの利用規約・サイト負荷に配慮してください。
- 候補を開く前後で、ユーザーが内容を確認できるように都度報告してください。
- 保存ボタンは必ずユーザーの確認後に押してください。`;

const JSON_FIELDS_BLOCK = `【抽出する項目】各案件の詳細ページから、以下を読み取って整理してください。
- 案件タイトル / 媒体 / 案件URL / 予算 / 納期 / 募集本文
- 案件タイプ / 求められている納品物 / AI使用可否 / 実績公開可否
- 継続可能性 / 応募人数 / クライアント評価 / クライアント発注実績
- 注意ワード / 地雷度の仮評価 / 自作ツールで処理しやすいか / 応募すべきかの仮判断`;

// Claude in Chrome に貼り付けてもらう出力JSONのテンプレート（1件分）
export const CLAUDE_JSON_TEMPLATE = `{
  "title": "",
  "platform": "クラウドワークス or ランサーズ",
  "url": "",
  "description": "",
  "budgetType": "固定報酬 / 時間単価 / 文字単価 / 不明",
  "budget": "",
  "deadline": "",
  "clientRating": "",
  "clientOrderCount": "",
  "applicantCount": "",
  "category": "SEO構成案 / SEOリライト / 競合分析 / WordPress入稿 / FAQ作成 / メタディスクリプション / 校正 / SEO記事作成 / その他",
  "aiPolicy": "使用可 / 使用不可 / 不明",
  "portfolioPermission": "可 / 不可 / 不明",
  "continuity": "あり / なし / 不明",
  "riskWords": [],
  "requiredDeliverables": [],
  "temporaryScores": {
    "priorityScore": 0,
    "profitabilityScore": 0,
    "portfolioValueScore": 0,
    "toolFitScore": 0,
    "riskScore": 0
  },
  "summary": "",
  "recommendedAction": "今すぐ応募 / 条件次第で応募 / 実績作りなら応募 / 見送り推奨 / 地雷注意"
}`;

function targetSentence(target: TargetPlatform): string {
  switch (target) {
    case "crowdworks":
      return "クラウドワークス（crowdworks.jp）";
    case "lancers":
      return "ランサーズ（lancers.jp）";
    case "both":
      return "クラウドワークス（crowdworks.jp）とランサーズ（lancers.jp）";
    default:
      return "対象のクラウドソーシングサイト";
  }
}

// SEO Scout Workbench「案件スカウト」画面の入力欄ラベル（form_fill 用）。
// Field コンポーネントが各欄に aria-label としてこのラベルを付与している。
export const SCOUT_FIELD_LABELS = [
  "案件タイトル",
  "媒体",
  "案件URL",
  "募集本文",
  "報酬形態",
  "予算（円）",
  "納期",
  "想定文字数",
  "募集人数",
  "応募人数",
  "クライアント評価",
  "クライアント発注実績数",
  "案件タイプ",
  "AI使用可否",
  "実績公開",
  "継続性",
  "メモ",
];

// メインのプロンプト生成：Claude in Chrome がそのまま実行できる手順書を作る
export function generateClaudeChromePrompt(opts: PromptOptions): string {
  const max = Math.min(opts.maxItems || 1, MAX_ITEMS);
  const site = targetSentence(opts.target);
  const typeLabels = opts.jobTypeKeys.map((k) => JOB_TYPE_LABEL[k] ?? k);
  const typeLine = typeLabels.length ? typeLabels.join("、") : "SEO系の案件";
  const kws = opts.keywords?.trim() || suggestedKeywords(opts.jobTypeKeys).join("、");

  const role =
    "あなたは、私（クラウドソーシングで発注を受ける側のSEOディレクター）の案件リサーチを手伝うアシスタントです。" +
    `${site}で、私が応募する価値のあるSEO系案件（${typeLine}）を、通常のブラウザ閲覧の範囲で一緒に探してください。`;

  // モード別の手順
  let steps: string[];
  switch (opts.mode) {
    case "current_page":
      steps = [
        "1. いま私がブラウザで開いている案件詳細ページの内容を読み取ってください。",
        "2. 下記『抽出する項目』に沿って情報を整理してください。",
      ];
      break;
    case "keyword_search":
      steps = [
        `1. ${site}を開いてください。`,
        `2. 次のキーワードで案件を検索してください：${kws}`,
        `3. 検索結果から、応募価値の高そうな案件を最大${max}件まで選んでください。`,
        "4. 候補を開く前に、選んだ候補の一覧（タイトル・媒体・予算）を私に見せて、確認を取ってください。",
        "5. 私がOKした候補だけ、詳細ページを1件ずつ開いて『抽出する項目』を読み取ってください。",
      ];
      break;
    case "form_fill":
      steps = [
        `1. ${site}を開き、${typeLine}に該当する案件を検索してください。`,
        `2. 応募価値の高そうな案件を最大${max}件まで選び、候補一覧を私に見せて確認を取ってください。`,
        "3. 私がOKした候補の詳細ページを1件ずつ開き、『抽出する項目』を読み取ってください。",
        "4. 別タブで SEO Scout Workbench の『案件スカウト』画面（左メニュー →「案件スカウト」）を開いてください。",
        `5. 各案件について、対応するラベルの入力欄に値を記入してください。入力欄のラベル：${SCOUT_FIELD_LABELS.join(" / ")}`,
        "6. ★重要★『この案件を保存』ボタンは押さないでください。私が内容を確認してから自分で押します。1件記入し終えたら一度止めて私に知らせてください。",
      ];
      break;
    case "manual":
      steps = [
        `1. ${site}で${typeLine}の案件を探してください。`,
        `2. 良さそうな案件を最大${max}件まで選んでください。`,
        "3. 各案件について『抽出する項目』を読み取り、私に分かりやすく報告してください。",
      ];
      break;
    case "paste_json":
    case "search_results":
    default:
      steps = [
        `1. ${site}を開いてください。`,
        opts.mode === "search_results"
          ? `2. ${typeLine}を検索結果から探してください（参考キーワード：${kws}）。`
          : `2. いま開いている案件、または ${typeLine} の案件を対象にしてください。`,
        `3. 応募価値の高そうな案件を最大${max}件まで選び、開く前に候補一覧を私に見せて確認を取ってください。`,
        "4. 私がOKした候補の詳細ページを1件ずつ開き、『抽出する項目』を読み取ってください。",
      ];
      break;
  }

  // 出力ブロック
  const output =
    opts.mode === "form_fill"
      ? "【記入後の動作】\n各案件をフォームに記入したら、保存はせずに止めてください。私が確認して保存します。"
      : opts.mode === "manual"
      ? "【出力】\n抽出した内容を、案件ごとに箇条書きで分かりやすくまとめてください。"
      : `【出力形式】\n抽出した案件は、SEO Scout Workbench に貼り付けられるJSON配列（[ ] で囲んだ複数オブジェクト）で出力してください。各要素は次のスキーマに従ってください。値が分からない項目は「不明」または空文字にしてください。\n\n${CLAUDE_JSON_TEMPLATE}`;

  return [
    role,
    "",
    "【手順】",
    steps.join("\n"),
    "",
    JSON_FIELDS_BLOCK,
    "",
    SAFETY_BLOCK,
    "",
    output,
  ].join("\n");
}

// 自動取得オペレーション画面用のエイリアス（同じ生成器を使う）
export const generateAutoAcquisitionPrompt = generateClaudeChromePrompt;

// ─────────────────────────────────────────────────────────────
// パース：Claude出力（JSON文字列）→ Partial<Job>[]
// ─────────────────────────────────────────────────────────────
export interface ParseResult {
  jobs: Partial<Job>[];
  errors: string[];
  raw: number; // 検出した要素数
}

function stripFences(text: string): string {
  // ```json ... ``` や ``` ... ``` のコードフェンスを除去
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  return t;
}

function extractJsonChunks(text: string): string[] {
  const t = stripFences(text);
  // まず全体を JSON として試す
  try {
    JSON.parse(t);
    return [t];
  } catch {
    /* fallthrough */
  }
  // 配列でなければ、トップレベルの {…} を貪欲に拾う
  const chunks: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        chunks.push(t.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return chunks;
}

function toPlatform(s?: string): Platform {
  const v = (s ?? "").toLowerCase();
  if (v.includes("クラウドワークス") || v.includes("crowdworks") || v.includes("cw")) return "crowdworks";
  if (v.includes("ランサーズ") || v.includes("lancers")) return "lancers";
  return "other";
}

function toCategory(s?: string): Category {
  const v = s ?? "";
  const map: [RegExp, Category][] = [
    [/構成/, "seo_outline"],
    [/リライト/, "rewrite"],
    [/競合/, "competitor"],
    [/WordPress|ワードプレス|入稿|WP/i, "wordpress"],
    [/校正|添削|チェック/, "proofreading"],
    [/メタ|ディスクリプ/, "meta_description"],
    [/FAQ|よくある質問/i, "faq"],
    [/記事作成|ライティング|執筆/, "seo_writing"],
  ];
  for (const [re, cat] of map) if (re.test(v)) return cat;
  return v ? "other" : detectCategory(v);
}

function toAiPolicy(s?: string): AiPolicy {
  const v = s ?? "";
  if (/不可|禁止|NG/i.test(v)) return "forbidden";
  if (/可|OK/i.test(v)) return "allowed";
  return "unknown";
}

function toPermission(s?: string): Permission {
  const v = s ?? "";
  if (/不可|不可能|NG|×/i.test(v)) return "forbidden";
  if (/可|OK|○/i.test(v)) return "allowed";
  return "unknown";
}

function toContinuity(s?: string): Continuity {
  const v = s ?? "";
  if (/なし|無し|単発/.test(v)) return "no";
  if (/あり|有り|継続|長期/.test(v)) return "yes";
  return "unknown";
}

function toBudgetType(s?: string): Job["budgetType"] {
  const v = s ?? "";
  if (/文字/.test(v)) return "per_char";
  if (/時間|時給/.test(v)) return "hourly";
  if (/固定/.test(v)) return "fixed";
  return "unknown";
}

function toNumber(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const han = v.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
    const m = han.match(/[0-9]+(?:\.[0-9]+)?/);
    if (m) {
      let n = parseFloat(m[0]);
      if (/万/.test(v)) n *= 10000;
      return n;
    }
  }
  return 0;
}

// 1オブジェクト → Partial<Job>（スコアは再計算してツール側の基準で統一）
export function mapClaudeJsonToJob(obj: Record<string, unknown>): Partial<Job> {
  const budgetType = toBudgetType(obj.budgetType as string);
  const partial: Partial<Job> = {
    title: (obj.title as string) || "無題の案件",
    platform: toPlatform(obj.platform as string),
    url: (obj.url as string) || "",
    description: (obj.description as string) || (obj.summary as string) || "",
    budgetType,
    budget: toNumber(obj.budget),
    deadline: (obj.deadline as string) || "",
    clientRating: obj.clientRating != null && obj.clientRating !== "" ? toNumber(obj.clientRating) : undefined,
    clientOrderCount:
      obj.clientOrderCount != null && obj.clientOrderCount !== "" ? toNumber(obj.clientOrderCount) : undefined,
    applicantCount:
      obj.applicantCount != null && obj.applicantCount !== "" ? toNumber(obj.applicantCount) : undefined,
    category: toCategory((obj.category as string) || (obj.title as string)),
    aiPolicy: toAiPolicy(obj.aiPolicy as string),
    portfolioPermission: toPermission(obj.portfolioPermission as string),
    continuity: toContinuity(obj.continuity as string),
    notes: (obj.summary as string) || "",
  };
  // Claude の仮summaryをメモに、riskWordsがあれば本文に補足
  const riskWords = Array.isArray(obj.riskWords) ? (obj.riskWords as unknown[]).filter(Boolean) : [];
  if (riskWords.length) {
    partial.notes = `${partial.notes ? partial.notes + "\n" : ""}Claude検出の注意ワード: ${riskWords.join(", ")}`;
  }
  // ツール側基準でスコア再計算
  partial.scores = scoreJobRule(partial);
  return partial;
}

export function parseClaudeChromeOutput(text: string): ParseResult {
  const errors: string[] = [];
  if (!text.trim()) return { jobs: [], errors: ["入力が空です"], raw: 0 };

  const chunks = extractJsonChunks(text);
  if (!chunks.length) {
    return { jobs: [], errors: ["JSONを検出できませんでした。{} または [] を含む有効なJSONを貼り付けてください。"], raw: 0 };
  }

  const objects: Record<string, unknown>[] = [];
  for (const chunk of chunks) {
    try {
      const parsed = JSON.parse(chunk);
      if (Array.isArray(parsed)) {
        for (const p of parsed) if (p && typeof p === "object") objects.push(p as Record<string, unknown>);
      } else if (parsed && typeof parsed === "object") {
        objects.push(parsed as Record<string, unknown>);
      }
    } catch {
      errors.push("一部のJSONを解析できませんでした（構文エラー）。");
    }
  }

  if (!objects.length) {
    return { jobs: [], errors: errors.length ? errors : ["有効な案件オブジェクトが見つかりませんでした。"], raw: 0 };
  }

  // 安全上の上限：最大 MAX_ITEMS 件まで
  const limited = objects.slice(0, MAX_ITEMS);
  if (objects.length > MAX_ITEMS) {
    errors.push(`安全のため、検出した${objects.length}件のうち先頭${MAX_ITEMS}件のみ取り込みました。`);
  }

  const jobs = limited.map(mapClaudeJsonToJob);
  return { jobs, errors, raw: objects.length };
}

// 仮判定ラベル（プレビュー用）
export function previewLabel(job: Partial<Job>) {
  return labelFromScores(job.scores ?? scoreJobRule(job)).label;
}
