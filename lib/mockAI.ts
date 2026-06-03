// ─────────────────────────────────────────────────────────────
// Mock AI Engine — ルールベース実装。後で Claude / OpenAI API に差し替え可能。
// すべての関数は同期 or Promise を返し、外部APIには一切接続しない（課金ゼロ）。
// 差し替え時は各関数本体を fetch('/api/ai/...') 等へ置換するだけで良い設計。
// ─────────────────────────────────────────────────────────────
import type {
  Job,
  JobAnalysis,
  Category,
  AiPolicy,
  Proposal,
  OutlineNode,
  TitleIdea,
  MetaIdea,
  FaqItem,
  GeoSuggestion,
  CompetitorAnalysis,
  RewriteDiagnosis,
  Scores,
} from "./types";
import { detectRiskWordsRule } from "./riskWords";
import { scoreJobRule, labelFromScores } from "./scoring";

const uid = (p = "id") =>
  `${p}_${Math.abs(hashStr(p + globalThis.crypto?.randomUUID?.() ?? "")).toString(36)}`;
function hashStr(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
const nowIso = () => new Date().toISOString();

// ── カテゴリ推定 ──
export function detectCategory(text: string): Category {
  const t = text;
  const tests: [Category, RegExp][] = [
    ["seo_outline", /(構成案|見出し構成|アウトライン|h2.*h3|骨子)/],
    ["rewrite", /(リライト|リライ|改稿|改善|順位.*改善|既存記事)/],
    ["competitor", /(競合分析|競合記事|競合調査|上位.*分析)/],
    ["wordpress", /(WordPress|ワードプレス|入稿|WP)/],
    ["proofreading", /(校正|校閲|添削|チェック|誤字)/],
    ["meta_description", /(メタディスクリプション|meta description|ディスクリプション)/],
    ["faq", /(FAQ|よくある質問|Q&A|質問.*回答)/],
    ["seo_writing", /(SEO記事|記事作成|ライティング|執筆)/],
  ];
  for (const [cat, re] of tests) if (re.test(t)) return cat;
  return "other";
}

const CAT_LABEL: Record<Category, string> = {
  seo_outline: "SEO構成案",
  seo_writing: "SEO記事作成",
  rewrite: "SEOリライト",
  competitor: "競合分析",
  wordpress: "WordPress入稿",
  proofreading: "校正",
  meta_description: "メタディスクリプション",
  faq: "FAQ作成",
  other: "その他",
};
export const categoryLabel = (c: Category) => CAT_LABEL[c] ?? "その他";

// ── parseJobText: 募集本文から項目を推定 ──
export interface ParsedJob {
  title?: string;
  category: Category;
  budgetType: Job["budgetType"];
  budget: number;
  deadline?: string;
  aiPolicy: AiPolicy;
  recruitCount?: number;
  applicantCount?: number;
  notes?: string;
}
export function parseJobText(text: string): ParsedJob {
  const out: ParsedJob = {
    category: detectCategory(text),
    budgetType: "unknown",
    budget: 0,
    aiPolicy: "unknown",
  };
  // 予算抽出
  const yen = text.match(/([0-9０-９,]+)\s*(?:円|万円)/);
  if (yen) {
    let v = parseInt(zenToHan(yen[1]).replace(/,/g, ""), 10);
    if (yen[0].includes("万")) v *= 10000;
    out.budget = v;
    out.budgetType = "fixed";
  }
  // 文字単価
  const perChar = text.match(/(?:文字単価|1文字|一文字)\s*([0-9０-９.]+)\s*円/);
  if (perChar) {
    out.budget = parseFloat(zenToHan(perChar[1]));
    out.budgetType = "per_char";
  }
  // 時間単価
  if (/時給|時間単価/.test(text)) out.budgetType = "hourly";
  // 納期
  const dl = text.match(/(?:納期|締切|締め切り|期限)[：:\s]*([0-9０-９]{1,4}[\/年.\-][0-9０-９]{1,2}(?:[\/月.\-][0-9０-９]{1,2})?日?)/);
  if (dl) out.deadline = zenToHan(dl[1]);
  // 募集人数
  const rc = text.match(/募集人数[：:\s]*([0-9０-９]+)/);
  if (rc) out.recruitCount = parseInt(zenToHan(rc[1]), 10);
  const ac = text.match(/応募(?:人数|者数)[：:\s]*([0-9０-９]+)/);
  if (ac) out.applicantCount = parseInt(zenToHan(ac[1]), 10);
  // AI可否
  if (/(AI使用可|AI可|ChatGPT可|生成AI.*可)/.test(text)) out.aiPolicy = "allowed";
  if (/(AI禁止|AI使用禁止|ChatGPT禁止|生成AI.*禁止|AI.*不可)/.test(text)) out.aiPolicy = "forbidden";
  // タイトル（1行目）
  const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l.length > 4);
  if (firstLine) out.title = firstLine.slice(0, 60);
  return out;
}
function zenToHan(s: string) {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

// ── analyzeJob: 案件を総合解析 ──
export function analyzeJob(job: Partial<Job>): JobAnalysis {
  const text = `${job.title ?? ""}\n${job.description ?? ""}`;
  const cat = job.category ?? detectCategory(text);
  const riskHits = detectRiskWordsRule(text);
  const scores = scoreJobRule({ ...job, category: cat });
  const { label } = labelFromScores(scores);

  const deliverables = deliverablesFor(cat);
  const reasonsApply: string[] = [];
  const reasonsAvoid: string[] = [];
  const cautions: string[] = [];
  const proposalEmphasis: string[] = [];

  if (["seo_outline", "rewrite", "competitor", "faq"].includes(cat)) {
    reasonsApply.push(`${CAT_LABEL[cat]}は自作ツールで高速化でき、検索意図と競合差分を整理して差別化しやすい`);
    proposalEmphasis.push("検索意図の言語化と競合差分の可視化");
  }
  if (job.continuity === "yes") reasonsApply.push("継続可能性があり、安定収益・関係構築につながる");
  if (job.portfolioPermission === "allowed") {
    reasonsApply.push("実績公開が可能で、ポートフォリオ価値が高い");
    proposalEmphasis.push("納品物をそのまま実績として提示できる品質で出す");
  }
  if (scores.profitability >= 60) reasonsApply.push("報酬水準が作業量に見合っており収益性が高い");

  for (const r of riskHits) {
    if (r.severity === "high") reasonsAvoid.push(`地雷ワード「${r.word}」: ${r.reason}`);
    else cautions.push(`「${r.word}」: ${r.reason}`);
  }
  if (scores.risk >= 60) reasonsAvoid.push("総合的に地雷度が高く、時給が崩れるリスクがある");
  if ((job.budget ?? 0) > 0 && (job.budget ?? 0) < 5000)
    reasonsAvoid.push("予算が低く、作業量に見合わない可能性が高い");

  cautions.push("修正回数・修正範囲を契約前に明文化する");
  proposalEmphasis.push("修正回数を明示し、無限修正を回避する一文を入れる");

  const aiPolicyNote =
    job.aiPolicy === "forbidden"
      ? "AI使用不可。提案文・納品方針では『AIで作る』と書かず、独自のSEOチェックリスト/競合分析テンプレ/手作業での検索意図整理を前面に出す。"
      : job.aiPolicy === "allowed"
      ? "AI使用可。効率化ツールの活用を自然にアピールしてよい（ただし品質の担保責任は自分にあると明記）。"
      : "AI可否の明記なし。提案文では『独自ツールで効率化しつつ最終品質は自分で確認』という中立表現が安全。";

  const time = estimateTime(cat, job);

  return {
    detectedType: cat,
    deliverables,
    label,
    reasonsApply: reasonsApply.length ? reasonsApply : ["大きな加点要素は見当たらないが、条件次第では応募可"],
    reasonsAvoid,
    cautions,
    proposalEmphasis,
    time,
    aiPolicyNote,
    riskHits,
    analyzedAt: nowIso(),
  };
}

function deliverablesFor(cat: Category): string[] {
  const base: Record<Category, string[]> = {
    seo_outline: ["検索意図整理", "h2/h3構成案", "各見出しの執筆方針", "タイトル案", "メタディスクリプション", "FAQ案", "GEO対応ポイント"],
    seo_writing: ["構成案", "本文", "タイトル案", "メタディスクリプション", "内部リンク案", "FAQ"],
    rewrite: ["現状診断", "リライト指示書", "改善後構成案", "不足情報リスト", "タイトル/導入文改善", "FAQ追加案"],
    competitor: ["競合比較表", "共通見出し抽出", "不足トピック", "独自切り口", "FAQ差分", "E-E-A-T補強ポイント"],
    wordpress: ["入稿前SEOチェックリスト", "タイトル/メタ確認", "見出しタグ構造確認", "内部リンク案", "画像alt/altテキスト確認"],
    proofreading: ["誤字脱字チェック", "表記ゆれ統一", "読みやすさ改善", "SEO観点の見出し確認"],
    meta_description: ["メタディスクリプション複数案", "検索意図一致確認", "CTR最適化"],
    faq: ["読者検索質問の抽出", "記事内FAQ案", "GEO/AI検索向けFAQ", "短文回答ブロック"],
    other: ["要件整理", "SEO観点の改善提案"],
  };
  return base[cat] ?? base.other;
}

function estimateTime(cat: Category, job: Partial<Job>) {
  const baseHours: Record<Category, number> = {
    seo_outline: 2.5,
    seo_writing: 6,
    rewrite: 3.5,
    competitor: 3,
    wordpress: 2,
    proofreading: 2,
    meta_description: 1,
    faq: 1.5,
    other: 3,
  };
  const normal = baseHours[cat] ?? 3;
  const min = +(normal * 0.6).toFixed(1);
  const withRev = +(normal * 1.5).toFixed(1);
  const budget = job.budget ?? 0;
  const effBudget = job.budgetType === "per_char" ? budget * (job.charCount ?? 3000) : budget;
  const hourlyRate = withRev > 0 ? Math.round(effBudget / withRev) : 0;
  const toolSaved = +(normal * 0.4).toFixed(1);
  return {
    minHours: min,
    normalHours: normal,
    withRevisionHours: withRev,
    hourlyRate,
    toolSavedHours: toolSaved,
  };
}

// scoreJob 再エクスポート（指定インターフェース）
export function scoreJob(job: Partial<Job>): Scores {
  return scoreJobRule(job);
}
export { detectRiskWordsRule as detectRiskWords };

// ───────────────────── 提案文生成 ─────────────────────
export const PROPOSAL_TYPES = [
  "短め提案文",
  "丁寧め提案文",
  "実績不足カバー型",
  "自作ツールアピール型",
  "AI使用不可案件向け",
  "継続案件向け",
  "低単価・実績作り向け",
  "SEOリライト案件向け",
  "SEO構成案案件向け",
  "競合分析案件向け",
] as const;

export function generateProposal(opts: {
  job: Partial<Job>;
  type: string;
  tone?: string;
  aiPolicyMode?: AiPolicy;
}): Proposal {
  const { job, type } = opts;
  const aiMode = opts.aiPolicyMode ?? job.aiPolicy ?? "unknown";
  const cat = job.category ?? "other";
  const catLabel = CAT_LABEL[cat as Category] ?? "SEO";
  const toolLine =
    aiMode === "forbidden"
      ? "独自のSEOチェックリストと競合分析テンプレートを用いて、検索意図・見出し構成・不足情報を一つひとつ丁寧に整理します。"
      : "SEO構成案・競合分析・FAQ抽出・リライト改善点の整理を効率化する自作ツールを使用しており、検索意図と競合差分を整理したうえで納品いたします（最終的な品質確認は私自身が責任を持って行います）。";

  const greeting = "はじめまして。ご募集を拝見し、ぜひお力になりたくご連絡いたしました。";
  const readLine = `「${(job.title ?? catLabel).slice(0, 40)}」について、${catLabel}の経験を活かしてお役に立てると考えております。`;
  const pointLine =
    cat === "rewrite"
      ? "本案件では、既存記事の検索意図とのズレ・不足情報・冗長表現を洗い出し、順位とCVの両面で改善することが重要だと感じました。"
      : cat === "competitor"
      ? "上位競合の共通見出しと差分を構造的に整理し、貴社が独自性を出せる切り口まで提案することが成果に直結すると考えております。"
      : cat === "seo_outline"
      ? "読者の検索意図を顕在・潜在まで分解し、h2/h3レベルで『どの見出しで何を満たすか』まで設計することを重視します。"
      : "検索意図を起点に、競合に不足している情報を補い、読了後の行動まで設計することを重視します。";

  const deliverLine = `納品物の例：${deliverablesFor(cat as Category).slice(0, 5).join(" / ")}`;
  const revisionLine = "修正は2回まで無償で対応し、追加分は事前にご相談のうえ進めます（認識のズレを防ぐためです）。";
  const geoLine =
    "ご希望があれば、通常のSEO構成に加えて、AI検索（GEO/LLMO）にも拾われやすい結論ファースト・FAQ・短文回答ブロックの設計も付加価値としてご提案できます。";
  const closing = "まずは方向性のすり合わせから丁寧に進めさせていただければ幸いです。何卒よろしくお願いいたします。";

  let parts: string[] = [];
  switch (type) {
    case "短め提案文":
      parts = [greeting, readLine, pointLine, deliverLine, "まずは構成案からご相談可能です。よろしくお願いいたします。"];
      break;
    case "実績不足カバー型":
      parts = [
        greeting,
        readLine,
        "実績数はこれから積み上げる段階ですが、" + pointLine,
        toolLine,
        deliverLine,
        revisionLine,
        closing,
      ];
      break;
    case "自作ツールアピール型":
      parts = [greeting, readLine, pointLine, toolLine, deliverLine, geoLine, revisionLine, closing];
      break;
    case "AI使用不可案件向け":
      parts = [
        greeting,
        readLine,
        pointLine,
        "独自のSEOチェックリストと競合分析テンプレートを用い、検索意図・見出し構成・不足情報を手作業で丁寧に整理いたします。",
        deliverLine,
        revisionLine,
        closing,
      ];
      break;
    case "継続案件向け":
      parts = [
        greeting,
        readLine,
        pointLine,
        "単発ではなく、記事群全体のSEO設計として継続的に伴走できればと考えております。",
        toolLine,
        deliverLine,
        revisionLine,
        closing,
      ];
      break;
    case "低単価・実績作り向け":
      parts = [
        greeting,
        readLine,
        pointLine,
        "今回は実績を重視し、価格以上の価値を出すつもりで取り組ませていただきます。",
        deliverLine,
        revisionLine,
        closing,
      ];
      break;
    case "SEOリライト案件向け":
      parts = [greeting, readLine, "既存記事の検索意図とのズレ・不足情報・古い情報・冗長表現を洗い出し、改善後の構成案まで提示します。", toolLine, deliverLine, geoLine, revisionLine, closing];
      break;
    case "SEO構成案案件向け":
      parts = [greeting, readLine, "検索意図を顕在・潜在に分解し、h2/h3まで『何を満たす見出しか』を明示した構成案を作成します。タイトル案・メタ・FAQまで一括で納品可能です。", toolLine, deliverLine, geoLine, revisionLine, closing];
      break;
    case "競合分析案件向け":
      parts = [greeting, readLine, "上位競合の共通見出し・差分・FAQギャップを比較表で可視化し、貴社が勝てる独自切り口まで提案します。", toolLine, deliverLine, revisionLine, closing];
      break;
    case "丁寧め提案文":
    default:
      parts = [greeting, readLine, pointLine, toolLine, deliverLine, revisionLine, aiMode !== "forbidden" ? geoLine : "", closing].filter(Boolean);
      break;
  }

  return {
    id: uid("prop"),
    jobId: job.id ?? "",
    type,
    content: parts.join("\n\n"),
    tone: opts.tone ?? "丁寧",
    aiPolicyMode: aiMode,
    createdAt: nowIso(),
  };
}

// ───────────────────── SEO構成案 ─────────────────────
export function generateSeoOutline(input: {
  keyword: string;
  theme?: string;
  targetReader?: string;
  charCount?: number;
}): OutlineNode[] {
  const kw = input.keyword || "対象キーワード";
  const total = input.charCount && input.charCount > 0 ? input.charCount : 6000;
  const nodes: OutlineNode[] = [
    { level: "h1", text: `${kw}とは？${input.theme ? `${input.theme}を` : ""}初心者にもわかりやすく解説`, role: "記事タイトル/全体テーマ提示", content: `${kw}の結論を冒頭で提示し、誰向けの記事かを明示`, charBudget: 0 },
    { level: "h2", text: "結論：まず押さえるべきポイント", role: "結論ファースト（GEO対応）", content: `${kw}の要点を3行で先に提示。AI検索にも引用されやすい短文回答を置く`, charBudget: Math.round(total * 0.12) },
    { level: "h2", text: `${kw}の基礎知識`, role: "前提・定義", content: "用語定義と全体像。検索初心者の顕在ニーズを満たす", charBudget: Math.round(total * 0.18) },
    { level: "h3", text: `${kw}の意味と背景`, role: "定義", content: "1〜2文の明確な定義を冒頭に置く", charBudget: Math.round(total * 0.08) },
    { level: "h2", text: `${kw}の選び方・進め方`, role: "意思決定支援", content: "比較軸を提示し、読者が判断できる情報を整理（比較表推奨）", charBudget: Math.round(total * 0.22) },
    { level: "h3", text: "比較のポイント", role: "比較表", content: "3〜5項目の比較表で潜在ニーズに対応", charBudget: Math.round(total * 0.1) },
    { level: "h2", text: "よくある失敗と注意点", role: "潜在不安の解消", content: "読者の不安・失敗パターンを先回りして解消", charBudget: Math.round(total * 0.14) },
    { level: "h2", text: "よくある質問（FAQ）", role: "FAQ/GEO対応", content: "検索されやすい質問に短文で直接回答（AI引用を狙う）", charBudget: Math.round(total * 0.12) },
    { level: "h2", text: "まとめと次のアクション", role: "CTA設計", content: "要点再掲＋読者に取ってほしい行動（CTA）を明示", charBudget: Math.round(total * 0.1) },
  ];
  return nodes;
}

// ───────────────────── タイトル ─────────────────────
export function generateTitles(keyword: string): TitleIdea[] {
  const kw = keyword || "キーワード";
  return [
    { kind: "SEO重視", text: `${kw}とは？意味・選び方・注意点を徹底解説【2026年版】` },
    { kind: "SEO重視", text: `${kw}の基礎から実践まで｜初心者が失敗しないための完全ガイド` },
    { kind: "CTR重視", text: `知らないと損する${kw}の選び方｜プロが教える5つのポイント` },
    { kind: "CTR重視", text: `【保存版】${kw}で迷わないためのチェックリスト` },
    { kind: "初心者向け", text: `はじめての${kw}｜何から始める？やさしく手順を解説` },
    { kind: "初心者向け", text: `${kw}を一から学ぶ｜専門用語ゼロでわかる入門ガイド` },
    { kind: "比較検討", text: `${kw}おすすめ比較｜目的別の選び方と失敗しない基準` },
    { kind: "比較検討", text: `${kw}を徹底比較｜料金・特徴・向いている人をまとめて解説` },
    { kind: "GEO対応", text: `${kw}とは？よくある質問にまとめて回答【FAQ付き】` },
    { kind: "GEO対応", text: `${kw}の結論を先に｜要点・手順・注意点を1記事で完結` },
  ];
}

// ───────────────────── メタディスクリプション ─────────────────────
export function generateMetaDescriptions(keyword: string): MetaIdea[] {
  const kw = keyword || "キーワード";
  return [
    { kind: "検索意図一致", text: `${kw}について、意味・選び方・注意点を初心者にもわかりやすく解説。比較表とFAQで「結局どれを選べばいいか」まで判断できる完全ガイドです。` },
    { kind: "CTR重視", text: `${kw}で失敗したくない方へ。プロが押さえる選び方の基準と、よくある失敗を先回りで解説。読めば次の一歩がはっきり決まります。` },
    { kind: "網羅性訴求", text: `${kw}の基礎から実践、比較、FAQまでこの1記事で完結。検索意図に沿って必要な情報だけを整理したので、迷わず判断・行動できます。` },
  ];
}

// ───────────────────── FAQ ─────────────────────
export function generateFaqs(keyword: string): FaqItem[] {
  const kw = keyword || "キーワード";
  return [
    { q: `${kw}とは何ですか？`, a: `${kw}とは、〇〇のための手段・考え方を指します。要点は3つで、目的・方法・注意点に分けて理解すると整理しやすいです。`, geoFriendly: true },
    { q: `${kw}は初心者でもできますか？`, a: `はい、基本の手順を押さえれば初心者でも始められます。まずは小さく試し、結果を見ながら調整するのがおすすめです。`, geoFriendly: true },
    { q: `${kw}の費用はどのくらいかかりますか？`, a: `目的や規模によりますが、無料〜数万円が目安です。費用対効果で判断するのが失敗しないコツです。`, geoFriendly: true },
    { q: `${kw}でよくある失敗は何ですか？`, a: `目的が曖昧なまま始めること、比較せず決めること、効果測定をしないことが代表的な失敗です。`, geoFriendly: true },
    { q: `${kw}を選ぶときの基準は？`, a: `目的との一致・コスト・継続のしやすさの3軸で比較すると判断しやすくなります。`, geoFriendly: true },
    { q: `${kw}の効果が出るまでどのくらい？`, a: `一般的には数週間〜数ヶ月が目安です。短期で判断せず、継続して改善することが重要です。`, geoFriendly: true },
    { q: `${kw}は何から始めればいいですか？`, a: `まず目的を1つに絞り、現状を把握してから小さく試すのが最短ルートです。`, geoFriendly: true },
    { q: `${kw}に資格や専門知識は必要ですか？`, a: `必須ではありません。基礎を理解すれば実践でき、必要に応じて専門家に相談する形で十分です。`, geoFriendly: false },
    { q: `${kw}と〇〇の違いは何ですか？`, a: `目的と適用範囲が異なります。${kw}は△△に強く、〇〇は□□に向いています。`, geoFriendly: true },
    { q: `${kw}を続けるコツはありますか？`, a: `小さな目標設定と定期的な振り返りが続けるコツです。記録して可視化すると継続しやすくなります。`, geoFriendly: false },
  ];
}

// ───────────────────── GEO提案 ─────────────────────
export const GEO_CHECK_AREAS = [
  "記事冒頭に結論があるか",
  "h2直下に短い回答ブロックがあるか",
  "FAQ形式の質問があるか",
  "比較表があるか",
  "手順が明確か",
  "定義が明確か",
  "注意点があるか",
  "具体例があるか",
  "読者の意思決定に必要な情報があるか",
  "著者情報/監修者情報を入れられるか",
  "体験談/一次情報を入れられるか",
  "E-E-A-Tを補強できるか",
  "AIが引用しやすい短文回答があるか",
  "検索意図に直接回答しているか",
];

export function generateGeoSuggestions(checked: Record<string, boolean>): GeoSuggestion[] {
  return GEO_CHECK_AREAS.map((area) => {
    const present = !!checked[area];
    return {
      area,
      present,
      suggestion: present ? "対応済み。引用されやすい表現に磨き込む" : geoFix(area),
    };
  });
}
function geoFix(area: string): string {
  const map: Record<string, string> = {
    "記事冒頭に結論があるか": "冒頭100字以内に結論を1文で提示する",
    "h2直下に短い回答ブロックがあるか": "各h2直下に40〜100字の要約回答を置く",
    "FAQ形式の質問があるか": "読者の検索質問をそのままFAQ化して直接回答する",
    "比較表があるか": "選択肢を3〜5項目で比較する表を追加する",
    "手順が明確か": "番号付きの手順リストに分解する",
    "定義が明確か": "用語の定義を1〜2文で冒頭に置く",
    "注意点があるか": "失敗例・注意点のセクションを追加する",
    "具体例があるか": "具体的なケース・数値例を追加する",
    "読者の意思決定に必要な情報があるか": "判断軸（コスト/効果/難易度）を明示する",
    "著者情報/監修者情報を入れられるか": "著者プロフィール・監修者表記を追加する",
    "体験談/一次情報を入れられるか": "一次情報・実体験・独自データを加える",
    "E-E-A-Tを補強できるか": "出典・専門家コメント・実績で信頼性を補強する",
    "AIが引用しやすい短文回答があるか": "各見出しに引用されやすい40〜100字の短文を用意する",
    "検索意図に直接回答しているか": "回りくどい前置きを削り、質問に直接答える構成にする",
  };
  return map[area] ?? "AI検索向けに構造化・短文化する";
}

export function geoScore(checked: Record<string, boolean>): number {
  const total = GEO_CHECK_AREAS.length;
  const yes = GEO_CHECK_AREAS.filter((a) => checked[a]).length;
  return Math.round((yes / total) * 100);
}

// ───────────────────── 競合分析 ─────────────────────
export function analyzeCompetitors(input: {
  keyword: string;
  competitorUrls: string[];
}): CompetitorAnalysis {
  const kw = input.keyword || "キーワード";
  const urls = input.competitorUrls.filter(Boolean);
  return {
    id: uid("comp"),
    competitorUrls: urls,
    commonHeadings: [`${kw}とは`, `${kw}の選び方`, `${kw}のメリット・デメリット`, `${kw}の費用`, "よくある質問"],
    missingTopics: ["最新の事例・データ", "失敗回避の具体的チェックリスト", "目的別の比較表", "一次情報/体験談"],
    uniqueAngles: ["実務での使い方を手順化", "他社が触れていない注意点を深掘り", "GEO対応のFAQ・短文回答で差別化"],
    faqGaps: [`${kw}は初心者でもできる？`, `${kw}の費用相場は？`, `${kw}でよくある失敗は？`],
    suggestedSections: [
      { title: "目的別の比較表", priority: "A", why: "競合が網羅できておらず意思決定に直結する" },
      { title: "失敗回避チェックリスト", priority: "A", why: "独自性が出せて保存・被リンクされやすい" },
      { title: "FAQ（GEO対応）", priority: "B", why: "AI検索に拾われやすく付加価値になる" },
      { title: "一次情報・体験談", priority: "B", why: "E-E-A-T補強につながる" },
    ],
    comparisonTable: ["料金", "対象者", "メリット", "デメリット", "向いている人"],
    eeatPoints: ["著者/監修者の明示", "出典・データの提示", "実体験・独自事例", "更新日の明記"],
  };
}

// ───────────────────── リライト診断 ─────────────────────
export function diagnoseRewrite(input: {
  keyword: string;
  body?: string;
  goal?: string;
}): RewriteDiagnosis {
  const kw = input.keyword || "キーワード";
  const body = input.body ?? "";
  const len = body.length;
  let current = 50;
  if (len > 3000) current += 10;
  if (/結論|まとめ/.test(body)) current += 8;
  if (/よくある質問|FAQ/.test(body)) current += 8;
  if (!/結論/.test(body)) current -= 6;
  current = Math.max(20, Math.min(85, current));

  const aiLike = /いかがでしたか|まとめると|それでは|ぜひ参考にして|本記事では/.test(body)
    ? ["「いかがでしたか」など定型の締め", "「本記事では」の多用", "抽象的で具体性のない一般論"]
    : ["AIっぽい定型表現は目立たないが、具体例と一次情報で人間味を補強する余地あり"];

  return {
    currentScore: current,
    titleFix: `「${kw}」を前半に置き、ベネフィット＋数字＋年号を加えてCTRを改善する`,
    leadFix: "冒頭100字で結論を提示し、誰向け・何が得られるかを明示する",
    headingFixes: ["検索意図に対応していない見出しを統合・再配置", "h2直下に短い回答ブロックを追加", "比較・手順のセクションを見出し化"],
    missingInfo: ["目的別の比較表", "費用相場の具体的な数値", "失敗回避のチェックリスト", "FAQ"],
    outdated: len > 0 ? ["年号・統計・サービス情報が古い可能性 → 最新に更新", "リンク切れの確認"] : ["本文未入力のため判定不可"],
    hardToRead: ["一文が長い箇所を分割", "専門用語に補足を追加", "箇条書き・表で視認性を上げる"],
    redundant: ["前置き・自己紹介の冗長部分を削除", "同じ内容の繰り返しを統合"],
    aiLikePhrases: aiLike,
    expertiseGaps: ["一次情報/独自データの追加", "著者・監修者情報の明示", "出典の提示"],
    ctaFix: "記事末に読者の次の行動（資料請求/比較/問い合わせ）を1つに絞って提示する",
    faqAdds: [`${kw}は初心者でもできる？`, `${kw}の費用は？`, `${kw}でよくある失敗は？`],
    newOutline: generateSeoOutline({ keyword: kw }),
    priorities: [
      { item: "結論ファーストの導入＋短文回答ブロック", priority: "A" },
      { item: "比較表・FAQの追加", priority: "A" },
      { item: "タイトル・メタの改善", priority: "B" },
      { item: "冗長表現・AIっぽさの除去", priority: "B" },
      { item: "著者情報・出典でE-E-A-T補強", priority: "C" },
    ],
  };
}

// ───────────────────── レポート整形 ─────────────────────
export function generateDeliveryReport(d: {
  jobTitle?: string;
  clientName?: string;
  keyword: string;
  purpose?: string;
  outline?: OutlineNode[];
  titles?: TitleIdea[];
  metaDescriptions?: MetaIdea[];
  faqs?: FaqItem[];
  geoSuggestions?: GeoSuggestion[];
}): string {
  return formatForMarkdown(d);
}

export function formatForMarkdown(d: {
  jobTitle?: string;
  clientName?: string;
  keyword: string;
  purpose?: string;
  outline?: OutlineNode[];
  titles?: TitleIdea[];
  metaDescriptions?: MetaIdea[];
  faqs?: FaqItem[];
  geoSuggestions?: GeoSuggestion[];
  competitorAnalysis?: CompetitorAnalysis;
  rewrite?: RewriteDiagnosis;
}): string {
  const L: string[] = [];
  L.push(`# SEO納品レポート：${d.jobTitle ?? d.keyword}`);
  if (d.clientName) L.push(`**クライアント**: ${d.clientName}`);
  L.push(`**対策キーワード**: ${d.keyword}`);
  if (d.purpose) L.push(`**記事の目的**: ${d.purpose}`);
  L.push("");
  if (d.titles?.length) {
    L.push("## タイトル案");
    d.titles.forEach((t, i) => L.push(`${i + 1}. （${t.kind}）${t.text}`));
    L.push("");
  }
  if (d.metaDescriptions?.length) {
    L.push("## メタディスクリプション案");
    d.metaDescriptions.forEach((m, i) => L.push(`${i + 1}. （${m.kind}）${m.text}`));
    L.push("");
  }
  if (d.outline?.length) {
    L.push("## SEO構成案");
    for (const n of d.outline) {
      const prefix = n.level === "h1" ? "# " : n.level === "h2" ? "## " : "### ";
      L.push(`${prefix}${n.text}`);
      L.push(`- 役割: ${n.role}`);
      L.push(`- 内容: ${n.content}`);
      if (n.charBudget) L.push(`- 想定文字数: 約${n.charBudget}字`);
    }
    L.push("");
  }
  if (d.faqs?.length) {
    L.push("## FAQ案");
    d.faqs.forEach((f) => {
      L.push(`**Q. ${f.q}**`);
      L.push(`A. ${f.a}${f.geoFriendly ? " _(GEO/AI検索向け短文回答)_" : ""}`);
      L.push("");
    });
  }
  if (d.competitorAnalysis) {
    const c = d.competitorAnalysis;
    L.push("## 競合との差分");
    L.push(`- 共通見出し: ${c.commonHeadings.join(" / ")}`);
    L.push(`- 不足トピック: ${c.missingTopics.join(" / ")}`);
    L.push(`- 独自切り口: ${c.uniqueAngles.join(" / ")}`);
    L.push("");
  }
  if (d.geoSuggestions?.length) {
    L.push("## GEO/AI検索対応ポイント");
    d.geoSuggestions.filter((g) => !g.present).forEach((g) => L.push(`- [ ] ${g.area} → ${g.suggestion}`));
    L.push("");
  }
  L.push("## 次にやるべきこと");
  L.push("1. 結論ファースト＋短文回答ブロックの実装（優先度A）");
  L.push("2. 比較表・FAQの追加（優先度A）");
  L.push("3. タイトル・メタの差し替え（優先度B）");
  L.push("");
  L.push("---");
  L.push("_SEO Scout Workbench により作成（SEO構成 + GEO/AI検索対応）_");
  return L.join("\n");
}

export function formatForGoogleDocs(md: string): string {
  // Google Docs 貼り付け用：Markdown記号を控えめにしたプレーン寄り整形（モック）
  return md
    .replace(/^# (.*)$/gm, "$1\n========================")
    .replace(/^## (.*)$/gm, "\n■ $1")
    .replace(/^### (.*)$/gm, "  ・$1")
    .replace(/\*\*(.*?)\*\*/g, "$1");
}

export function formatForPdf(md: string): string {
  // PDF出力用テキスト（モック）。実装時は Google Docs → PDF エクスポートに差し替え。
  return `【PDF出力プレビュー】\n\n${formatForGoogleDocs(md)}`;
}

export function formatForSheets(job: Partial<Job>): string[][] {
  return [
    ["案件名", "媒体", "予算", "ステータス", "応募優先度", "地雷度", "ツール適性"],
    [
      job.title ?? "",
      job.platform ?? "",
      String(job.budget ?? ""),
      job.status ?? "",
      String(job.scores?.priority ?? ""),
      String(job.scores?.risk ?? ""),
      String(job.scores?.toolFit ?? ""),
    ],
  ];
}
