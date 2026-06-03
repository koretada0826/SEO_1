"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "./ui";

const NAV: { href: string; label: string; icon: string; hint?: string }[] = [
  { href: "/", label: "ホーム", icon: "🏠", hint: "承認センター" },
  { href: "/jobs", label: "案件", icon: "🗂", hint: "探す・解析・提案・納品" },
  { href: "/settings", label: "設定", icon: "⚙" },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-border bg-panel">
      <div className="flex items-center gap-2.5 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-accent to-accent2 text-sm font-bold text-white">
          S
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-zinc-100">SEO Scout</p>
          <p className="text-[10px] text-muted">Workbench</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-2.5 py-2">
        {NAV.map((n) => {
          const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex items-start gap-2.5 rounded-lg px-3 py-2.5 transition",
                active
                  ? "bg-accent/15 text-zinc-50 shadow-[inset_0_0_0_1px_rgba(124,92,255,0.3)]"
                  : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
              )}
            >
              <span className="mt-0.5 w-4 text-center text-sm opacity-90">{n.icon}</span>
              <span className="leading-tight">
                <span className="block text-[13px] font-medium">{n.label}</span>
                {n.hint && <span className="mt-0.5 block text-[10px] text-muted">{n.hint}</span>}
              </span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border px-4 py-3">
        <p className="text-[10px] leading-relaxed text-muted">
          解析・提案文・SEO/GEO納品・競合・リライト・レポートは「案件」を開いた中のタブにまとまっています。
        </p>
      </div>
    </aside>
  );
}
