"use client";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const PALETTE = ["#7c5cff", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#06b6d4", "#84cc16"];

const tooltipStyle = {
  background: "#131318",
  border: "1px solid #26262e",
  borderRadius: 8,
  fontSize: 12,
  color: "#e4e4e7",
};

export function MiniBar({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1c1c22" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: "#8b8b96", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#8b8b96", fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function MiniPie({ data }: { data: { name: string; value: number }[] }) {
  const filtered = data.filter((d) => d.value > 0);
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={filtered} dataKey="value" nameKey="name" innerRadius={48} outerRadius={78} paddingAngle={2}>
          {filtered.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} stroke="#0e0e12" />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function MiniArea({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 4 }}>
        <defs>
          <linearGradient id="gArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c5cff" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#7c5cff" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1c1c22" vertical={false} />
        <XAxis dataKey="name" tick={{ fill: "#8b8b96", fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#8b8b96", fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "#26262e" }} />
        <Area type="monotone" dataKey="value" stroke="#7c5cff" strokeWidth={2} fill="url(#gArea)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function Funnel({ data }: { data: { name: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={d.name}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="text-zinc-300">{d.name}</span>
            <span className="tabular-nums text-muted">{d.value}件</span>
          </div>
          <div className="h-7 overflow-hidden rounded-md bg-white/5">
            <div
              className="flex h-full items-center rounded-md px-2 text-[11px] font-medium text-white"
              style={{
                width: `${Math.max(6, (d.value / max) * 100)}%`,
                background: PALETTE[i % PALETTE.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
