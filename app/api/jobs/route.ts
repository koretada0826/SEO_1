import { NextResponse } from "next/server";
import { listJobs, upsertJob, findIdByUrl, dbEnabled } from "@/lib/db";
import { makeJob } from "@/lib/job";
import { mapClaudeJsonToJob } from "@/lib/claudeChrome";
import type { Job } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/jobs → 全案件（DB未設定なら enabled:false）
export async function GET() {
  try {
    const jobs = await listJobs();
    if (jobs === null) return NextResponse.json({ enabled: false, jobs: [] });
    return NextResponse.json({ enabled: true, jobs });
  } catch (e) {
    return NextResponse.json(
      { enabled: dbEnabled(), jobs: [], error: String(e) },
      { status: 500 }
    );
  }
}

// POST /api/jobs → 1件 or 配列を登録/更新。
//   - 完全なJob（id+scoresあり）はそのままupsert
//   - Claude/部分JSON（id無し）は正規化→URL重複チェック→新規作成
export async function POST(req: Request) {
  if (!dbEnabled()) {
    return NextResponse.json(
      { enabled: false, saved: [], message: "DB未設定のため保存できません（DATABASE_URLを設定してください）" },
      { status: 503 }
    );
  }
  try {
    const body = await req.json();
    const items: unknown[] = Array.isArray(body) ? body : [body];
    const saved: Job[] = [];

    for (const raw of items) {
      if (!raw || typeof raw !== "object") continue;
      const obj = raw as Record<string, unknown>;

      let job: Job;
      if (typeof obj.id === "string" && obj.scores) {
        // 完全なJob
        job = obj as unknown as Job;
      } else {
        // Claude/部分JSON → 正規化
        const partial = mapClaudeJsonToJob(obj);
        // URL重複なら既存IDを再利用（重複登録防止）
        const existingId = partial.url ? await findIdByUrl(partial.url) : null;
        job = makeJob({ ...partial, id: existingId ?? undefined });
      }
      const res = await upsertJob(job);
      if (res) saved.push(res);
    }

    return NextResponse.json({ enabled: true, saved, count: saved.length });
  } catch (e) {
    return NextResponse.json({ enabled: true, saved: [], error: String(e) }, { status: 500 });
  }
}
