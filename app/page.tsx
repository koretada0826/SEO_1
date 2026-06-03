"use client";
import Link from "next/link";
import { useDB, actions } from "@/lib/store";
import { Card, PageHeader, Badge, Button, EmptyState } from "@/components/ui";
import { STATUS_LABEL, PLATFORM_LABEL, yen, LABEL_TEXT, labelColor } from "@/lib/labels";
import type { Job, JobStatus } from "@/lib/types";

function parseDeadline(s?: string): Date | null {
  if (!s) return null;
  const m = s.match(/(\d{4})[\/\-.年](\d{1,2})[\/\-.月](\d{1,2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}
function daysUntil(d: Date | null): number | null {
  if (!d) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

type Act = { label: string; status: JobStatus; variant?: "primary" | "outline" | "subtle" | "danger" };
interface Approval {
  job: Job;
  rank: number;
  kind: string;
  kindCls: string;
  note: string; // Claudeのおすすめ・状況
  actions: Act[];
  href: string; // 開いて確認するリンク
}

const WORKING = ["won", "working", "draft_submitted", "revising"];

export default function Home() {
  const db = useDB();
  const jobs = db.jobs;

  const approvals: Approval[] = [];
  for (const j of jobs) {
    if (["passed", "landmine", "delivered", "continuing"].includes(j.status)) continue;
    const hasProp = j.proposals.length > 0;
    const hasDeliv = j.deliverables.length > 0;
    const dl = daysUntil(parseDeadline(j.deadline));
    const detail = `/jobs/${j.id}`;

    // 返信あり：受注 or 見送りを判断
    if (j.status === "replied") {
      approvals.push({
        job: j,
        rank: 0,
        kind: "返信あり",
        kindCls: "border-accent2/40 bg-accent2/10 text-accent2",
        note: "クライアントから返信。条件を確認して受注/見送りを判断",
        actions: [
          { label: "受注にする", status: "won", variant: "primary" },
          { label: "見送り", status: "passed", variant: "outline" },
        ],
        href: detail,
      });
      continue;
    }
    // 作業中で納期が近い
    if (WORKING.includes(j.status) && dl != null && dl <= 7) {
      approvals.push({
        job: j,
        rank: 1 + Math.max(0, dl),
        kind: dl < 0 ? "納期超過" : "納期間近",
        kindCls: "border-danger/40 bg-danger/10 text-danger",
        note: dl < 0 ? `納期を${-dl}日超過` : dl === 0 ? "本日納期" : `納期まであと${dl}日`,
        actions: hasDeliv ? [{ label: "納品済みにする", status: "delivered", variant: "primary" }] : [],
        href: detail,
      });
      continue;
    }
    // 納品物ができた → 提出の確認
    if (WORKING.includes(j.status) && hasDeliv) {
      approvals.push({
        job: j,
        rank: 12,
        kind: "提出待ち",
        kindCls: "border-good/40 bg-good/10 text-good",
        note: "納品物が用意できています。内容を確認して提出",
        actions: [{ label: "納品済みにする", status: "delivered", variant: "primary" }],
        href: detail,
      });
      continue;
    }
    // 作業中だが納品物がまだ
    if (WORKING.includes(j.status) && !hasDeliv) {
      approvals.push({
        job: j,
        rank: 14,
        kind: "納品作成",
        kindCls: "border-warn/40 bg-warn/10 text-warn",
        note: "受注済み。納品物の作成が必要です",
        actions: [],
        href: detail,
      });
      continue;
    }
    // 応募予定：提案文を確認して応募
    if (j.status === "to_apply") {
      approvals.push({
        job: j,
        rank: 20,
        kind: "応募の確認",
        kindCls: "border-accent/40 bg-accent/10 text-accent",
        note: hasProp ? "提案文あり。内容を確認して応募" : "応募候補。提案文を作成して応募",
        actions: [{ label: "応募した", status: "applied", variant: "primary" }],
        href: detail,
      });
      continue;
    }
    // 保存：応募するか判断（Claudeのおすすめを確認）
    if (j.status === "saved") {
      const rec = j.analysis ? `Claudeの判定：${LABEL_TEXT[j.analysis.label]}` : "未解析";
      approvals.push({
        job: j,
        rank: 24,
        kind: "応募判断",
        kindCls: "border-accent/40 bg-accent/10 text-accent",
        note: rec,
        actions: [
          { label: "応募候補に入れる", status: "to_apply", variant: "primary" },
          { label: "見送り", status: "passed", variant: "outline" },
        ],
        href: detail,
      });
    }
  }
  approvals.sort((a, b) => a.rank - b.rank);

  const waiting = jobs.filter((j) => ["applied", "negotiating"].includes(j.status)).length;

  return (
    <>
      <PageHeader
        title="承認センター"
        desc="Claudeが進めた案件のうち、あなたの確認・承認が必要なものだけ表示します。ボタンで承認、開いて中身も確認できます。"
        right={
          <div className="flex gap-2">
            <Link href="/claude">
              <Button variant="outline">案件を探す/取り込む</Button>
            </Link>
            <Link href="/jobs">
              <Button variant="outline">案件一覧</Button>
            </Link>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted">
        <Badge className="border-accent/40 bg-accent/10 text-accent">承認待ち {approvals.length}</Badge>
        {waiting > 0 && <Badge className="border-border bg-white/5 text-muted">返信待ち {waiting}</Badge>}
      </div>

      <Card title="承認待ち" desc={approvals.length ? "優先度が高い順" : undefined}>
        {approvals.length ? (
          <div className="space-y-2">
            {approvals.map((a) => (
              <ApprovalRow key={a.job.id} a={a} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="承認待ちはありません 🎉"
            desc="新しい案件を探すか、案件一覧から状況を確認できます。"
            action={
              <Link href="/claude">
                <Button variant="outline">案件を探す/取り込む</Button>
              </Link>
            }
          />
        )}
      </Card>
    </>
  );
}

function ApprovalRow({ a }: { a: Approval }) {
  const { job } = a;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-bg/40 px-3 py-3 transition hover:border-accent/40">
      <Badge className={a.kindCls}>{a.kind}</Badge>
      <div className="min-w-0 flex-1">
        <Link href={a.href} className="block">
          <p className="truncate text-[13px] font-medium text-zinc-100 hover:text-accent">{job.title}</p>
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
          <Badge className="border-border bg-white/5 text-muted">{PLATFORM_LABEL[job.platform]}</Badge>
          <span>{yen(job.budget)}</span>
          <Badge className="border-border bg-white/5 text-muted">{STATUS_LABEL[job.status]}</Badge>
          {job.analysis && (
            <Badge className={labelColor(job.analysis.label)}>{LABEL_TEXT[job.analysis.label]}</Badge>
          )}
          <span className="text-accent2">{a.note}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {a.actions.map((act) => (
          <Button
            key={act.label}
            variant={act.variant ?? "outline"}
            className="px-3 py-1.5 text-xs"
            onClick={() => actions.setStatus(job.id, act.status)}
          >
            {act.label}
          </Button>
        ))}
        <Link href={a.href}>
          <Button variant="ghost" className="px-3 py-1.5 text-xs">
            開いて確認
          </Button>
        </Link>
      </div>
    </div>
  );
}
