"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { useDB, actions } from "@/lib/store";
import {
  Card,
  PageHeader,
  StatCard,
  Field,
  Input,
  Select,
  ScoreBar,
  EmptyState,
  Button,
  cn,
} from "@/components/ui";
import {
  STATUS_LABEL,
  STATUS_ORDER,
  statusColor,
  PLATFORM_LABEL,
  CATEGORY_LABEL,
  BUDGET_TYPE_LABEL,
  yen,
  scoreTone,
  riskTone,
} from "@/lib/labels";
import type { Job, JobStatus } from "@/lib/types";

type SortKey = "updated" | "priority" | "risk" | "budget";

const SHORT_BUDGET: Record<string, string> = {
  fixed: "固定",
  hourly: "時給",
  per_char: "文字単価",
  unknown: "不明",
};

function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function JobsPage() {
  const db = useDB();
  const jobs = db.jobs;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("updated");

  const total = jobs.length;
  const cnt = (f: (j: Job) => boolean) => jobs.filter(f).length;
  const toApply = cnt((j) => j.status === "to_apply");
  const applied = cnt((j) => ["applied", "replied", "negotiating"].includes(j.status));
  const won = cnt((j) =>
    ["won", "working", "draft_submitted", "revising"].includes(j.status)
  );
  const delivered = cnt((j) => ["delivered", "continuing"].includes(j.status));
  const expectedSum = jobs
    .filter((j) => !["passed", "landmine"].includes(j.status))
    .reduce((s, j) => s + (j.expectedRevenue ?? 0), 0);

  const filtered = useMemo(() => {
    let arr = jobs.filter((j) => {
      if (search && !j.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "all" && j.status !== statusFilter) return false;
      if (platformFilter !== "all" && j.platform !== platformFilter) return false;
      if (categoryFilter !== "all" && j.category !== categoryFilter) return false;
      return true;
    });
    arr = [...arr].sort((a, b) => {
      switch (sort) {
        case "priority":
          return b.scores.priority - a.scores.priority;
        case "risk":
          return b.scores.risk - a.scores.risk;
        case "budget":
          return (b.budget ?? 0) - (a.budget ?? 0);
        case "updated":
        default:
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
    });
    return arr;
  }, [jobs, search, statusFilter, platformFilter, categoryFilter, sort]);

  return (
    <>
      <PageHeader
        title="案件"
        desc="案件のステータス・優先度・収益を一覧で管理。案件名をクリックすると、解析・提案・納品などのタブが入った詳細ページが開きます。"
        right={
          <div className="flex gap-2">
            <Link href="/claude">
              <Button>＋ 案件を探す / 取り込む</Button>
            </Link>
            <Link href="/scout">
              <Button variant="outline">手動で登録</Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="総案件数" value={total} tone="accent" />
        <StatCard label="応募予定" value={toApply} tone="accent" />
        <StatCard label="応募済み" value={applied} tone="accent" />
        <StatCard label="受注" value={won} tone="good" />
        <StatCard label="納品済み" value={delivered} tone="good" />
        <StatCard label="想定売上合計" value={yen(expectedSum)} tone="good" />
      </div>

      <Card className="mt-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="検索（案件名）">
            <Input
              value={search}
              placeholder="案件名で絞り込み"
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
          <Field label="ステータス">
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">すべて</option>
              {STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="媒体">
            <Select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
              <option value="all">すべて</option>
              {Object.entries(PLATFORM_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="カテゴリ">
            <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="all">すべて</option>
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="並び替え">
            <Select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="updated">更新日</option>
              <option value="priority">応募優先度</option>
              <option value="risk">地雷度</option>
              <option value="budget">予算</option>
            </Select>
          </Field>
        </div>
      </Card>

      <div className="mt-6">
        {filtered.length === 0 ? (
          <EmptyState
            title="該当する案件がありません"
            desc="フィルタ条件を変更するか、スカウトから案件を登録してください。"
          />
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-white/5 text-left text-[11px] text-muted">
                    <th className="px-3 py-2.5 font-medium">案件名</th>
                    <th className="whitespace-nowrap px-3 py-2.5 font-medium">媒体</th>
                    <th className="px-3 py-2.5 font-medium">予算</th>
                    <th className="px-3 py-2.5 font-medium">納期</th>
                    <th className="px-3 py-2.5 font-medium">ステータス</th>
                    <th className="w-28 px-3 py-2.5 font-medium">応募優先度</th>
                    <th className="w-28 px-3 py-2.5 font-medium">地雷度</th>
                    <th className="w-28 px-3 py-2.5 font-medium">ツール適性</th>
                    <th className="px-3 py-2.5 font-medium">最終更新日</th>
                    <th className="px-3 py-2.5 font-medium">次のアクション</th>
                    <th className="px-3 py-2.5 font-medium">GEO余地</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((j) => (
                    <tr
                      key={j.id}
                      className="border-t border-border transition hover:bg-white/[0.03]"
                    >
                      <td className="max-w-[16rem] px-3 py-2.5">
                        <Link
                          href={`/jobs/${j.id}`}
                          className="block truncate text-left text-[13px] font-medium text-zinc-100 hover:text-accent"
                          title={j.title}
                        >
                          {j.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-block whitespace-nowrap rounded-md border border-border bg-white/5 px-2 py-0.5 text-[11px] text-muted">
                          {PLATFORM_LABEL[j.platform]}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-zinc-300">
                        {yen(j.budget)}
                        <span className="ml-1 text-muted">
                          {SHORT_BUDGET[j.budgetType] ?? BUDGET_TYPE_LABEL[j.budgetType]}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted">
                        {j.deadline || "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <Select
                          value={j.status}
                          onChange={(e) =>
                            actions.setStatus(j.id, e.target.value as JobStatus)
                          }
                          className={cn(
                            "min-w-[7rem] border px-2 py-1 text-xs",
                            statusColor(j.status)
                          )}
                        >
                          {STATUS_ORDER.map((s) => (
                            <option key={s} value={s} className="bg-card text-zinc-100">
                              {STATUS_LABEL[s]}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="mb-1 text-[10px] tabular-nums text-muted">
                          {j.scores.priority}
                        </div>
                        <ScoreBar value={j.scores.priority} tone={scoreTone(j.scores.priority)} />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="mb-1 text-[10px] tabular-nums text-muted">
                          {j.scores.risk}
                        </div>
                        <ScoreBar value={j.scores.risk} tone={riskTone(j.scores.risk)} />
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="mb-1 text-[10px] tabular-nums text-muted">
                          {j.scores.toolFit}
                        </div>
                        <ScoreBar value={j.scores.toolFit} tone={scoreTone(j.scores.toolFit)} />
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted">
                        {fmtDate(j.updatedAt)}
                      </td>
                      <td className="max-w-[12rem] px-3 py-2.5 text-xs text-accent2">
                        <span className="line-clamp-2">{j.nextAction || "—"}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs tabular-nums text-zinc-300">
                        {j.scores.geoReadiness}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
