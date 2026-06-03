import type { JobStatus, JudgeLabel, Platform, Category, BudgetType } from "./types";

export const STATUS_LABEL: Record<JobStatus, string> = {
  saved: "保存",
  to_apply: "応募予定",
  applied: "応募済み",
  replied: "返信あり",
  negotiating: "条件交渉中",
  won: "受注",
  working: "作業中",
  draft_submitted: "初稿提出",
  revising: "修正中",
  delivered: "納品済み",
  continuing: "継続",
  passed: "見送り",
  landmine: "地雷",
};

export const STATUS_ORDER: JobStatus[] = [
  "saved",
  "to_apply",
  "applied",
  "replied",
  "negotiating",
  "won",
  "working",
  "draft_submitted",
  "revising",
  "delivered",
  "continuing",
  "passed",
  "landmine",
];

export function statusColor(s: JobStatus): string {
  switch (s) {
    case "won":
    case "working":
    case "draft_submitted":
    case "revising":
      return "text-good border-good/40 bg-good/10";
    case "delivered":
    case "continuing":
      return "text-emerald-300 border-emerald-400/40 bg-emerald-400/10";
    case "applied":
    case "replied":
    case "negotiating":
      return "text-accent2 border-accent2/40 bg-accent2/10";
    case "to_apply":
      return "text-accent border-accent/40 bg-accent/10";
    case "landmine":
      return "text-danger border-danger/40 bg-danger/10";
    case "passed":
      return "text-muted border-border bg-white/5";
    default:
      return "text-muted border-border bg-white/5";
  }
}

export const LABEL_TEXT: Record<JudgeLabel, string> = {
  apply_now: "今すぐ応募",
  apply_if: "条件次第で応募",
  apply_for_portfolio: "実績作りなら応募",
  pass: "見送り推奨",
  landmine: "地雷注意",
};

export function labelColor(l: JudgeLabel): string {
  switch (l) {
    case "apply_now":
      return "text-good border-good/50 bg-good/15";
    case "apply_if":
      return "text-accent2 border-accent2/50 bg-accent2/15";
    case "apply_for_portfolio":
      return "text-accent border-accent/50 bg-accent/15";
    case "pass":
      return "text-muted border-border bg-white/5";
    case "landmine":
      return "text-danger border-danger/50 bg-danger/15";
  }
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  crowdworks: "クラウドワークス",
  lancers: "ランサーズ",
  other: "その他",
};

export const CATEGORY_LABEL: Record<Category, string> = {
  seo_outline: "SEO構成案",
  seo_writing: "SEO記事作成",
  rewrite: "リライト",
  competitor: "競合分析",
  wordpress: "WordPress入稿",
  proofreading: "校正",
  meta_description: "メタディスクリプション",
  faq: "FAQ作成",
  other: "その他",
};

export const BUDGET_TYPE_LABEL: Record<BudgetType, string> = {
  fixed: "固定報酬",
  hourly: "時間単価",
  per_char: "文字単価",
  unknown: "不明",
};

export function yen(n?: number): string {
  if (!n && n !== 0) return "—";
  return "¥" + n.toLocaleString("ja-JP");
}

export function scoreTone(n: number): "good" | "warn" | "danger" | "neutral" {
  if (n >= 70) return "good";
  if (n >= 45) return "warn";
  if (n > 0) return "danger";
  return "neutral";
}

export function riskTone(n: number): "good" | "warn" | "danger" {
  if (n >= 65) return "danger";
  if (n >= 40) return "warn";
  return "good";
}
