"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useDB } from "@/lib/store";
import { Card, StatCard, PageHeader, Badge, Button, Input, Select, EmptyState, cn } from "@/components/ui";
import { STATUS_LABEL, statusColor, PLATFORM_LABEL, yen } from "@/lib/labels";
import type { Job } from "@/lib/types";

const WORKING = ["won", "working", "draft_submitted", "revising"];
const APPLIED_PLUS = [
  "applied", "negotiating", "replied",
  "won", "working", "draft_submitted", "revising",
  "delivered", "continuing",
];

function fmtDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : `${d.getMonth() + 1}/${d.getDate()}`;
}

// 安すぎ／罠っぽい案件（＝本来は応募すべきでない）の判定
function isLowValue(j: Job): boolean {
  if ((j.scores?.risk ?? 0) >= 65) return true;
  if (j.analysis?.label === "landmine" || j.analysis?.label === "pass") return true;
  if (j.budgetType === "per_char" && j.budget > 0 && j.budget < 0.8) return true;
  if (j.budgetType !== "per_char" && j.budget > 0 && j.budget < 3000) return true;
  return false;
}

const FILTERS: { key: string; label: string; match: (j: Job) => boolean }[] = [
  { key: "applied", label: "応募した案件", match: (j) => APPLIED_PLUS.includes(j.status) },
  { key: "all", label: "すべて", match: () => true },
  { key: "reply", label: "返信あり", match: (j) => j.status === "replied" },
  { key: "won", label: "受注・作業中", match: (j) => WORKING.includes(j.status) },
  { key: "delivered", label: "納品済み", match: (j) => ["delivered", "continuing"].includes(j.status) },
  { key: "candidate", label: "応募候補", match: (j) => j.status === "to_apply" },
];

export default function Home() {
  const db = useDB();
  const jobs = db.jobs;
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("applied");
  const [sort, setSort] = useState("updated");

  const c = (f: (j: Job) => boolean) => jobs.filter(f).length;
  const applied = c((j) => APPLIED_PLUS.includes(j.status));
  const won = c((j) => WORKING.includes(j.status));
  const delivered = c((j) => ["delivered", "continuing"].includes(j.status));
  const expected = jobs
    .filter((j) => !["passed", "landmine", "delivered", "continuing"].includes(j.status))
    .reduce((s, j) => s + (j.expectedRevenue ?? 0), 0);

  const deliveredJobs = jobs.filter((j) => ["delivered", "continuing"].includes(j.status));
  const earned = deliveredJobs.reduce((s, j) => s + (j.actualRevenue || j.expectedRevenue || j.budget || 0), 0);
  const earnedHours = deliveredJobs.reduce(
    (s, j) => s + (j.analysis?.time?.withRevisionHours ?? j.analysis?.time?.normalHours ?? 0), 0);
  const avgHourly = earnedHours > 0 ? Math.round(earned / earnedHours) : 0;

  const list = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) ?? FILTERS[0];
    let r = jobs.filter(f.match);
    const kw = q.trim();
    if (kw) r = r.filter((j) => j.title.includes(kw));
    r = r.slice().sort((a, b) => {
      if (sort === "budget_desc") return (b.budget || 0) - (a.budget || 0);
      if (sort === "budget_asc") return (a.budget || 0) - (b.budget || 0);
      return (b.updatedAt || "").localeCompare(a.updatedAt || "");
    });
    return r;
  }, [jobs, filter, q, sort]);

  if (jobs.length === 0) {
    return (
      <>
        <PageHeader title="SEO Scout" desc="Claudeが案件を取り込むと、ここに表示されます。" />
        <EmptyState
          title="まだ案件がありません"
          desc="Claude in Chrome で案件を探して応募すると、自動でここに反映されます。"
          action={<Link href="/claude"><Button>案件を探す / 取り込む</Button></Link>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="案件ダッシュボード"
        desc="Claudeが進めた案件の状況と一覧。基本は眺めるだけでOK。案件名をクリックで詳細（解析・提案・納品）。"
        right={<Link href="/claude"><Button>案件を探す / 取り込む</Button></Link>}
      />

      {/* 成果サマリ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="応募した案件" value={applied} tone="accent" />
        <StatCard label="受注・作業中" value={won} tone="good" />
        <StatCard label="納品済み" value={delivered} tone="good" />
        <StatCard label="今月見込み" value={yen(expected)} tone="good" />
        <StatCard
          label="平均時給（換算）"
          value={avgHourly ? `¥${avgHourly.toLocaleString("ja-JP")}/h` : "—"}
          sub={avgHourly ? undefined : "納品が出ると表示"}
          tone={avgHourly >= 2500 ? "good" : avgHourly > 0 ? "warn" : "accent"}
        />
      </div>

      {/* フィルタ＋一覧 */}
      <div className="mt-6">
        <Card className="p-0">
          {/* フィルタバー */}
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                    filter === f.key
                      ? "bg-accent/15 text-zinc-50 ring-1 ring-inset ring-accent/40"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="案件名で検索"
                className="h-8 w-40 py-1 text-xs"
              />
              <Select value={sort} onChange={(e) => setSort(e.target.value)} className="h-8 w-28 py-1 text-xs">
                <option value="updated">更新が新しい順</option>
                <option value="budget_desc">予算が高い順</option>
                <option value="budget_asc">予算が低い順</option>
              </Select>
            </div>
          </div>

          {/* 一覧 */}
          {list.length === 0 ? (
            <EmptyState title="該当する案件はありません" desc="フィルタや検索条件を変えてみてください。" />
          ) : (
            <div className="divide-y divide-border">
              <div className="flex items-center gap-3 px-4 py-2 text-[10px] uppercase tracking-wider text-zinc-600">
                <span className="w-20 shrink-0">状態</span>
                <span className="flex-1">案件名</span>
                <span className="hidden w-24 shrink-0 sm:block">媒体</span>
                <span className="w-20 shrink-0 text-right">予算</span>
                <span className="w-10 shrink-0 text-right">更新</span>
              </div>
              {list.map((j) => {
                const low = isLowValue(j) && APPLIED_PLUS.includes(j.status);
                return (
                  <Link
                    key={j.id}
                    href={`/jobs/${j.id}`}
                    className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]"
                  >
                    <span className="w-20 shrink-0">
                      <Badge className={statusColor(j.status)}>{STATUS_LABEL[j.status]}</Badge>
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate text-[13px] text-zinc-100">{j.title}</span>
                      {low && (
                        <Badge className="shrink-0 border-warn/40 bg-warn/10 text-warn" title="安い/見送り基準。辞退を検討">
                          ⚠ 安い
                        </Badge>
                      )}
                    </span>
                    <span className="hidden w-24 shrink-0 text-[11px] text-muted sm:block">{PLATFORM_LABEL[j.platform]}</span>
                    <span className="w-20 shrink-0 text-right text-[12px] tabular-nums text-zinc-300">{yen(j.budget)}</span>
                    <span className="w-10 shrink-0 text-right text-[10px] text-muted">{fmtDate(j.updatedAt)}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
