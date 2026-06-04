"use client";
import { useState } from "react";
import Link from "next/link";
import { useDB, actions } from "@/lib/store";
import { Card, StatCard, PageHeader, Badge, Button, EmptyState } from "@/components/ui";
import { STATUS_LABEL, PLATFORM_LABEL, yen, statusColor, LABEL_TEXT, labelColor } from "@/lib/labels";
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
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - t.getTime()) / 86400000);
}
function fmtDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

type Act = { label: string; status: JobStatus; variant?: "primary" | "outline" };
interface Need {
  job: Job;
  rank: number;
  kind: string;
  kindCls: string;
  note: string;
  actions: Act[];
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

  // ── 稼ぎ・時給換算（納品済みベース） ──
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

  // ── あなたの対応が必要（普段は空） ──
  const needs: Need[] = [];
  for (const j of jobs) {
    if (["passed", "landmine", "delivered", "continuing", "applied", "negotiating"].includes(j.status)) continue;
    const dl = daysUntil(parseDeadline(j.deadline));
    if (j.status === "replied") {
      needs.push({
        job: j, rank: 0, kind: "返信あり", kindCls: "border-accent2/40 bg-accent2/10 text-accent2",
        note: "条件を確認して判断（受注 / 見送り）",
        actions: [{ label: "受注にする", status: "won", variant: "primary" }, { label: "見送り", status: "passed" }],
      });
      continue;
    }
    if (WORKING.includes(j.status) && dl != null && dl <= 3) {
      needs.push({
        job: j, rank: 1 + Math.max(0, dl), kind: dl < 0 ? "納期超過" : "納期間近",
        kindCls: "border-danger/40 bg-danger/10 text-danger",
        note: dl < 0 ? `納期${-dl}日超過` : dl === 0 ? "本日納期" : `あと${dl}日`,
        actions: j.deliverables.length ? [{ label: "納品済みにする", status: "delivered", variant: "primary" }] : [],
      });
      continue;
    }
    if (j.status === "won") {
      needs.push({
        job: j, rank: 8, kind: "受注", kindCls: "border-good/40 bg-good/10 text-good",
        note: "契約・報酬手続き／納品物の作成へ",
        actions: [],
      });
      continue;
    }
    if (WORKING.includes(j.status) && j.deliverables.length) {
      needs.push({
        job: j, rank: 9, kind: "提出待ち", kindCls: "border-good/40 bg-good/10 text-good",
        note: "納品物を確認して提出",
        actions: [{ label: "納品済みにする", status: "delivered", variant: "primary" }],
      });
      continue;
    }
    if (j.status === "to_apply") {
      needs.push({
        job: j, rank: 12, kind: "要判断", kindCls: "border-accent/40 bg-accent/10 text-accent",
        note: "Claudeが応募を保留。応募するか判断",
        actions: [{ label: "応募した", status: "applied", variant: "primary" }, { label: "見送り", status: "passed" }],
      });
    }
  }
  needs.sort((a, b) => a.rank - b.rank);

  // ── 最近の動き ──
  const recent = [...jobs]
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""))
    .slice(0, 8);

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
        desc="Claudeが進めた案件の状況です。普段は眺めるだけ。あなたの対応が必要なものだけ下に出ます。"
        right={
          <div className="flex gap-2">
            <Link href="/claude"><Button variant="outline">案件を探す/取り込む</Button></Link>
            <Link href="/jobs"><Button variant="outline">案件一覧</Button></Link>
          </div>
        }
      />

      {/* Claudeの成果 */}
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

      {/* あなたの対応が必要 */}
      <div className="mt-6">
        <Card
          title="あなたの対応が必要"
          desc={needs.length ? "Claudeだけでは進められない（あなたの判断・手続きが要る）案件" : undefined}
        >
          {needs.length ? (
            <div className="space-y-2">
              {needs.map((n) => <NeedRow key={n.job.id} n={n} />)}
            </div>
          ) : (
            <EmptyState
              title="対応が必要なことはありません 🎉"
              desc="Claudeに任せてOK。返信・受注・納期などであなたの判断が要るときだけ、ここに出ます。"
            />
          )}
        </Card>
      </div>

      {/* 最近の動き */}
      <div className="mt-6">
        <Card title="最近の動き" desc="Claudeや自分が更新した案件（新しい順）">
          <div className="divide-y divide-border">
            {recent.map((j) => (
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
        </Card>
      </div>
    </>
  );
}

// なぜClaudeだけで進められないか（判断を人間に委ねる理由）を案件データから説明する
function reasonFor(job: Job, kind: string): string {
  if (kind.startsWith("納期"))
    return "納品物を期限までに最終確認して提出する必要があります。提出の可否は品質責任を伴うため、Claudeではなくあなたの承認が必要です。";
  if (kind === "提出待ち")
    return "納品物の準備ができています。最終チェックして提出するのは品質責任が伴うため、あなたの確認が必要です。";
  if (kind === "受注")
    return "受注後の契約承認・報酬の受け取り（本人確認・口座登録・インボイス）は、あなた本人にしかできない手続きです。Claudeはここを代行できません。";
  if (kind === "返信あり")
    return "クライアントからの返信です。条件交渉や受注の可否はお金・契約が絡む判断のため、Claudeに任せず、あなたが決めます。";
  // 要判断（Claudeが応募を保留）
  const a = job.analysis;
  const reasons: string[] = [];
  if (a?.label === "landmine") reasons.push("ツール判定が『地雷注意』で、トラブルの可能性が高い");
  else if (a?.label === "pass") reasons.push("ツール判定が『見送り推奨』で、応募価値が低い可能性がある");
  if ((job.budget ?? 0) === 0) reasons.push("予算が不明で、割に合うか機械的に判断できない");
  else if (job.budgetType === "per_char" && (job.budget ?? 0) > 0 && (job.budget ?? 0) < 1)
    reasons.push(`文字単価が低い（¥${job.budget}）`);
  if (job.aiPolicy === "forbidden") reasons.push("AI使用不可で、納品方針を手作業へ切り替える必要がある");
  if (a?.riskHits?.length) reasons.push(`注意ワード「${a.riskHits.map((r) => r.word).join("・")}」を検出`);
  const base =
    "Claudeは規約に配慮し、確信が持てない案件は勝手に応募せず、あなたの判断を待ちます。";
  return reasons.length ? `${base}（理由：${reasons.join(" / ")}）` : base;
}

function NeedRow({ n }: { n: Need }) {
  const { job } = n;
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-bg/40 px-3 py-3 transition hover:border-accent/40">
      <div className="flex flex-wrap items-center gap-3">
        <Badge className={n.kindCls}>{n.kind}</Badge>
        <div className="min-w-0 flex-1">
          <Link href={`/jobs/${job.id}`} className="block">
            <p className="truncate text-[13px] font-medium text-zinc-100 hover:text-accent">{job.title}</p>
          </Link>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted">
            <Badge className="border-border bg-white/5 text-muted">{PLATFORM_LABEL[job.platform]}</Badge>
            <span>{yen(job.budget)}</span>
            <span className="text-accent2">{n.note}</span>
            <button
              onClick={() => setOpen((v) => !v)}
              className="text-muted underline decoration-dotted underline-offset-2 transition hover:text-zinc-300"
            >
              {open ? "理由を隠す" : "なぜ自分で対応？"}
            </button>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {n.actions.map((a) => (
            <Button
              key={a.label}
              variant={a.variant ?? "outline"}
              className="px-3 py-1.5 text-xs"
              onClick={() => actions.setStatus(job.id, a.status)}
            >
              {a.label}
            </Button>
          ))}
          <Link href={`/jobs/${job.id}`}>
            <Button variant="ghost" className="px-3 py-1.5 text-xs">開いて確認</Button>
          </Link>
        </div>
      </div>
      {open && (
        <p className="mt-2 rounded-md border border-border bg-white/[0.02] px-3 py-2 text-[11px] leading-relaxed text-zinc-400">
          <span className="font-medium text-zinc-300">Claudeだけで進められない理由：</span>
          {reasonFor(job, n.kind)}
        </p>
      )}
    </div>
  );
}
