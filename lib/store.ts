"use client";
// ─────────────────────────────────────────────────────────────
// グローバルストア：useSyncExternalStore + localStorage（即時表示）
//   ＋ サーバーAPI(/api/jobs)との同期（DB設定時のみ）。
// DBが無い時は完全に localStorage のみで動作（後付けでDB連動を有効化できる）。
// jobs だけサーバー同期。proposals/deliverables/settings はローカル保持。
// ─────────────────────────────────────────────────────────────
import { useSyncExternalStore } from "react";
import type { DB, Job, Proposal, Deliverable, AppSettings, JobStatus } from "./types";
import { SEED_JOBS } from "./seed";
import { makeJob } from "./job";

const KEY = "ssw.db.v1";

const DEFAULT_SETTINGS: AppSettings = {
  displayName: "SEOディレクター",
  defaultHourlyTarget: 3000,
  minBudget: 5000,
  aiProvider: "mock",
  googleConnected: false,
  notificationsEnabled: false,
};

function emptyDB(): DB {
  return { jobs: [], proposals: [], deliverables: [], settings: DEFAULT_SETTINGS };
}

let db: DB = emptyDB();
let loaded = false;
let serverEnabled = false; // /api/jobs がDB有効を返したら true
let polling = false;
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
  // サーバー同期を開始（DBが無ければ何もしない）
  void syncFromServer();
  startPolling();
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    /* quota */
  }
}

function emit() {
  persist();
  listeners.forEach((l) => l());
}

// ── サーバー同期（マージ方式） ──
// サーバー（DB or メモリ受け取り口）の案件を、ローカルへマージする。
// 置き換えではなくマージなので、サーバーが空になってもローカルの案件は消えない。
function mergeJobs(local: Job[], server: Job[]): Job[] {
  const out = local.slice();
  for (const s of server) {
    const i = out.findIndex((j) => j.id === s.id || (!!s.url && j.url === s.url));
    if (i >= 0) out[i] = s;
    else out.unshift(s);
  }
  out.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  return out;
}

async function syncFromServer() {
  if (typeof window === "undefined") return;
  try {
    const res = await fetch("/api/jobs", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as { jobs: Job[] };
    serverEnabled = true;
    const serverJobs = Array.isArray(json.jobs) ? json.jobs : [];
    if (!serverJobs.length) return; // 受信なし → ローカル維持
    const merged = mergeJobs(db.jobs, serverJobs);
    if (JSON.stringify(merged) !== JSON.stringify(db.jobs)) {
      db.jobs = merged;
      emit();
    }
  } catch {
    /* オフライン等：ローカル表示のまま */
  }
}

function startPolling() {
  if (polling || typeof window === "undefined") return;
  polling = true;
  window.setInterval(() => void syncFromServer(), 20000);
  window.addEventListener("focus", () => void syncFromServer());
}

function pushJob(job: Job) {
  if (!serverEnabled || typeof window === "undefined") return;
  void fetch("/api/jobs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify([job]),
  }).catch(() => {});
}

function deleteRemote(id: string) {
  if (!serverEnabled || typeof window === "undefined") return;
  void fetch(`/api/jobs/${id}`, { method: "DELETE" }).catch(() => {});
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

export function useDB(): DB {
  return useSyncExternalStore(subscribe, snapshot, () => emptyDB());
}

const nowIso = () => new Date().toISOString();

// ── 通知（ステータス変化時のブラウザ通知） ──
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

// ── Mutations ──
export const actions = {
  addJob(partial: Partial<Job>): Job {
    load();
    const job = makeJob(partial);
    db.jobs = [job, ...db.jobs];
    emit();
    pushJob(job);
    return job;
  },
  updateJob(id: string, patch: Partial<Job>) {
    load();
    let updated: Job | undefined;
    db.jobs = db.jobs.map((j) => {
      if (j.id !== id) return j;
      updated = { ...j, ...patch, updatedAt: nowIso() };
      return updated;
    });
    emit();
    if (updated) pushJob(updated);
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
    deleteRemote(id);
  },
  addProposal(p: Proposal) {
    load();
    db.proposals = [p, ...db.proposals];
    let updated: Job | undefined;
    db.jobs = db.jobs.map((j) => {
      if (j.id !== p.jobId) return j;
      updated = { ...j, proposals: [p.id, ...j.proposals], updatedAt: nowIso() };
      return updated;
    });
    emit();
    if (updated) pushJob(updated);
  },
  addDeliverable(d: Deliverable) {
    load();
    db.deliverables = [d, ...db.deliverables];
    let updated: Job | undefined;
    db.jobs = db.jobs.map((j) => {
      if (j.id !== d.jobId) return j;
      updated = { ...j, deliverables: [d.id, ...j.deliverables], updatedAt: nowIso() };
      return updated;
    });
    emit();
    if (updated) pushJob(updated);
  },
  updateSettings(patch: Partial<AppSettings>) {
    load();
    db.settings = { ...db.settings, ...patch };
    emit();
  },
  resetAll() {
    db = { ...emptyDB(), jobs: SEED_JOBS(), settings: db.settings };
    emit();
    if (serverEnabled) db.jobs.forEach((j) => pushJob(j));
  },
  clearAll() {
    // ローカル表示のみクリア（サーバーDBは保持。全消ししたい場合は各案件を削除）
    db = { ...emptyDB(), settings: db.settings };
    emit();
  },
  // 手動でサーバーから取り込み直す（「同期」ボタン用）
  syncNow() {
    void syncFromServer();
  },
};

export function getJob(id: string): Job | undefined {
  load();
  return db.jobs.find((j) => j.id === id);
}
