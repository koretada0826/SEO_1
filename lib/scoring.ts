import type { Job, Scores, Category } from "./types";
import { detectRiskWordsRule, detectPositiveSignals } from "./riskWords";

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

// 自作ツール適性が高いカテゴリ
const HIGH_TOOL_FIT: Category[] = [
  "seo_outline",
  "competitor",
  "faq",
  "meta_description",
  "rewrite",
  "wordpress",
];

const HIGH_PRIORITY_CATS: Category[] = [
  "seo_outline",
  "rewrite",
  "competitor",
  "faq",
];

// カテゴリ別の基準時給目安・難易度
const CAT_DIFFICULTY: Record<Category, number> = {
  seo_outline: 45,
  seo_writing: 60,
  rewrite: 50,
  competitor: 40,
  wordpress: 35,
  proofreading: 30,
  meta_description: 25,
  faq: 30,
  other: 50,
};

export interface ScoreContext {
  minBudget?: number;
  hourlyTarget?: number;
}

// 8軸スコアを根拠つきで算出（ルールベース・モック）
export function scoreJobRule(job: Partial<Job>, ctx: ScoreContext = {}): Scores {
  const text = `${job.title ?? ""}\n${job.description ?? ""}`;
  const risks = detectRiskWordsRule(text);
  const positives = detectPositiveSignals(text);
  const cat = (job.category ?? "other") as Category;
  const minBudget = ctx.minBudget ?? 5000;

  // ── risk 地雷度 ──
  let risk = 12;
  for (const r of risks) {
    risk += r.severity === "high" ? 22 : r.severity === "medium" ? 12 : 6;
  }
  if (job.aiPolicy === "forbidden") risk += 8;
  if ((job.budget ?? 0) > 0 && (job.budget ?? 0) < minBudget) risk += 18;
  if ((job.clientRating ?? 5) < 3.5) risk += 12;
  if ((job.clientOrderCount ?? 1) === 0) risk += 8;
  risk = clamp(risk);

  // ── profitability 収益性 ──
  let profitability = 35;
  const b = job.budget ?? 0;
  if (job.budgetType === "per_char") {
    // 文字単価円として解釈（budgetに単価×100など想定）— ここでは budget をそのまま単価円とみなす簡易版
    profitability += b >= 2 ? 35 : b >= 1 ? 22 : b > 0 ? -10 : 0;
  } else {
    if (b >= 50000) profitability += 40;
    else if (b >= 20000) profitability += 28;
    else if (b >= 10000) profitability += 16;
    else if (b >= minBudget) profitability += 8;
    else if (b > 0) profitability -= 12;
  }
  if (job.continuity === "yes") profitability += 12;
  profitability -= Math.min(20, risks.filter((r) => r.severity === "high").length * 10);
  profitability = clamp(profitability);

  // ── toolFit 自作ツール適性 ──
  let toolFit = HIGH_TOOL_FIT.includes(cat) ? 78 : 45;
  toolFit += Math.min(15, positives.length * 4);
  if (cat === "seo_outline" || cat === "competitor") toolFit += 10;
  toolFit = clamp(toolFit);

  // ── continuity 継続可能性 ──
  let continuity = job.continuity === "yes" ? 80 : job.continuity === "no" ? 20 : 45;
  if (text.includes("継続") || text.includes("長期")) continuity += 12;
  continuity = clamp(continuity);

  // ── portfolioValue 実績化価値 ──
  let portfolioValue = 45;
  if (job.portfolioPermission === "allowed") portfolioValue += 25;
  if (job.portfolioPermission === "forbidden") portfolioValue -= 15;
  if (HIGH_PRIORITY_CATS.includes(cat)) portfolioValue += 15;
  if (cat === "competitor" || cat === "seo_outline") portfolioValue += 8;
  portfolioValue = clamp(portfolioValue);

  // ── difficulty 作業難易度 ──
  let difficulty = CAT_DIFFICULTY[cat] ?? 50;
  if (text.includes("マニュアル")) difficulty += 10;
  if (text.includes("WordPress") || text.includes("入稿")) difficulty += 6;
  if ((job.charCount ?? 0) > 0) difficulty += 4;
  difficulty = clamp(difficulty);

  // ── geoReadiness GEO付加価値余地 ──
  let geoReadiness = 50;
  if (cat === "faq" || cat === "seo_outline" || cat === "seo_writing") geoReadiness += 25;
  if (text.includes("FAQ") || text.includes("比較")) geoReadiness += 12;
  geoReadiness = clamp(geoReadiness);

  // ── priority 応募優先度（総合） ──
  let priority = 40;
  if (HIGH_PRIORITY_CATS.includes(cat)) priority += 18;
  priority += Math.min(16, positives.length * 5);
  priority += profitability * 0.18;
  priority += toolFit * 0.12;
  priority += continuity * 0.08;
  priority -= risk * 0.45;
  if (job.aiPolicy === "forbidden" && (job.charCount ?? 0) > 5000) priority -= 10;
  if ((job.clientRating ?? 5) >= 4.5) priority += 6;
  priority = clamp(priority);

  return {
    priority,
    profitability,
    portfolioValue,
    toolFit,
    continuity,
    difficulty,
    risk,
    geoReadiness,
  };
}

export function labelFromScores(s: Scores): {
  label: "apply_now" | "apply_if" | "apply_for_portfolio" | "pass" | "landmine";
} {
  if (s.risk >= 70) return { label: "landmine" };
  if (s.priority >= 72 && s.risk < 45) return { label: "apply_now" };
  if (s.priority >= 55) return { label: "apply_if" };
  if (s.portfolioValue >= 65 && s.risk < 60) return { label: "apply_for_portfolio" };
  return { label: "pass" };
}
