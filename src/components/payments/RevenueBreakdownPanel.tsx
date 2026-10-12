"use client";

import { useEffect, useState } from "react";
import { MapPin, Building2, Stethoscope, Layers } from "lucide-react";
import { Card, CardContent, Skeleton } from "@/components/ui";
import { paymentsService, type RevenueBreakdownRow, type RevenueDimension } from "@/lib/api/services/payments.service";
import { SERIES_COLORS, fmtMoney, purposeColor, purposeLabel } from "./revenueViz";

const DIMENSION_META: Record<RevenueDimension, { label: string; icon: React.ElementType; noun: string }> = {
  region: { label: "By region", icon: MapPin, noun: "regions" },
  clinic: { label: "By clinic", icon: Building2, noun: "clinics" },
  doctor: { label: "By doctor", icon: Stethoscope, noun: "doctors" },
  purpose: { label: "By service", icon: Layers, noun: "service types" },
};

const TOP_N = 8;

function rowLabel(row: RevenueBreakdownRow, dimension: RevenueDimension): string {
  if (dimension === "purpose") return purposeLabel(row.key ?? "other");
  if (!row.label) return dimension === "doctor" ? "Unattributed (store / no doctor)" : "Unassigned";
  return dimension === "doctor" ? `Dr. ${row.label}` : row.label;
}

/** Ranked horizontal bars: who/where the revenue comes from. Horizontal so
 * long clinic/doctor names stay readable; one hue (it's one measure) except
 * the service tab, which reuses each type's color from the time chart so the
 * two views read as one. Every value is printed — nothing hides behind hover. */
export function RevenueBreakdownPanel({
  dimensions,
  dateFrom,
}: {
  dimensions: RevenueDimension[];
  dateFrom?: string;
}) {
  const [dimension, setDimension] = useState<RevenueDimension>(dimensions[0]);
  const [rows, setRows] = useState<RevenueBreakdownRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!dimensions.includes(dimension)) setDimension(dimensions[0]);
  }, [dimensions, dimension]);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    paymentsService
      .getRevenueBreakdown({ dimension, date_from: dateFrom })
      .then((r) => !cancelled && setRows(r))
      .catch((e) => !cancelled && setError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Failed to load breakdown"));
    return () => {
      cancelled = true;
    };
  }, [dimension, dateFrom]);

  const total = (rows ?? []).reduce((s, r) => s + r.total, 0);
  const max = Math.max(...(rows ?? []).map((r) => r.total), 1);
  const visible = showAll ? rows ?? [] : (rows ?? []).slice(0, TOP_N);
  const purposeKeys = (rows ?? []).map((r) => r.key ?? "other");
  const meta = DIMENSION_META[dimension];

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-800">Where revenue comes from</h2>
            <p className="text-xs text-neutral-400 mt-0.5">Paid revenue in the selected range, largest first</p>
          </div>
          {dimensions.length > 1 && (
            <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1">
              {dimensions.map((d) => {
                const Icon = DIMENSION_META[d].icon;
                return (
                  <button
                    key={d}
                    onClick={() => {
                      setDimension(d);
                      setShowAll(false);
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                      dimension === d ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {DIMENSION_META[d].label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {error ? (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        ) : rows === null ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-8 rounded-lg" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-neutral-400">No paid revenue in this range</p>
        ) : (
          <>
            <div className="space-y-3.5" style={{ fontVariantNumeric: "tabular-nums" }}>
              {visible.map((row, i) => {
                const share = total > 0 ? row.total / total : 0;
                const color = dimension === "purpose" ? purposeColor(row.key ?? "other", purposeKeys) : SERIES_COLORS[0];
                return (
                  <div key={row.key ?? `null-${i}`} className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:grid-cols-[minmax(0,1.3fr)_minmax(0,3fr)] items-center gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-800 truncate" title={rowLabel(row, dimension)}>
                        <span className="text-neutral-400 font-normal mr-1.5">{i + 1}</span>
                        {rowLabel(row, dimension)}
                      </p>
                      <p className="text-[11px] text-neutral-400 truncate">
                        {row.parent_label ? `${row.parent_label} · ` : ""}
                        {row.payment_count} payment{row.payment_count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-1 min-w-0 h-3.5 bg-neutral-100 rounded-r">
                        <div
                          className="h-full rounded-r transition-[width] duration-500"
                          style={{ width: `${Math.max((row.total / max) * 100, 1.5)}%`, backgroundColor: color }}
                        />
                      </div>
                      <div className="w-[108px] flex-shrink-0 text-right">
                        <span className="text-sm font-semibold text-neutral-900">{fmtMoney(row.total)}</span>
                        <span className="text-xs text-neutral-400 ml-1.5">{Math.round(share * 100)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between mt-4 pt-3 border-t border-neutral-100">
              <p className="text-xs text-neutral-500">
                {rows.length} {meta.noun} · total <span className="font-semibold text-neutral-800">{fmtMoney(total)}</span>
              </p>
              {rows.length > TOP_N && (
                <button onClick={() => setShowAll((v) => !v)} className="text-xs font-medium text-indigo-600 hover:text-indigo-700">
                  {showAll ? "Show top 8" : `Show all ${rows.length}`}
                </button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
