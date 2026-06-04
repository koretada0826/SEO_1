"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useDB, actions } from "@/lib/store";
import { Card, StatCard, PageHeader, Badge, Button, Input, EmptyState, cn } from "@/components/ui";
import { STATUS_LABEL, statusColor, PLATFORM_LABEL, yen } from "@/lib/labels";
import type { Job, AppSettings } from "@/lib/types";

const APPLIED = ["applied", "negotiating", "replied"];
const WORKING = ["won", "working", "draft_submitted", "revising"];
const DONE = ["delivered", "continuing"];
const ALL_LIVE = [...APPLIED, ...WORKING, ...DONE];

function fmtDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : `${d.getMonth() + 1}/${d.getDate()}`;
}
function isLowValue(j: Job): boolean {
  if (j.budgetType === "per_char" && j.budget > 0 && j.budget < 0.7) return true;
  if (j.budgetType !== "per_char" && j.budget > 0 && j.budget < 2000) return true;
  return false;
}

const FILTERS: { key: string; label: string; match: (j: Job) => boolean }[] = [
  { key: "live", label: "応募した案件", match: (j) => ALL_LIVE.includes(j.status) },
  { key: "reply", label: "要対応（返信）", match: (j) => ["replied", "negotiating"].includes(j.status) },
  { key: "won", label: "受注・作業中", match: (j) => WORKING.includes(j.status) },
  { key: "done", label: "納品済み", match: (j) => DONE.includes(j.status) },
];

export default function Home() {
  const db = useDB();
  const jobs = db.jobs;
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("live");

  const sumExp = (st: string[]) =>
    jobs.filter((j) => st.includes(j.status)).reduce((s, j) => s + (j.expectedRevenue ?? 0), 0);
  const moneyApplied = sumExp(APPLIED);
  const moneyWorking = sumExp(WORKING);
  const moneyDone = jobs
    .filter((j) => DONE.includes(j.status))
    .reduce((s, j) => s + (j.actualRevenue || j.expectedRevenue || j.budget || 0), 0);

  const list = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter) ?? FILTERS[0];
    let r = jobs.filter(f.match);
    const kw = q.trim();
    if (kw) r = r.filter((j) => j.title.includes(kw));
    return r.slice().sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  }, [jobs, filter, q]);

  const notifEnabled = db.settings.notificationsEnabled;
  const enableNotif = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission === "granted") {
      actions.updateSettings({ notificationsEnabled: true } as Partial<AppSettings>);
      return;
    }
    const res = await Notification.requestPermission();
    if (res === "granted") {
      actions.updateSettings({ notificationsEnabled: true } as Partial<AppSettings>);
      new Notification("通知をオンにしました", { body: "返信・受注などで知らせます" });
    }
  };

  if (jobs.length === 0) {
    return (
      <>
        <PageHeader title="案件" desc="Claude in Chrome で応募すると、自動でここに表示されます。" />
        <EmptyState
          title="まだ案件がありません"
          action={<Link href="/claude"><Button>案件を探す / 取り込む</Button></Link>}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="案件"
        desc="応募した案件と進捗・お金の状況。クリックで詳細。"
        right={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => actions.syncNow()}>↻ 更新</Button>
            <Link href="/claude"><Button>案件を探す / 取り込む</Button></Link>
          </div>
        }
      />

      {/* 通知オン（要対応時に知らせる） */}
      {!notifEnabled && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">
          <p className="text-xs text-zinc-300">
            🔔 返信・条件交渉・受注など<strong className="text-zinc-100">あなたの対応が必要なとき</strong>に通知します。
          </p>
          <Button onClick={enableNotif} className="shrink-0 px-3 py-1.5 text-xs">通知をオンにする</Button>
        </div>
      )}

      {/* お金の管理 */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="見込み（応募中）" value={yen(moneyApplied)} sub="返信待ち・交渉中" tone="accent" />
        <StatCard label="進行中（受注）" value={yen(moneyWorking)} sub="受注〜作業中" tone="warn" />
        <StatCard label="確定売上（納品）" value={yen(moneyDone)} sub="納品済み" tone="good" />
      </div>

      {/* 一覧 */}
      <div className="mt-5">
        <Card className="p-0">
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
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="案件名で検索"
              className="ml-auto h-8 w-44 py-1 text-xs"
            />
          </div>

          {list.length === 0 ? (
            <EmptyState title="該当する案件はありません" />
          ) : (
            <div className="divide-y divide-border">
              {list.map((j) => {
                const low = isLowValue(j);
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
                        <Badge className="shrink-0 border-warn/40 bg-warn/10 text-warn" title="単価が低い案件">⚠ 安い</Badge>
                      )}
                    </span>
                    <span className="hidden w-24 shrink-0 text-[11px] text-muted sm:block">{PLATFORM_LABEL[j.platform]}</span>
                    <span className="w-20 shrink-0 text-right text-[12px] tabular-nums text-zinc-300">{yen(j.budget)}</span>
                    <span className="w-9 shrink-0 text-right text-[10px] text-muted">{fmtDate(j.updatedAt)}</span>
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
