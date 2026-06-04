import { NextResponse } from "next/server";
import { listJobs, upsertJob, findIdByUrl, durable, clearAllJobs } from "@/lib/db";
import { makeJob } from "@/lib/job";
import { mapClaudeJsonToJob } from "@/lib/claudeChrome";
import type { Job } from "@/lib/types";

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
        job = makeJob({ ...partial, id: existingId ?? undefined });
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
