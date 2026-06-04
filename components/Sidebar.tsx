"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDB } from "@/lib/store";
import { yen } from "@/lib/labels";
import { cn } from "./ui";
import type { Job } from "@/lib/types";

const ICONS: Record<string, React.ReactNode> = {
  home: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75"
    />
  ),
  jobs: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M20.25 14.15v4.073a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a9.765 9.765 0 0 1-5.396 0l-1.32-.377A2.25 2.25 0 0 1 9 18.223v-4.073m12-3.376a2.25 2.25 0 0 0-2.25-2.25h-1.5V5.25a2.25 2.25 0 0 0-2.25-2.25h-3a2.25 2.25 0 0 0-2.25 2.25v3.001h-1.5a2.25 2.25 0 0 0-2.25 2.25m18 0V14a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 14v-3.375m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25a2.25 2.25 0 0 0-2.25 2.25m9 5.25h.008v.008H12v-.008Z"
    />
  ),
  settings: (
    <>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.43.992a7.49 7.49 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.998 6.998 0 0 1 0-.255c-.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.28Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </>
  ),
};

const NAV: { href: string; label: string; icon: keyof typeof ICONS; hint?: string }[] = [
  { href: "/", label: "ホーム", icon: "home", hint: "ダッシュボード" },
  { href: "/jobs", label: "案件", icon: "jobs", hint: "探す・解析・提案・納品" },
  { href: "/settings", label: "設定", icon: "settings" },
];

const WORKING = ["won", "working", "draft_submitted", "revising"];
const PENDING = ["saved", "to_apply", "replied"];

export function Sidebar() {
  const path = usePathname();
  const db = useDB();
  const jobs = db.jobs;

  const pending = jobs.filter((j) => PENDING.includes(j.status)).length;
  const working = jobs.filter((j) => WORKING.includes(j.status)).length;
  const expected = jobs
    .filter((j: Job) => !["passed", "landmine", "delivered", "continuing"].includes(j.status))
    .reduce((s, j) => s + (j.expectedRevenue ?? 0), 0);

  const displayName = db.settings.displayName || "SEOディレクター";

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-border bg-gradient-to-b from-[#0f0f15] to-panel">
      {/* ブランド */}
      <div className="flex items-center gap-3 px-5 pb-4 pt-5">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent2 text-sm font-bold text-white shadow-[0_4px_16px_-4px_rgba(124,92,255,0.6)] ring-1 ring-white/10">
          S
        </div>
        <div className="leading-tight">
          <p className="text-[15px] font-semibold tracking-tight text-zinc-50">SEO Scout</p>
          <p className="text-[9px] font-medium uppercase tracking-[0.18em] text-muted">Workbench</p>
        </div>
      </div>

      {/* ナビ */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
        {NAV.map((n) => {
          const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition",
                active
                  ? "bg-accent/10 text-zinc-50 ring-1 ring-inset ring-accent/30"
                  : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100"
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-accent to-accent2 w-[3px]" />
              )}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth={1.6}
                stroke="currentColor"
                className={cn("h-[18px] w-[18px] shrink-0", active ? "text-accent" : "text-zinc-500 group-hover:text-zinc-300")}
              >
                {ICONS[n.icon]}
              </svg>
              <span className="leading-tight">
                <span className="block text-[13px] font-medium">{n.label}</span>
                {n.hint && <span className="mt-0.5 block text-[10px] text-muted">{n.hint}</span>}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* ライブ・ステータス */}
      <div className="px-3 pb-2">
        <p className="mb-2 px-2 text-[10px] font-medium uppercase tracking-wider text-zinc-600">ステータス</p>
        <div className="space-y-2 rounded-xl border border-border bg-card/60 p-3">
          <StatRow color="bg-accent" label="承認待ち" value={`${pending}件`} />
          <StatRow color="bg-warn" label="作業中" value={`${working}件`} />
          <StatRow color="bg-good" label="今月見込み" value={yen(expected)} />
        </div>
      </div>

      {/* フッター：プロフィール＋技術スタック */}
      <div className="space-y-3 border-t border-border px-3 py-3">
        <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-accent2 to-accent text-xs font-bold text-white ring-1 ring-white/10">
            {displayName.slice(0, 1)}
          </div>
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[12px] font-medium text-zinc-200">{displayName}</p>
            <p className="text-[10px] text-muted">オーナー / 個人運用</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1 px-1">
          {["Next.js", "TypeScript", "Tailwind", "Claude in Chrome"].map((t) => (
            <span
              key={t}
              className="rounded-md border border-border bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-medium text-zinc-500"
            >
              {t}
            </span>
          ))}
        </div>

        <p className="px-1 text-[10px] leading-relaxed text-zinc-600">
          クラウドソーシングSEO/GEO案件の発見・提案・納品を一気通貫で支援する自作ワークベンチ。
        </p>
      </div>
    </aside>
  );
}

function StatRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-[12px] text-zinc-400">
        <span className={cn("h-1.5 w-1.5 rounded-full", color)} />
        {label}
      </span>
      <span className="tabular-nums text-[12px] font-medium text-zinc-200">{value}</span>
    </div>
  );
}
