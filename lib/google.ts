// ─────────────────────────────────────────────────────────────
// Google / GAS 連携レイヤー（MVPはモック）。
// 後で GAS Web App / Google API に接続する際は、各関数の本体を
//   await fetch(GAS_WEBAPP_URL, { method: 'POST', body: ... })
// に差し替えるだけでよいよう、インターフェースを固定している。
// ─────────────────────────────────────────────────────────────
import type { Job, Proposal, Deliverable, JobStatus } from "./types";

export interface GasResult {
  ok: boolean;
  mock: boolean;
  message: string;
  url?: string;
  at: string;
}

const ok = (message: string, url?: string): GasResult => ({
  ok: true,
  mock: true,
  message,
  url,
  at: new Date().toISOString(),
});

// 実接続時はここに GAS Web App の URL を設定
export const GAS_WEBAPP_URL = "";

async function call(action: string, payload: unknown): Promise<GasResult> {
  if (!GAS_WEBAPP_URL) {
    // モック：ログのみ。課金・送信は一切発生しない。
    if (typeof console !== "undefined") console.info(`[GAS mock] ${action}`, payload);
    return ok(`【モック】${action} を実行しました（実際の送信はしていません）`);
  }
  // 実装時:
  // const res = await fetch(GAS_WEBAPP_URL, { method: 'POST', body: JSON.stringify({ action, payload }) });
  // return res.json();
  return ok(`${action} (mock)`);
}

export const saveJobToSheet = (job: Job) => call("saveJobToSheet", job);
export const saveProposalToSheet = (p: Proposal) => call("saveProposalToSheet", p);
export const saveDeliverableToSheet = (d: Deliverable) => call("saveDeliverableToSheet", d);
export const exportReportToGoogleDocs = (title: string, body: string) =>
  call("exportReportToGoogleDocs", { title, body });
export const exportReportToPDF = (title: string, body: string) =>
  call("exportReportToPDF", { title, body });
export const createGmailDraft = (to: string, subject: string, body: string) =>
  call("createGmailDraft", { to, subject, body });
export const updateJobStatus = (jobId: string, status: JobStatus) =>
  call("updateJobStatus", { jobId, status });
