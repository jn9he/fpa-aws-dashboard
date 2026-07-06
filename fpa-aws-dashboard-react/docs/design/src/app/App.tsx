import { useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  MoreHorizontal,
  Download,
  RefreshCw,
} from "lucide-react";

// ─── Data ────────────────────────────────────────────────────────────────────

const revenueData = [
  { month: "Jan", actual: 4210, budget: 4000, ly: 3780 },
  { month: "Feb", actual: 4580, budget: 4200, ly: 3950 },
  { month: "Mar", actual: 5020, budget: 4800, ly: 4400 },
  { month: "Apr", actual: 4890, budget: 5100, ly: 4600 },
  { month: "May", actual: 5340, budget: 5200, ly: 4810 },
  { month: "Jun", actual: 5780, budget: 5500, ly: 5100 },
  { month: "Jul", actual: 5560, budget: 5700, ly: 5250 },
  { month: "Aug", actual: 6120, budget: 5900, ly: 5480 },
  { month: "Sep", actual: 5980, budget: 6100, ly: 5600 },
  { month: "Oct", actual: 6450, budget: 6200, ly: 5820 },
  { month: "Nov", actual: 6890, budget: 6500, ly: 6100 },
  { month: "Dec", actual: null, budget: 6800, ly: 6300 },
];

const varianceData = [
  { name: "Revenue", variance: 420, pct: 6.8 },
  { name: "COGS", variance: -180, pct: -3.2 },
  { name: "Gross Profit", variance: 240, pct: 5.1 },
  { name: "S&M", variance: -95, pct: -4.7 },
  { name: "R&D", variance: 60, pct: 2.8 },
  { name: "G&A", variance: -30, pct: -2.1 },
  { name: "EBITDA", variance: 175, pct: 7.3 },
];

const deptData = [
  { dept: "Sales", budget: 1240, actual: 1180, fte: 48 },
  { dept: "R&D", budget: 2100, actual: 2160, fte: 84 },
  { dept: "Marketing", budget: 780, actual: 820, fte: 31 },
  { dept: "G&A", budget: 540, actual: 510, fte: 22 },
  { dept: "Operations", budget: 890, actual: 860, fte: 36 },
  { dept: "Customer Success", budget: 420, actual: 395, fte: 17 },
];

const kpis = [
  {
    label: "Revenue",
    value: "$65.8M",
    raw: 65800000,
    delta: 8.4,
    subtext: "vs $60.7M LY",
    trend: "up",
  },
  {
    label: "Gross Profit",
    value: "$42.1M",
    raw: 42100000,
    delta: 6.2,
    subtext: "64.0% margin",
    trend: "up",
  },
  {
    label: "EBITDA",
    value: "$18.3M",
    raw: 18300000,
    delta: -1.8,
    subtext: "27.8% margin",
    trend: "down",
  },
  {
    label: "Free Cash Flow",
    value: "$11.6M",
    raw: 11600000,
    delta: 14.2,
    subtext: "17.6% FCF yield",
    trend: "up",
  },
];

const PERIODS = ["Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025", "FY 2025"];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(1)}M`;
  return `$${n}K`;
}

function pctBar(actual: number, budget: number) {
  const ratio = Math.min(actual / budget, 1.4);
  const over = actual > budget;
  return { width: Math.min(ratio * 100, 100), over };
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded px-3 py-2 shadow-md text-xs font-mono">
      <p className="text-muted-foreground mb-1 font-sans text-[11px] uppercase tracking-wider">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }} className="capitalize">{p.name}</span>
          <span className="font-medium text-foreground">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KPICard({ kpi }: { kpi: (typeof kpis)[0] }) {
  const up = kpi.trend === "up";
  return (
    <div className="bg-card border border-border rounded-lg p-5 flex flex-col gap-3 hover:shadow-sm transition-shadow duration-200">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
          {kpi.label}
        </span>
        <span
          className={`flex items-center gap-1 text-[11px] font-mono px-1.5 py-0.5 rounded ${
            up
              ? "text-[#115fa0] bg-[#e8f0fa]"
              : "text-[#b03060] bg-[#f7eaf1]"
          }`}
        >
          {up ? (
            <ArrowUpRight size={11} strokeWidth={2.5} />
          ) : (
            <ArrowDownRight size={11} strokeWidth={2.5} />
          )}
          {Math.abs(kpi.delta)}%
        </span>
      </div>
      <div>
        <p
          className="text-3xl tracking-tight leading-none"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          {kpi.value}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1.5 font-mono">
          {kpi.subtext}
        </p>
      </div>
    </div>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, action }: { title: string; action?: string }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
        {title}
      </h2>
      {action && (
        <button className="text-[11px] text-muted-foreground hover:text-foreground font-mono transition-colors flex items-center gap-1">
          {action} <MoreHorizontal size={12} />
        </button>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [activePeriod, setActivePeriod] = useState("FY 2025");
  const [periodOpen, setPeriodOpen] = useState(false);

  return (
    <div
      className="min-h-screen bg-background"
      style={{ fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* ── Topbar ── */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-screen-xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-foreground rounded-sm flex items-center justify-center">
              <span className="text-[9px] text-background font-mono font-medium">FP</span>
            </div>
            <span className="text-sm font-medium tracking-tight">Meridian Capital</span>
            <span className="text-border text-sm">·</span>
            <span className="text-xs text-muted-foreground font-mono">FP&A Command Center</span>
          </div>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw size={13} />
              <span className="font-mono hidden sm:inline">Updated 9 min ago</span>
            </button>
            <button className="flex items-center gap-1.5 text-xs border border-border rounded px-3 py-1.5 hover:bg-secondary transition-colors font-mono">
              <Download size={12} />
              Export
            </button>
            {/* Period selector */}
            <div className="relative">
              <button
                onClick={() => setPeriodOpen((p) => !p)}
                className="flex items-center gap-1.5 text-xs bg-foreground text-background rounded px-3 py-1.5 font-mono hover:opacity-90 transition-opacity"
              >
                {activePeriod}
                <ChevronDown size={12} />
              </button>
              {periodOpen && (
                <div className="absolute right-0 mt-1 bg-card border border-border rounded shadow-md z-20 min-w-[120px]">
                  {PERIODS.map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        setActivePeriod(p);
                        setPeriodOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-mono hover:bg-secondary transition-colors ${
                        p === activePeriod ? "text-foreground font-medium" : "text-muted-foreground"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <main className="max-w-screen-xl mx-auto px-6 py-8">

        {/* ── Period label ── */}
        <div className="mb-6">
          <h1
            className="text-2xl leading-tight tracking-tight"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Financial Overview — {activePeriod}
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-mono">
            All figures in USD · Consolidated P&L · Management reporting basis
          </p>
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          {kpis.map((k) => (
            <KPICard key={k.label} kpi={k} />
          ))}
        </div>

        {/* ── Charts row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

          {/* Revenue vs Budget (spans 2 cols) */}
          <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
            <SectionHeader title="Revenue · Actual vs Budget vs Prior Year" action="Full view" />
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={revenueData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#000807" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#000807" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradBudget" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#115fa0" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#115fa0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(162,163,187,0.2)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 10, fontFamily: "DM Mono", fill: "#6B7280" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fontFamily: "DM Mono", fill: "#6B7280" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}M`}
                  width={44}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="ly"
                  stroke="rgba(0,8,7,0.18)"
                  strokeWidth={1.5}
                  fill="none"
                  dot={false}
                  name="prior yr"
                  strokeDasharray="4 3"
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="budget"
                  stroke="#115fa0"
                  strokeWidth={1.5}
                  fill="url(#gradBudget)"
                  dot={false}
                  name="budget"
                  connectNulls
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  stroke="#000807"
                  strokeWidth={2}
                  fill="url(#gradActual)"
                  dot={false}
                  name="actual"
                  connectNulls
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex gap-5 mt-3">
              {[
                { color: "#000807", label: "Actual", dash: false },
                { color: "#115fa0", label: "Budget", dash: false },
                { color: "rgba(162,163,187,0.7)", label: "Prior Year", dash: true },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div
                    className="w-5 h-px"
                    style={{
                      borderTop: `1.5px ${l.dash ? "dashed" : "solid"} ${l.color}`,
                    }}
                  />
                  <span className="text-[10px] font-mono text-muted-foreground">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Variance waterfall */}
          <div className="bg-card border border-border rounded-lg p-5">
            <SectionHeader title="Budget Variance · YTD" />
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={varianceData}
                layout="vertical"
                margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
                barSize={12}
              >
                <CartesianGrid strokeDasharray="2 4" stroke="rgba(162,163,187,0.2)" horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fontSize: 10, fontFamily: "DM Mono", fill: "#6B7280" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 10, fontFamily: "DM Mono", fill: "#6B7280" }}
                  axisLine={false}
                  tickLine={false}
                  width={70}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const v = payload[0].value as number;
                    return (
                      <div className="bg-card border border-border rounded px-2 py-1.5 text-xs font-mono shadow-md">
                        <p className="text-muted-foreground text-[10px]">{label}</p>
                        <p className={v >= 0 ? "text-[#115fa0]" : "text-[#b03060]"}>
                          {v >= 0 ? "+" : ""}{v}K
                        </p>
                      </div>
                    );
                  }}
                />
                <ReferenceLine x={0} stroke="rgba(162,163,187,0.4)" />
                <Bar dataKey="variance" radius={[0, 3, 3, 0]}>
                  {varianceData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.variance >= 0 ? "#115fa0" : "#b03060"}
                      opacity={0.85}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── Department P&L table ── */}
        <div className="bg-card border border-border rounded-lg p-5 mb-4">
          <SectionHeader title="Department OpEx · Budget vs Actuals" action="Drill down" />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  {["Department", "Headcount", "Budget", "Actual", "Variance", "% Used", "Status"].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left pb-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground font-normal pr-6 last:pr-0"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {deptData.map((row, i) => {
                  const variance = row.actual - row.budget;
                  const over = variance > 0;
                  const { width, over: barOver } = pctBar(row.actual, row.budget);
                  const pctUsed = ((row.actual / row.budget) * 100).toFixed(1);
                  return (
                    <tr
                      key={row.dept}
                      className={`border-b border-border last:border-0 hover:bg-secondary/50 transition-colors ${
                        i % 2 === 0 ? "" : ""
                      }`}
                    >
                      <td className="py-3 pr-6 font-medium text-foreground">{row.dept}</td>
                      <td className="py-3 pr-6 font-mono text-muted-foreground">{row.fte}</td>
                      <td className="py-3 pr-6 font-mono">{fmt(row.budget)}</td>
                      <td className="py-3 pr-6 font-mono font-medium">{fmt(row.actual)}</td>
                      <td
                        className={`py-3 pr-6 font-mono font-medium ${
                          over ? "text-[#b03060]" : "text-[#115fa0]"
                        }`}
                      >
                        {over ? "+" : "-"}
                        {fmt(Math.abs(variance))}
                      </td>
                      <td className="py-3 pr-6">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${width}%`,
                                backgroundColor: barOver ? "#b03060" : "#115fa0",
                                opacity: 0.8,
                              }}
                            />
                          </div>
                          <span className="font-mono text-[10px] text-muted-foreground">{pctUsed}%</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono ${
                            over
                              ? "bg-[#f7eaf1] text-[#b03060]"
                              : "bg-[#e8f0fa] text-[#115fa0]"
                          }`}
                        >
                          {over ? "Over" : "Under"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-foreground/10">
                  <td className="pt-3 pr-6 font-medium font-mono text-[10px] uppercase tracking-wider">
                    Total
                  </td>
                  <td className="pt-3 pr-6 font-mono text-muted-foreground">
                    {deptData.reduce((s, d) => s + d.fte, 0)}
                  </td>
                  <td className="pt-3 pr-6 font-mono font-medium">
                    {fmt(deptData.reduce((s, d) => s + d.budget, 0))}
                  </td>
                  <td className="pt-3 pr-6 font-mono font-medium">
                    {fmt(deptData.reduce((s, d) => s + d.actual, 0))}
                  </td>
                  <td className="pt-3 pr-6 font-mono font-medium text-[#115fa0]">
                    -{fmt(Math.abs(deptData.reduce((s, d) => s + (d.actual - d.budget), 0)))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ── Bottom strip — variance pct cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {varianceData.map((v) => (
            <div
              key={v.name}
              className="bg-card border border-border rounded-lg px-3 py-3 flex flex-col gap-1.5 hover:shadow-sm transition-shadow"
            >
              <span className="text-[10px] font-mono text-muted-foreground leading-none">
                {v.name}
              </span>
              <span
                className={`text-base font-mono font-medium leading-none ${
                  v.variance >= 0 ? "text-[#115fa0]" : "text-[#b03060]"
                }`}
                style={{ fontFamily: "'Instrument Serif', serif", fontSize: "1.1rem" }}
              >
                {v.pct >= 0 ? "+" : ""}
                {v.pct}%
              </span>
              <span className="text-[10px] font-mono text-muted-foreground leading-none">
                {v.variance >= 0 ? "+" : ""}
                {v.variance}K vs bgt
              </span>
            </div>
          ))}
        </div>

        {/* ── Footer ── */}
        <p className="text-[10px] font-mono text-muted-foreground mt-8 pb-4">
          Meridian Capital FP&A · Data as of Nov 30, 2025 · Internal use only · Not for distribution
        </p>
      </main>
    </div>
  );
}
