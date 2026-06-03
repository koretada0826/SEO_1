"use client";
// ─────────────────────────────────────────────────────────────
// グローバルストア：useSyncExternalStore + localStorage 永続化。
// 後で Supabase に移行する場合は load/persist を差し替えるだけ。
// ─────────────────────────────────────────────────────────────
import { useSyncExternalStore } from "react";
import type {
  DB,
  Job,
  Proposal,
  Deliverable,
  AppSettings,
  JobStatus,
} from "./types";
import { SEED_JOBS } from "./seed";

const KEY = "ssw.db.v1";

const DEFAULT_SETTINGS: AppSettings = {
  displayName: "SEOディレクター",
  defaultHourlyTarget: 3000,
  minBudget: 5000,
  aiProvider: "mock",
  googleConnected: false,
  notificationsEnabled: false,
};

// ステータス変化時のブラウザ通知（タブが開いている間に届く）。
// 許可がない/無効化されている場合は何もしない。
const NOTIFY_STATUS: Partial<Record<JobStatus, string>> = {
  applied: "✅ 応募しました",
  won: "🎉 受注しました",
  delivered: "📦 作業完了（納品済み）",
};
function notifyStatusChange(title: string, status: JobStatus) {
  if (!db.settings.notificationsEnabled) return;
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const head = NOTIFY_STATUS[status];
  if (!head) return;
  try {
    new Notification(head, { body: title, tag: `ssw-${status}-${title}` });
  } catch {
    /* ignore */
  }
}

function emptyDB(): DB {
  return { jobs: [], proposals: [], deliverables: [], settings: DEFAULT_SETTINGS };
}

let db: DB = emptyDB();
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded) return;
  loaded = true;
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DB;
      db = { ...emptyDB(), ...parsed, settings: { ...DEFAULT_SETTINGS, ...parsed.settings } };
    } else {
      db = { ...emptyDB(), jobs: SEED_JOBS() };
      persist();
    }
  } catch {
    db = { ...emptyDB(), jobs: SEED_JOBS() };
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* quota etc. */
  }
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  load();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function snapshot(): DB {
  load();
  return db;
}

// ── React hook ──
export function useDB(): DB {
  return useSyncExternalStore(subscribe, snapshot, () => emptyDB());
}

const nowIso = () => new Date().toISOString();
const uid = (p: string) => {
  const r =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().slice(0, 8)
      : Math.floor(performance.now() * 1000).toString(36);
  return `${p}_${r}`;
};

// ── Mutations ──
export const actions = {
  addJob(partial: Partial<Job>): Job {
    load();
    const job: Job = {
      id: uid("job"),
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
      scores:
        partial.scores ?? {
          priority: 0,
          profitability: 0,
          portfolioValue: 0,
          toolFit: 0,
          continuity: 0,
          difficulty: 0,
          risk: 0,
          geoReadiness: 0,
        },
      analysis: partial.analysis,
      proposals: [],
      deliverables: [],
      notes: partial.notes ?? "",
      nextAction: partial.nextAction,
      expectedRevenue: partial.expectedRevenue ?? partial.budget ?? 0,
      actualRevenue: partial.actualRevenue ?? 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    db.jobs = [job, ...db.jobs];
    emit();
    return job;
  },
  updateJob(id: string, patch: Partial<Job>) {
    load();
    db.jobs = db.jobs.map((j) =>
      j.id === id ? { ...j, ...patch, updatedAt: nowIso() } : j
    );
    emit();
  },
  setStatus(id: string, status: JobStatus) {
    load();
    const prev = db.jobs.find((j) => j.id === id);
    const prevStatus = prev?.status;
    const title = prev?.title ?? "案件";
    this.updateJob(id, { status });
    if (prevStatus !== status) notifyStatusChange(title, status);
  },
  removeJob(id: string) {
    load();
    db.jobs = db.jobs.filter((j) => j.id !== id);
    db.proposals = db.proposals.filter((p) => p.jobId !== id);
    db.deliverables = db.deliverables.filter((d) => d.jobId !== id);
    emit();
  },
  addProposal(p: Proposal) {
    load();
    db.proposals = [p, ...db.proposals];
    db.jobs = db.jobs.map((j) =>
      j.id === p.jobId ? { ...j, proposals: [p.id, ...j.proposals], updatedAt: nowIso() } : j
    );
    emit();
  },
  addDeliverable(d: Deliverable) {
    load();
    db.deliverables = [d, ...db.deliverables];
    db.jobs = db.jobs.map((j) =>
      j.id === d.jobId
        ? { ...j, deliverables: [d.id, ...j.deliverables], updatedAt: nowIso() }
        : j
    );
    emit();
  },
  updateSettings(patch: Partial<AppSettings>) {
    load();
    db.settings = { ...db.settings, ...patch };
    emit();
  },
  resetAll() {
    db = { ...emptyDB(), jobs: SEED_JOBS() };
    emit();
  },
  clearAll() {
    db = emptyDB();
    emit();
  },
};

export function getJob(id: string): Job | undefined {
  load();
  return db.jobs.find((j) => j.id === id);
}
