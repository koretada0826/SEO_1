"use client";
import { useDB } from "@/lib/store";
import { Badge } from "./ui";
import { STATUS_LABEL } from "@/lib/labels";

export function TopBar() {
  const db = useDB();
  const active = db.jobs.filter((j) =>
    ["won", "working", "draft_submitted", "revising"].includes(j.status)
  );
  const toApply = db.jobs.filter((j) => j.status === "to_apply").length;
  const replied = db.jobs.filter((j) => j.status === "replied").length;

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-border bg-bg/80 px-7 py-3 backdrop-blur">
      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="font-medium text-zinc-300">作業ステータス</span>
        <Badge className="border-good/40 bg-good/10 text-good">
          作業中 {active.length}
        </Badge>
        <Badge className="border-accent/40 bg-accent/10 text-accent">応募予定 {toApply}</Badge>
        <Badge className="border-accent2/40 bg-accent2/10 text-accent2">返信 {replied}</Badge>
        {active[0] && (
          <span className="hidden md:inline text-muted">
            進行中: <span className="text-zinc-300">{active[0].title.slice(0, 28)}…</span>（
            {STATUS_LABEL[active[0].status]}）
          </span>
        )}
      </div>
      <div className="flex items-center gap-3 text-xs">
        <Badge className="border-border bg-white/5 text-muted">AI: モック（課金なし）</Badge>
        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-accent to-accent2" />
      </div>
    </header>
  );
}
