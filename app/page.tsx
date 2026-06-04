"use client";
import Link from "next/link";
import { useDB } from "@/lib/store";
import { Card, StatCard, PageHeader, Badge, Button, EmptyState } from "@/components/ui";
import { STATUS_LABEL, PLATFORM_LABEL, yen, statusColor, LABEL_TEXT, labelColor } from "@/lib/labels";
import type { Job } from "@/lib/types";

function fmtDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const WORKING = ["won", "working", "draft_submitted", "revising"];

export default function Home() {
  const db = useDB();
  const jobs = db.jobs;

  const c = (f: (j: Job) => boolean) => jobs.filter(f).length;
  const total = jobs.length;
  const candidates = c((j) => j.status === "to_apply");
  const appliedInFlight = c((j) => ["applied", "negotiating", "replied"].includes(j.status));
  const won = c((j) => WORKING.includes(j.status));
  const delivered = c((j) => ["delivered", "continuing"].includes(j.status));
  const expected = jobs
    .filter((j) => !["passed", "landmine", "delivered", "continuing"].includes(j.status))
    .reduce((s, j) => s + (j.expectedRevenue ?? 0), 0);
  const actual = jobs.reduce((s, j) => s + (j.actualRevenue ?? 0), 0);

  // 稼ぎ・時給換算（納品済みベース）
  const deliveredJobs = jobs.filter((j) => ["delivered", "continuing"].includes(j.status));
  const earned = deliveredJobs.reduce(
    (s, j) => s + (j.actualRevenue || j.expectedRevenue || j.budget || 0),
    0
  );
  const earnedHours = deliveredJobs.reduce(
    (s, j) => s + (j.analysis?.time?.withRevisionHours ?? j.analysis?.time?.normalHours ?? 0),
    0
  );
  const avgHourly = earnedHours > 0 ? Math.round(earned / earnedHours) : 0;
  const savedHours = jobs
    .filter((j) => [...WORKING, "delivered", "continuing"].includes(j.status))
    .reduce((s, j) => s + (j.analysis?.time?.toolSavedHours ?? 0), 0);

  // 応募した案件だけ（候補・見送り・地雷は除外）
  const APPLIED_PLUS = [
    "applied", "negotiating", "replied",
    "won", "working", "draft_submitted", "revising",
    "delivered", "continuing",
  ];
  const appliedList = [...jobs]
    .filter((j) => APPLIED_PLUS.includes(j.status))
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
    .slice(0, 100);

  if (total === 0) {
    return (
      <>
        <PageHeader title="ダッシュボード" desc="Claudeが案件を取り込むと、ここに状況が表示されます。" />
        <EmptyState
          title="まだ案件がありません"
          desc="Claude in Chrome で案件を探して応募・登録すると、ここに反映されます。"
          action={<Link href="/claude"><Button>案件を探す / 取り込む</Button></Link>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="ダッシュボード"
        desc="Claudeが自動で進めた案件の状況です。基本は眺めるだけ。詳しく見たい案件は「最近の動き」から開けます。"
        right={
          <div className="flex gap-2">
            <Link href="/claude"><Button variant="outline">案件を探す/取り込む</Button></Link>
            <Link href="/jobs"><Button variant="outline">案件一覧</Button></Link>
          </div>
        }
      />

      {/* 成果サマリ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="総案件" value={total} tone="accent" />
        <StatCard label="応募候補" value={candidates} tone="accent" />
        <StatCard label="応募済み（返信待ち）" value={appliedInFlight} tone="accent" />
        <StatCard label="受注・作業中" value={won} tone="good" />
        <StatCard label="納品済み" value={delivered} tone="good" />
        <StatCard label="今月見込み" value={yen(expected)} sub={actual ? `実売上 ${yen(actual)}` : undefined} tone="good" />
      </div>

      {/* 稼ぎ・時給換算 */}
      <div className="mt-6">
        <Card title="稼ぎ・時給換算" desc="納品済み案件の実績ベース（実売上が未入力なら予算で概算）">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="納品済み売上" value={yen(earned)} sub={actual ? `うち確定 ${yen(actual)}` : undefined} tone="good" />
            <StatCard label="納品済み件数" value={delivered} tone="good" />
            <StatCard
              label="平均時給（換算）"
              value={avgHourly ? `¥${avgHourly.toLocaleString("ja-JP")}/h` : "—"}
              sub={avgHourly ? "見積工数ベース" : "納品が出ると表示"}
              tone={avgHourly >= 2500 ? "good" : avgHourly > 0 ? "warn" : "accent"}
            />
            <StatCard
              label="ツール削減時間（見込）"
              value={`${savedHours.toFixed(1)}h`}
              sub="自作ツールでの短縮"
              tone="accent"
            />
          </div>
        </Card>
      </div>

      {/* 応募した案件 */}
      <div className="mt-6">
        <Card
          title={`応募した案件（${appliedList.length}件）`}
          desc="実際に応募した案件だけを表示（候補・見送り・地雷は除く）。クリックで詳細を確認できます"
        >
          {appliedList.length === 0 ? (
            <EmptyState title="応募した案件はまだありません" desc="Claude in Chrome が応募すると、ここに表示されます。" />
          ) : (
          <div className="divide-y divide-border">
            {appliedList.map((j) => (
              <Link
                key={j.id}
                href={`/jobs/${j.id}`}
                className="flex items-center gap-3 px-1 py-2.5 transition hover:bg-white/[0.03]"
              >
                <Badge className={statusColor(j.status)}>{STATUS_LABEL[j.status]}</Badge>
                <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-200">{j.title}</span>
                {j.analysis && (
                  <Badge className={labelColor(j.analysis.label)}>{LABEL_TEXT[j.analysis.label]}</Badge>
                )}
                <span className="hidden shrink-0 text-[11px] text-muted sm:inline">{PLATFORM_LABEL[j.platform]}</span>
                <span className="w-16 shrink-0 text-right text-[12px] tabular-nums text-zinc-300">{yen(j.budget)}</span>
                <span className="w-10 shrink-0 text-right text-[10px] text-muted">{fmtDate(j.updatedAt)}</span>
              </Link>
            ))}
          </div>
          )}
        </Card>
      </div>
    </>
  );
}
