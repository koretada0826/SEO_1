// ─────────────────────────────────────────────────────────────
// SEO Scout Workbench — Domain Types
// ─────────────────────────────────────────────────────────────

export type Platform = "crowdworks" | "lancers" | "other";

export type BudgetType = "fixed" | "hourly" | "per_char" | "unknown";

export type Category =
  | "seo_outline"
  | "seo_writing"
  | "rewrite"
  | "competitor"
  | "wordpress"
  | "proofreading"
  | "meta_description"
  | "faq"
  | "other";

export type AiPolicy = "allowed" | "forbidden" | "unknown";
export type Permission = "allowed" | "forbidden" | "unknown";
export type Continuity = "yes" | "no" | "unknown";

export type JobStatus =
  | "saved"
  | "to_apply"
  | "applied"
  | "replied"
  | "negotiating"
  | "won"
  | "working"
  | "draft_submitted"
  | "revising"
  | "delivered"
  | "continuing"
  | "passed"
  | "landmine";

export type JudgeLabel =
  | "apply_now"
  | "apply_if"
  | "apply_for_portfolio"
  | "pass"
  | "landmine";

export interface Scores {
  priority: number; // 応募優先度
  profitability: number; // 収益性
  portfolioValue: number; // 実績化価値 / ポートフォリオ化価値
  toolFit: number; // 自作ツール適性
  continuity: number; // 継続可能性
  difficulty: number; // 作業難易度
  risk: number; // 地雷度
  geoReadiness: number; // GEO付加価値余地
}

export interface RiskHit {
  word: string;
  reason: string;
  severity: "high" | "medium" | "low";
}

export interface TimeEstimate {
  minHours: number;
  normalHours: number;
  withRevisionHours: number;
  hourlyRate: number; // 時給換算（円）
  toolSavedHours: number;
}

export interface JobAnalysis {
  detectedType: Category;
  deliverables: string[];
  label: JudgeLabel;
  reasonsApply: string[];
  reasonsAvoid: string[];
  cautions: string[];
  proposalEmphasis: string[];
  time: TimeEstimate;
  aiPolicyNote: string;
  riskHits: RiskHit[];
  analyzedAt: string;
}

export interface Proposal {
  id: string;
  jobId: string;
  type: string; // 提案文タイプ
  content: string;
  tone: string;
  aiPolicyMode: AiPolicy;
  createdAt: string;
}

export interface OutlineNode {
  level: "h1" | "h2" | "h3";
  text: string;
  role: string;
  content: string;
  charBudget: number;
}

export interface TitleIdea {
  kind: string; // SEO重視 / CTR重視 / 初心者向け / 比較検討 / GEO対応
  text: string;
}

export interface MetaIdea {
  kind: string;
  text: string; // ~120字
}

export interface FaqItem {
  q: string;
  a: string;
  geoFriendly: boolean;
}

export interface GeoSuggestion {
  area: string;
  present: boolean;
  suggestion: string;
}

export interface CompetitorAnalysis {
  id: string;
  deliverableId?: string;
  competitorUrls: string[];
  commonHeadings: string[];
  missingTopics: string[];
  uniqueAngles: string[];
  faqGaps: string[];
  suggestedSections: { title: string; priority: "A" | "B" | "C"; why: string }[];
  comparisonTable: string[];
  eeatPoints: string[];
}

export interface RewriteDiagnosis {
  currentScore: number;
  titleFix: string;
  leadFix: string;
  headingFixes: string[];
  missingInfo: string[];
  outdated: string[];
  hardToRead: string[];
  redundant: string[];
  aiLikePhrases: string[];
  expertiseGaps: string[];
  ctaFix: string;
  faqAdds: string[];
  newOutline: OutlineNode[];
  priorities: { item: string; priority: "A" | "B" | "C" }[];
}

export interface Deliverable {
  id: string;
  jobId: string;
  type: string;
  // inputs
  clientName?: string;
  keyword: string;
  theme?: string;
  targetReader: string;
  painPoint?: string;
  purpose?: string;
  charCount?: number;
  existingUrl?: string;
  existingBody?: string;
  competitorUrls?: string[];
  tone?: string;
  aiPolicy?: AiPolicy;
  outputFormat?: string;
  // outputs
  searchIntent?: {
    explicit: string[];
    latent: string[];
    reallyWant: string;
    anxiety: string;
    finalAction: string;
  };
  persona?: {
    age: string;
    situation: string;
    pains: string[];
    alternatives: string[];
    wants: string[];
  };
  goal?: { understand: string; action: string; cta: string };
  outline?: OutlineNode[];
  titles?: TitleIdea[];
  metaDescriptions?: MetaIdea[];
  faqs?: FaqItem[];
  competitorAnalysis?: CompetitorAnalysis;
  rewriteSuggestions?: string[];
  geoSuggestions?: GeoSuggestion[];
  report?: string;
  createdAt: string;
}

export interface Job {
  id: string;
  title: string;
  platform: Platform;
  url: string;
  description: string;
  budgetType: BudgetType;
  budget: number; // 円（不明は0）
  deadline: string;
  recruitCount?: number;
  applicantCount?: number;
  clientRating?: number; // 0-5
  clientOrderCount?: number;
  category: Category;
  aiPolicy: AiPolicy;
  portfolioPermission: Permission;
  continuity: Continuity;
  charCount?: number; // 想定文字数（文字単価案件の収益試算等に使用）
  status: JobStatus;
  scores: Scores;
  analysis?: JobAnalysis;
  proposals: string[]; // proposal ids
  deliverables: string[]; // deliverable ids
  notes: string;
  nextAction?: string;
  expectedRevenue?: number;
  actualRevenue?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DB {
  jobs: Job[];
  proposals: Proposal[];
  deliverables: Deliverable[];
  settings: AppSettings;
}

export interface AppSettings {
  displayName: string;
  defaultHourlyTarget: number; // 目標時給
  minBudget: number; // これ未満は警告
  aiProvider: "mock" | "claude" | "openai";
  googleConnected: boolean;
  notificationsEnabled: boolean; // 応募・受注・作業完了の通知（ブラウザ通知）
}
