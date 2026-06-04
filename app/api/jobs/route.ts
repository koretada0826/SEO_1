import { NextResponse } from "next/server";
import { listJobs, upsertJob, findIdByUrl, getJobById, durable, clearAllJobs } from "@/lib/db";
import { makeJob } from "@/lib/job";
import { mapClaudeJsonToJob } from "@/lib/claudeChrome";
import type { Job } from "@/lib/types";

function toNum(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim()) {
    const n = parseFloat(v.replace(/[^0-9.\-]/g, ""));
    return isNaN(n) ? undefined : n;
  }
  return undefined;
}

// raw に明示的に含まれるフィールドだけを既存案件への差分として抽出
function buildPatch(obj: Record<string, unknown>): Partial<Job> {
  const p: Partial<Job> = {};
  if (typeof obj.status === "string") p.status = obj.status as Job["status"];
  if (typeof obj.title === "string" && obj.title) p.title = obj.title;
  if (typeof obj.description === "string" && obj.description) p.description = obj.description;
  if (typeof obj.deadline === "string" && obj.deadline) p.deadline = obj.deadline;
  if (typeof obj.notes === "string" && obj.notes) p.notes = obj.notes;
  const b = toNum(obj.budget);
  if (b != null) p.budget = b;
  const ar = toNum(obj.actualRevenue);
  if (ar != null) p.actualRevenue = ar;
  const er = toNum(obj.expectedRevenue);
  if (er != null) p.expectedRevenue = er;
  return p;
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/jobs → 全案件（DB無しでもメモリ受け取り口から返す）
export async function GET() {
  try {
    const jobs = await listJobs();
    return NextResponse.json({ enabled: true, durable: durable(), jobs });
  } catch (e) {
    return NextResponse.json({ enabled: true, durable: durable(), jobs: [], error: String(e) }, { status: 500 });
  }
}

// POST /api/jobs → 1件 or 配列を登録/更新（セットアップ不要で常に動く）
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const items: unknown[] = Array.isArray(body) ? body : [body];
    const saved: Job[] = [];

    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      const obj = raw as Record<string, unknown>;

      let job: Job;
      if (typeof obj.id === "string" && obj.scores) {
        job = obj as unknown as Job; // 完全なJob
      } else {
        const partial = mapClaudeJsonToJob(obj); // Claude/部分JSONを正規化（scores付与）
        if (typeof obj.status === "string") partial.status = obj.status as Job["status"];
        const existingId = partial.url ? await findIdByUrl(partial.url) : null;
        if (existingId) {
          // 既存案件 → 上書きせず、送られたフィールドだけマージ更新
          const existing = await getJobById(existingId);
          if (existing) {
            job = { ...existing, ...buildPatch(obj), id: existing.id, updatedAt: new Date().toISOString() };
          } else {
            job = makeJob({ ...partial, id: existingId });
          }
        } else {
          job = makeJob(partial); // 新規
        }
      }
      saved.push(await upsertJob(job));
    }

    return NextResponse.json({ enabled: true, durable: durable(), saved, count: saved.length });
  } catch (e) {
    return NextResponse.json({ enabled: true, saved: [], error: String(e) }, { status: 500 });
  }
}

// DELETE /api/jobs → 全件削除（リセット用）
export async function DELETE() {
  try {
    await clearAllJobs();
    return NextResponse.json({ enabled: true, ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
