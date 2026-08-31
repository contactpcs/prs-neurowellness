"use client";

import type { RevenueByPurposePoint, RevenueGroupBy } from "@/lib/api/services/payments.service";

const PALETTE = ["#6366f1", "#06b6d4", "#f59e0b", "#ec4899", "#22c55e", "#a855f7", "#ef4444", "#0ea5e9"];

const PURPOSE_LABELS: Record<string, string> = {
  initial: "Initial Consultation",
  follow_up: "Follow-up",
  protocol_followup: "Protocol Follow-up",
  device_session: "Device Session",
};

function purposeLabel(purpose: string): string {
  return PURPOSE_LABELS[purpose] ?? purpose.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtMoney(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function fmtPeriodLabel(period: string, groupBy: RevenueGroupBy): string {
  const d = new Date(period);
  if (groupBy === "year") return d.toLocaleDateString("en-US", { year: "numeric" });
  if (groupBy === "month") return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("en-US", { day: "2-digit", month: "short" });
}

/** Multi-series line chart — one line per appointment_type/device_session
 * (whatever purposes are present in the range), hand-rolled SVG since this
 * project has no charting library and one chart doesn't earn adding one. */
export function RevenueLineChart({ points, groupBy }: { points: RevenueByPurposePoint[]; groupBy: RevenueGroupBy }) {
  if (points.length === 0) {
    return <div className="flex items-center justify-center h-56 text-sm text-neutral-400">No revenue in this range yet</div>;
  }

  const periods = Array.from(new Set(points.map((p) => p.period))).sort();
  const purposes = Array.from(new Set(points.map((p) => p.purpose))).sort();
  const byPurpose = new Map<string, Map<string, RevenueByPurposePoint>>();
  for (const p of points) {
    if (!byPurpose.has(p.purpose)) byPurpose.set(p.purpose, new Map());
    byPurpose.get(p.purpose)!.set(p.period, p);
  }

  const max = Math.max(...points.map((p) => p.total), 1);
  const xFor = (i: number) => (periods.length === 1 ? 50 : (i / (periods.length - 1)) * 100);
  const yFor = (total: number) => 42 - (total / max) * 38;

  const totalsByPurpose = purposes.map((purpose) => ({
    purpose,
    total: points.filter((p) => p.purpose === purpose).reduce((sum, p) => sum + p.total, 0),
  }));

  return (
    <div className="w-full">
      <svg viewBox="0 0 100 48" preserveAspectRatio="none" className="w-full h-52">
        <line x1="0" y1="42" x2="100" y2="42" stroke="currentColor" className="text-neutral-200" strokeWidth="0.3" />
        {purposes.map((purpose, pi) => {
          const series = periods.map((period, i) => {
            const point = byPurpose.get(purpose)?.get(period);
            return { x: xFor(i), y: yFor(point?.total ?? 0), point };
          });
          const color = PALETTE[pi % PALETTE.length];
          const linePath = series.map((s) => `${s.x},${s.y}`).join(" ");
          return (
            <g key={purpose}>
              <polyline points={linePath} fill="none" stroke={color} strokeWidth="0.6" strokeLinejoin="round" strokeLinecap="round" />
              {series.map((s, i) =>
                s.point ? (
                  <circle key={i} cx={s.x} cy={s.y} r="0.8" fill={color}>
                    <title>{`${purposeLabel(purpose)} · ${fmtPeriodLabel(periods[i], groupBy)}: ${fmtMoney(s.point.total)} (${s.point.payment_count})`}</title>
                  </circle>
                ) : null
              )}
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between mt-1 text-[10px] text-neutral-400">
        <span>{fmtPeriodLabel(periods[0], groupBy)}</span>
        {periods.length > 1 && <span>{fmtPeriodLabel(periods[periods.length - 1], groupBy)}</span>}
      </div>

      {/* Legend — color per purpose + its total across the whole range shown */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-neutral-100">
        {totalsByPurpose.map(({ purpose, total }, i) => (
          <div key={purpose} className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
            <span className="text-neutral-600">{purposeLabel(purpose)}</span>
            <span className="text-neutral-400">{fmtMoney(total)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
