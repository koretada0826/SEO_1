"use client";
import React from "react";

export function cn(...xs: (string | false | null | undefined)[]) {
  return xs.filter(Boolean).join(" ");
}

export function Card({
  children,
  className,
  title,
  desc,
  right,
}: {
  children?: React.ReactNode;
  className?: string;
  title?: React.ReactNode;
  desc?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-card shadow-card", className)}>
      {(title || right) && (
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
          <div>
            {title && <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>}
            {desc && <p className="mt-0.5 text-xs text-muted">{desc}</p>}
          </div>
          {right}
        </div>
      )}
      <div className={cn(title || right ? "p-5" : "p-5")}>{children}</div>
    </div>
  );
}

type BtnVariant = "primary" | "ghost" | "outline" | "danger" | "subtle";
export function Button({
  children,
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  const variants: Record<BtnVariant, string> = {
    primary:
      "bg-accent text-white hover:bg-accent/90 border border-accent/60 shadow-[0_0_0_1px_rgba(124,92,255,0.2)]",
    outline: "border border-border bg-white/5 text-zinc-200 hover:bg-white/10",
    ghost: "text-zinc-300 hover:bg-white/5",
    subtle: "bg-accent2/15 text-accent2 border border-accent2/30 hover:bg-accent2/25",
    danger: "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  // 子の入力欄に aria-label / name を自動付与し、Claude in Chrome や
  // スクリーンリーダーがラベル名で各欄を識別・記入できるようにする。
  const child = React.isValidElement(children)
    ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
        "aria-label": (children.props as Record<string, unknown>)["aria-label"] ?? label,
        name: (children.props as Record<string, unknown>).name ?? label,
      })
    : children;
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-zinc-300">{label}</span>
      {child}
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}

const inputBase =
  "w-full rounded-lg border border-border bg-bg/60 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20 transition";

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputBase, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputBase, "resize-y leading-relaxed", props.className)} />;
}

export function Select({
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...props} className={cn(inputBase, "appearance-none pr-8", props.className)}>
      {children}
    </select>
  );
}

export function ScoreBar({
  value,
  tone = "neutral",
}: {
  value: number;
  tone?: "good" | "warn" | "danger" | "neutral";
}) {
  const color =
    tone === "good"
      ? "bg-good"
      : tone === "warn"
      ? "bg-warn"
      : tone === "danger"
      ? "bg-danger"
      : "bg-accent";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/5">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.max(2, value)}%` }} />
    </div>
  );
}

export function ScoreRing({
  value,
  size = 56,
  label,
  tone = "neutral",
}: {
  value: number;
  size?: number;
  label?: string;
  tone?: "good" | "warn" | "danger" | "neutral";
}) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  const color =
    tone === "good" ? "#22c55e" : tone === "warn" ? "#f59e0b" : tone === "danger" ? "#ef4444" : "#7c5cff";
  return (
    <div className="relative inline-flex flex-col items-center" style={{ width: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.07)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute top-1/2 -translate-y-1/2 text-sm font-semibold text-zinc-100" style={{ lineHeight: 1 }}>
        {value}
      </span>
      {label && <span className="mt-1 text-[10px] text-muted">{label}</span>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "good" | "warn" | "danger" | "accent";
}) {
  const ring =
    tone === "good"
      ? "before:bg-good"
      : tone === "warn"
      ? "before:bg-warn"
      : tone === "danger"
      ? "before:bg-danger"
      : "before:bg-accent";
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-card",
        "before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:content-['']",
        ring
      )}
    >
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-50">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

export function EmptyState({
  title,
  desc,
  action,
}: {
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-12 text-center">
      <p className="text-sm font-medium text-zinc-300">{title}</p>
      {desc && <p className="mt-1 max-w-md text-xs text-muted">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  desc,
  right,
}: {
  title: string;
  desc?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-50">{title}</h1>
        {desc && <p className="mt-1 max-w-2xl text-[13px] text-muted">{desc}</p>}
      </div>
      {right}
    </div>
  );
}

export function SectionTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="mb-3">
      <h2 className="text-sm font-semibold text-zinc-100">{children}</h2>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function CopyButton({ text, label = "コピー" }: { text: string; label?: string }) {
  const [done, setDone] = React.useState(false);
  return (
    <Button
      variant="outline"
      className="px-2.5 py-1 text-xs"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        } catch {
          /* ignore */
        }
      }}
    >
      {done ? "✓ コピーしました" : label}
    </Button>
  );
}
