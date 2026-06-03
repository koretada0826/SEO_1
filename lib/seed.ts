import type { Job } from "./types";
import { scoreJobRule } from "./scoring";
import { analyzeJob } from "./mockAI";

// Claude in Chrome が実際に見つけた案件（2026/06/03〜04 のクラウドワークス検索結果）。
// 設定 →「サンプルデータで初期化」で読み込まれる。
// ※このツールは Claude in Chrome と自動同期しません。状況が変わったら手動で更新します。
const RAW: Partial<Job>[] = [
  // ── 応募候補（あなたの確認待ち） ──
  {
    title: "不動産売却メディアの記事棚卸し・キーワード整理",
    platform: "crowdworks",
    url: "https://crowdworks.jp/public/jobs/13186139",
    description:
      "不動産売却メディアの既存約100記事の棚卸し＋SEOキーワードマップ作成。Googleスプレッドシートで一覧化する納品物が明確。初回はスポットだが、継続的にリライト・SEOディレクションへ発展する可能性あり。KWテーブル整理・競合差分整理が直接活きる案件。クライアント：FIVETIMEZONE（評価4.9 / 完了率97% / 64件 / 本人確認済み）。応募期限：2026/06/04。",
    budgetType: "fixed",
    budget: 30000,
    deadline: "2026/06/04",
    category: "competitor",
    aiPolicy: "unknown",
    portfolioPermission: "unknown",
    continuity: "yes",
    clientRating: 4.9,
    clientOrderCount: 64,
    status: "to_apply",
  },
  {
    title: "車内クリーニングサイトのSEO運用",
    platform: "crowdworks",
    url: "https://crowdworks.jp/public/jobs/13213590",
    description:
      "車内クリーニングサイトのSEO運用案件。Claude in Chrome の検索で条件に合う候補として抽出。提案文を準備中。詳細はクラウドワークスの募集ページを参照。",
    budgetType: "unknown",
    budget: 0,
    deadline: "",
    category: "other",
    aiPolicy: "unknown",
    portfolioPermission: "unknown",
    continuity: "unknown",
    status: "to_apply",
  },

  // ── 見送り（Claudeが基準で除外） ──
  {
    title: "テクニカルSEO診断（ハウスドクター）",
    platform: "crowdworks",
    url: "https://crowdworks.jp/public/jobs/",
    description: "テクニカルSEO実務・disavow経験が必須でスキルセット外のため見送り。",
    budgetType: "unknown",
    budget: 0,
    category: "other",
    aiPolicy: "unknown",
    portfolioPermission: "unknown",
    continuity: "unknown",
    status: "passed",
  },
  {
    title: "WebサイトSEO監修（トリプル・ユー・ウェブ）",
    platform: "crowdworks",
    url: "https://crowdworks.jp/public/jobs/",
    description: "クライアント本人確認未提出・実績ゼロのため見送り。",
    budgetType: "unknown",
    budget: 0,
    category: "other",
    aiPolicy: "unknown",
    portfolioPermission: "unknown",
    continuity: "unknown",
    status: "passed",
  },
  {
    title: "HRTech SaaSのSEO戦略アドバイザー（One人事）",
    platform: "crowdworks",
    url: "https://crowdworks.jp/public/jobs/",
    description: "GA4・BtoB SaaSマーケ経験必須で「求めていない人物像」に該当のため見送り。",
    budgetType: "unknown",
    budget: 0,
    category: "other",
    aiPolicy: "unknown",
    portfolioPermission: "unknown",
    continuity: "unknown",
    status: "passed",
  },
  {
    title: "【AI・ChatGPTに興味がある方歓迎】SEO記事ライター募集｜未経験OK・継続依頼あり",
    platform: "crowdworks",
    url: "https://crowdworks.jp/public/jobs/",
    description:
      "文字単価0.8円（1,800文字）・ポートフォリオ必須・トライアル期間あり（実質テストライティング）・チャットワーク必須のため見送り。",
    budgetType: "per_char",
    budget: 0.8,
    category: "seo_writing",
    aiPolicy: "allowed",
    portfolioPermission: "unknown",
    continuity: "yes",
    status: "passed",
    charCount: 1800,
  },

  // ── 地雷（強めの注意） ──
  {
    title: "【初心者歓迎】SEO記事作成 大量募集！まずは無料テストから",
    platform: "crowdworks",
    url: "https://crowdworks.jp/public/jobs/",
    description:
      "無料テストライティング・文字単価0.3円・修正無制限・AI禁止・大量募集のため地雷。",
    budgetType: "per_char",
    budget: 0.3,
    category: "seo_writing",
    aiPolicy: "forbidden",
    portfolioPermission: "forbidden",
    continuity: "no",
    status: "landmine",
    charCount: 5000,
  },
  {
    title: "SEO記事の校正・チェック（文字単価0.5円）",
    platform: "crowdworks",
    url: "https://crowdworks.jp/public/jobs/",
    description: "文字単価0.5円・即日希望・修正無制限のため地雷。",
    budgetType: "per_char",
    budget: 0.5,
    category: "proofreading",
    aiPolicy: "unknown",
    portfolioPermission: "forbidden",
    continuity: "no",
    status: "landmine",
    charCount: 4000,
  },
];

let cache: Job[] | null = null;

export function SEED_JOBS(): Job[] {
  if (cache) return cache.map((j) => ({ ...j }));
  const nowIso = new Date().toISOString();
  cache = RAW.map((r, i) => {
    const scores = scoreJobRule(r);
    const base: Job = {
      id: `seed_${i + 1}`,
      title: r.title ?? "",
      platform: r.platform ?? "crowdworks",
      url: r.url ?? "",
      description: r.description ?? "",
      budgetType: r.budgetType ?? "unknown",
      budget: r.budget ?? 0,
      deadline: r.deadline ?? "",
      recruitCount: r.recruitCount,
      applicantCount: r.applicantCount,
      clientRating: r.clientRating,
      clientOrderCount: r.clientOrderCount,
      category: r.category ?? "other",
      aiPolicy: r.aiPolicy ?? "unknown",
      portfolioPermission: r.portfolioPermission ?? "unknown",
      continuity: r.continuity ?? "unknown",
      charCount: r.charCount,
      status: r.status ?? "saved",
      scores,
      analysis: analyzeJob(r),
      proposals: [],
      deliverables: [],
      notes: "",
      nextAction:
        r.status === "to_apply"
          ? "提案文を確認して応募"
          : r.status === "applied"
          ? "返信待ち（3日経過で再アプローチ検討）"
          : r.status === "won"
          ? "キーワード・競合URLをヒアリング"
          : undefined,
      expectedRevenue:
        r.budgetType === "per_char" ? (r.budget ?? 0) * (r.charCount ?? 3000) : r.budget ?? 0,
      actualRevenue: r.actualRevenue ?? 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    return base;
  });
  return cache.map((j) => ({ ...j }));
}
