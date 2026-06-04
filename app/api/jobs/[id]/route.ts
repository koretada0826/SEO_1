import { NextResponse } from "next/server";
import { patchJob, deleteJob, dbEnabled } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// PATCH /api/jobs/:id → 部分更新（ステータス変更など）
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!dbEnabled()) return NextResponse.json({ enabled: false }, { status: 503 });
  try {
    const patch = await req.json();
    const updated = await patchJob(params.id, patch);
    if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ enabled: true, job: updated });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// DELETE /api/jobs/:id
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  if (!dbEnabled()) return NextResponse.json({ enabled: false }, { status: 503 });
  try {
    await deleteJob(params.id);
    return NextResponse.json({ enabled: true, ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
