// 純粋関数：Partial<Job> から完全な Job を組み立てる。
// クライアント（store）とサーバー（API route）の両方から使う。
import type { Job } from "./types";
import { scoreJobRule } from "./scoring";
import { analyzeJob } from "./mockAI";

const nowIso = () => new Date().toISOString();

export function newId(prefix = "job"): string {
  const rnd =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${prefix}_${rnd}`;
}

export function makeJob(partial: Partial<Job>): Job {
  const now = nowIso();
  const base: Partial<Job> = {
    category: partial.category ?? "other",
    ...partial,
  };
  return {
    id: partial.id ?? newId(),
    title: partial.title ?? "無題の案件",
    platform: partial.platform ?? "crowdworks",
    url: partial.url ?? "",
    description: partial.description ?? "",
    budgetType: partial.budgetType ?? "unknown",
    budget: partial.budget ?? 0,
    deadline: partial.deadline ?? "",
    recruitCount: partial.recruitCount,
    applicantCount: partial.applicantCount,
    clientRating: partial.clientRating,
    clientOrderCount: partial.clientOrderCount,
    category: partial.category ?? "other",
    aiPolicy: partial.aiPolicy ?? "unknown",
    portfolioPermission: partial.portfolioPermission ?? "unknown",
    continuity: partial.continuity ?? "unknown",
    charCount: partial.charCount,
    status: partial.status ?? "saved",
    scores: partial.scores ?? scoreJobRule(base),
    analysis: partial.analysis ?? analyzeJob(base),
    proposals: partial.proposals ?? [],
    deliverables: partial.deliverables ?? [],
    notes: partial.notes ?? "",
    nextAction: partial.nextAction,
    expectedRevenue:
      partial.expectedRevenue ??
      (partial.budgetType === "per_char"
        ? (partial.budget ?? 0) * (partial.charCount ?? 3000)
        : partial.budget ?? 0),
    actualRevenue: partial.actualRevenue ?? 0,
    createdAt: partial.createdAt ?? now,
    updatedAt: now,
  };
}
