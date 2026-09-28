"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { RevenueByPurposePoint, RevenueGroupBy } from "@/lib/api/services/payments.service";
import {
  fillPeriods,
  fmtMoney,
  fmtMoneyCompact,
  fmtPeriod,
  niceTicks,
  periodKey,
  purposeColor,
  purposeLabel,
  sortPurposes,
} from "./revenueViz";

// Chart chrome (dataviz reference ink/hairline tokens, light surface).
const INK_MUTED = "#898781";
const GRID = "#e1e0d9";
const BASELINE = "#c3c2b7";

const PLOT_H = 220;
const AXIS_H = 26;
const Y_AXIS_W = 52;
const TOP_PAD = 18; // room for the latest-period total label on its cap
const GAP = 2; // surface gap between stacked segments
const RADIUS = 4;

type Column = {
  key: string;
  total: number;
  count: number;
  segments: { purpose: string; total: number; count: number }[];
};

/** Stacked columns: one column per period (height = total revenue), split by
 * service type. Answers both "how is revenue trending" and "what is it made
 * of" in one read — the old per-type line chart made readers add lines in
 * their head. Hand-rolled SVG: this project has no charting library. */
export function RevenueOverTimeChart({ points, groupBy }: { points: RevenueByPurposePoint[]; groupBy: RevenueGroupBy }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const [view, setView] = useState<"chart" | "table">("chart");

  const hasData = points.length > 0;
  // Re-attach whenever the measured node (re)mounts: first data arrival, or
  // switching back from the table view.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [view, hasData]);

  const { purposes, columns, legend, grandTotal } = useMemo(() => {
    const purposes = sortPurposes(Array.from(new Set(points.map((p) => p.purpose))));
    const byKey = new Map<string, Map<string, RevenueByPurposePoint>>();
    for (const p of points) {
      const k = periodKey(p.period);
      if (!byKey.has(k)) byKey.set(k, new Map());
      byKey.get(k)!.set(p.purpose, p);
    }
    const columns: Column[] = fillPeriods(Array.from(byKey.keys()), groupBy).map((key) => {
      const row = byKey.get(key);
      const segments = purposes.map((purpose) => ({
        purpose,
        total: Number(row?.get(purpose)?.total ?? 0),
        count: row?.get(purpose)?.payment_count ?? 0,
      }));
      return {
        key,
        segments,
        total: segments.reduce((s, x) => s + x.total, 0),
        count: segments.reduce((s, x) => s + x.count, 0),
      };
    });
    const grandTotal = columns.reduce((s, c) => s + c.total, 0);
    const legend = purposes.map((purpose) => {
      const total = points.filter((p) => p.purpose === purpose).reduce((s, p) => s + Number(p.total), 0);
      return { purpose, total, share: grandTotal > 0 ? total / grandTotal : 0 };
    });
    return { purposes, columns, legend, grandTotal };
  }, [points, groupBy]);

  if (points.length === 0) {
    return <div className="flex items-center justify-center h-56 text-sm text-neutral-400">No revenue in this range yet</div>;
  }

  const max = Math.max(...columns.map((c) => c.total), 1);
  const ticks = niceTicks(max);
  const yMax = ticks[ticks.length - 1] || 1;
  const plotW = Math.max(width - Y_AXIS_W, 0);
  const band = columns.length > 0 ? plotW / columns.length : 0;
  const barW = Math.max(2, Math.min(24, band * 0.62));
  const y = (v: number) => TOP_PAD + PLOT_H - (v / yMax) * PLOT_H;
  const labelEvery = Math.max(1, Math.ceil(columns.length / Math.max(1, Math.floor(plotW / 64))));
  const lastIdx = columns.length - 1;
  const hovered = hover != null ? columns[hover] : null;

  return (
    <div className="w-full">
      <div className="flex justify-end mb-2">
        <div className="flex items-center gap-0.5 bg-neutral-100 rounded-md p-0.5">
          {(["chart", "table"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-2 py-0.5 text-[11px] font-medium rounded capitalize transition-colors ${
                view === v ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "chart" ? (
        <div ref={wrapRef} className="relative w-full" onMouseLeave={() => setHover(null)}>
          {width > 0 && (
            <svg width={width} height={TOP_PAD + PLOT_H + AXIS_H} role="img" aria-label="Revenue over time, stacked by service type">
              {/* y gridlines + ticks */}
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={Y_AXIS_W} x2={width} y1={y(t)} y2={y(t)} stroke={t === 0 ? BASELINE : GRID} strokeWidth={1} />
                  <text x={Y_AXIS_W - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={INK_MUTED} style={{ fontVariantNumeric: "tabular-nums" }}>
                    {fmtMoneyCompact(t)}
                  </text>
                </g>
              ))}

              {columns.map((col, i) => {
                const cx = Y_AXIS_W + band * i + band / 2;
                const x0 = cx - barW / 2;
                const dim = hover != null && hover !== i;
                let acc = 0;
                const drawn = col.segments.filter((s) => s.total > 0);
                return (
                  <g key={col.key} opacity={dim ? 0.35 : 1} style={{ transition: "opacity 120ms" }}>
                    {drawn.map((seg, si) => {
                      const yBottom = y(acc);
                      acc += seg.total;
                      const yTop = y(acc);
                      const isTop = si === drawn.length - 1;
                      // 2px surface gap above every segment except the topmost.
                      const top = isTop ? yTop : yTop + GAP;
                      const h = Math.max(0, yBottom - top);
                      if (h <= 0) return null;
                      const fill = purposeColor(seg.purpose, purposes);
                      if (!isTop) return <rect key={seg.purpose} x={x0} y={top} width={barW} height={h} fill={fill} />;
                      const r = Math.min(RADIUS, barW / 2, h);
                      // Rounded data-end on top, square at the baseline side.
                      const d = `M${x0},${yBottom} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${yBottom} Z`;
                      return <path key={seg.purpose} d={d} fill={fill} />;
                    })}
                    {/* Latest period's total on its cap — the one direct label. */}
                    {i === lastIdx && col.total > 0 && (
                      <text x={cx} y={y(col.total) - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="#52514e">
                        {fmtMoneyCompact(col.total)}
                      </text>
                    )}
                    {i % labelEvery === 0 && (
                      <text x={cx} y={TOP_PAD + PLOT_H + 17} textAnchor="middle" fontSize={11} fill={INK_MUTED}>
                        {fmtPeriod(col.key, groupBy)}
                      </text>
                    )}
                    {/* Hit target: the whole band, not just the painted bar. */}
                    <rect
                      x={Y_AXIS_W + band * i}
                      y={0}
                      width={band}
                      height={TOP_PAD + PLOT_H}
                      fill="transparent"
                      tabIndex={0}
                      aria-label={`${fmtPeriod(col.key, groupBy, true)}: ${fmtMoney(col.total)}`}
                      onMouseEnter={() => setHover(i)}
                      onFocus={() => setHover(i)}
                      onBlur={() => setHover(null)}
                      style={{ outline: "none", cursor: "default" }}
                    />
                  </g>
                );
              })}
            </svg>
          )}

          {hovered && hover != null && (
            <div
              className="pointer-events-none absolute z-10 min-w-[190px] rounded-lg border border-neutral-200 bg-white px-3 py-2.5 shadow-lg"
              style={{
                top: 4,
                // Beside the column, never on top of it: right if there's room, else left.
                left: (() => {
                  const cx = Y_AXIS_W + band * hover + band / 2;
                  const right = cx + barW / 2 + 12;
                  return right + 200 <= width ? right : Math.max(cx - barW / 2 - 12 - 200, 0);
                })(),
              }}
            >
              <p className="text-[11px] font-medium text-neutral-500">{fmtPeriod(hovered.key, groupBy, true)}</p>
              <p className="text-base font-bold text-neutral-900 leading-tight">{fmtMoney(hovered.total)}</p>
              <p className="text-[11px] text-neutral-400 mb-1.5">
                {hovered.count} payment{hovered.count === 1 ? "" : "s"}
              </p>
              {hovered.total === 0 ? (
                <p className="text-xs text-neutral-400">No revenue</p>
              ) : (
                <div className="space-y-1 border-t border-neutral-100 pt-1.5">
                  {[...hovered.segments].reverse().filter((s) => s.total > 0).map((s) => (
                    <div key={s.purpose} className="flex items-center gap-2 text-xs">
                      <span className="h-0.5 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: purposeColor(s.purpose, purposes) }} />
                      <span className="font-semibold text-neutral-900">{fmtMoney(s.total)}</span>
                      <span className="text-neutral-500 truncate">{purposeLabel(s.purpose)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto max-h-80 overflow-y-auto border border-neutral-100 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-neutral-50 sticky top-0">
              <tr>
                <th className="text-left font-semibold text-neutral-500 px-3 py-2">Period</th>
                {purposes.map((p) => (
                  <th key={p} className="text-right font-semibold text-neutral-500 px-3 py-2 whitespace-nowrap">{purposeLabel(p)}</th>
                ))}
                <th className="text-right font-semibold text-neutral-700 px-3 py-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100" style={{ fontVariantNumeric: "tabular-nums" }}>
              {[...columns].reverse().filter((c) => c.total > 0).map((c) => (
                <tr key={c.key}>
                  <td className="px-3 py-1.5 text-neutral-600 whitespace-nowrap">{fmtPeriod(c.key, groupBy, true)}</td>
                  {c.segments.map((s) => (
                    <td key={s.purpose} className="px-3 py-1.5 text-right text-neutral-600">{s.total ? fmtMoney(s.total) : "—"}</td>
                  ))}
                  <td className="px-3 py-1.5 text-right font-semibold text-neutral-900">{fmtMoney(c.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend — swatch per type + its total and share of the range. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-2 mt-4 pt-3 border-t border-neutral-100">
        {legend.map(({ purpose, total, share }) => (
          <div key={purpose} className="flex items-start gap-2 min-w-0">
            <span className="mt-1 h-2.5 w-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: purposeColor(purpose, purposes) }} />
            <div className="min-w-0">
              <p className="text-xs text-neutral-600 truncate">{purposeLabel(purpose)}</p>
              <p className="text-sm font-semibold text-neutral-900">
                {fmtMoney(total)} <span className="text-xs font-normal text-neutral-400">· {Math.round(share * 100)}%</span>
              </p>
            </div>
          </div>
        ))}
      </div>
      {grandTotal > 0 && <span className="sr-only">Total in range {fmtMoney(grandTotal)}</span>}
    </div>
  );
}
