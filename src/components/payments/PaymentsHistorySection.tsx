"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, TrendingUp, Receipt, Users, RefreshCw, AlertTriangle, ListTree } from "lucide-react";
import { Card, CardContent, Skeleton, Badge } from "@/components/ui";
import { RevenueLineChart } from "@/components/payments/RevenueLineChart";
import {
  paymentsService,
  type PaymentHistoryDetail,
  type PaymentLogDetail,
  type PatientRevenueTotal,
  type RevenueByPurposePoint,
  type RevenueGroupBy,
} from "@/lib/api/services/payments.service";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-600",
  waived: "bg-blue-100 text-blue-700",
  refunded: "bg-neutral-200 text-neutral-600",
};

const GROUP_BY_OPTIONS: { value: RevenueGroupBy; label: string }[] = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "year", label: "Yearly" },
];

function fmtMoney(n: number): string {
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(d?: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-US", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });
}

function StatTile({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-neutral-400">
          <Icon className="h-4 w-4" />
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p className="text-xl font-bold text-neutral-900 mt-1">{value}</p>
        {sub && <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

/** Payments history + revenue analytics — shared across super-admin,
 * regional-admin, clinic-admin, and receptionist portals. Scope (which
 * clinics'/region's payments this sees) is resolved server-side from the
 * caller's role, not a prop here — there's nothing for this component to
 * get wrong by passing the wrong clinic_id. */
export function PaymentsHistorySection() {
  const [history, setHistory] = useState<PaymentHistoryDetail[]>([]);
  const [revenueByPurpose, setRevenueByPurpose] = useState<RevenueByPurposePoint[]>([]);
  const [topPatients, setTopPatients] = useState<PatientRevenueTotal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [groupBy, setGroupBy] = useState<RevenueGroupBy>("day");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [logs, setLogs] = useState<PaymentLogDetail[]>([]);
  const [logStatusFilter, setLogStatusFilter] = useState("failed");
  const [logsLoading, setLogsLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  async function load() {
    setError(null);
    try {
      const [historyRes, revenueRes, topRes] = await Promise.all([
        paymentsService.getHistory({ status: status || undefined, search: debouncedSearch || undefined, limit: 100 }),
        paymentsService.getRevenueSummaryByPurpose({ group_by: groupBy }),
        paymentsService.getPatientTotals({ limit: 8 }),
      ]);
      setHistory(historyRes);
      setRevenueByPurpose(revenueRes);
      setTopPatients(topRes);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Failed to load payments");
    }
  }

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, debouncedSearch, groupBy]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([load(), loadLogs()]);
    } finally {
      setRefreshing(false);
    }
  }

  const loadLogs = useCallback(async () => {
    try {
      setLogs(await paymentsService.getLogs({ status: logStatusFilter || undefined, limit: 100 }));
    } catch {
      setLogs([]);
    }
  }, [logStatusFilter]);

  useEffect(() => {
    setLogsLoading(true);
    loadLogs().finally(() => setLogsLoading(false));
  }, [loadLogs]);

  const totalRevenue = revenueByPurpose.reduce((sum, p) => sum + p.total, 0);
  const totalPaymentCount = revenueByPurpose.reduce((sum, p) => sum + p.payment_count, 0);
  const avgPayment = totalPaymentCount > 0 ? totalRevenue / totalPaymentCount : 0;

  const byPurposeTotals = Object.values(
    revenueByPurpose.reduce<Record<string, { purpose: string; total: number; count: number }>>((acc, p) => {
      acc[p.purpose] ??= { purpose: p.purpose, total: 0, count: 0 };
      acc[p.purpose].total += p.total;
      acc[p.purpose].count += p.payment_count;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Payments</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Who paid, how much, for what — and revenue over time.</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh"
          className="p-2.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}

      {/* Stat tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatTile icon={TrendingUp} label="Total Revenue" value={fmtMoney(totalRevenue)} sub={`Across ${GROUP_BY_OPTIONS.find((o) => o.value === groupBy)?.label.toLowerCase()} buckets shown`} />
        <StatTile icon={Receipt} label="Payments Collected" value={String(totalPaymentCount)} />
        <StatTile icon={Users} label="Avg per Payment" value={fmtMoney(avgPayment)} />
      </div>

      {/* By type — total revenue + count per appointment_type/device_session */}
      {byPurposeTotals.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {byPurposeTotals.map(({ purpose, total, count }) => (
            <Card key={purpose}>
              <CardContent className="p-3.5">
                <p className="text-[11px] font-medium text-neutral-400 capitalize truncate">{purpose.replace(/_/g, " ")}</p>
                <p className="text-base font-bold text-neutral-900 mt-0.5">{fmtMoney(total)}</p>
                <p className="text-[11px] text-neutral-400">{count} payment{count === 1 ? "" : "s"}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Revenue chart — one line per appointment_type/device_session */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-neutral-700">Revenue Over Time by Type</h2>
            <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1">
              {GROUP_BY_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setGroupBy(o.value)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                    groupBy === o.value ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <RevenueLineChart points={revenueByPurpose} groupBy={groupBy} />
        </CardContent>
      </Card>

      {/* Top patients by revenue */}
      {topPatients.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-neutral-700 mb-2">Top Patients by Revenue</h2>
          <Card>
            <div className="divide-y divide-neutral-100">
              {topPatients.map((p) => (
                <div key={p.patient_id} className="flex items-center justify-between px-5 py-3">
                  <span className="text-sm font-medium text-neutral-800">{p.patient_name ?? "Unknown patient"}</span>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-neutral-900">{fmtMoney(p.total_paid)}</span>
                    <span className="text-xs text-neutral-400 ml-2">{p.payment_count} payment{p.payment_count === 1 ? "" : "s"}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Filters + payments table */}
      <div>
        <div className="flex items-center gap-3 flex-wrap mb-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by patient…"
              className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg bg-white"
            />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white">
            <option value="">All Statuses</option>
            {["pending", "paid", "failed", "waived", "refunded"].map((s) => (
              <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </div>

        {history.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Receipt className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-neutral-600">No payments match</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <div style={{ minWidth: 1000 }}>
                <div
                  className="grid gap-3 px-5 py-2.5 bg-neutral-50 border-b border-neutral-100"
                  style={{ gridTemplateColumns: "1.3fr 1.1fr 1fr 1.1fr 0.9fr 0.8fr 1.3fr" }}
                >
                  {["Patient", "Clinic", "Doctor", "Purpose", "Amount", "Status", "Appointment"].map((h) => (
                    <span key={h} className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">{h}</span>
                  ))}
                </div>
                <div className="divide-y divide-neutral-100">
                  {history.map((p) => (
                    <div
                      key={p.payment_id}
                      className="grid gap-3 items-center px-5 py-3"
                      style={{ gridTemplateColumns: "1.3fr 1.1fr 1fr 1.1fr 0.9fr 0.8fr 1.3fr" }}
                    >
                      <p className="text-sm font-medium text-neutral-900 truncate">{p.patient_name ?? "Unknown"}</p>
                      <p className="text-xs text-neutral-600 truncate">{p.clinic_name ?? "—"}</p>
                      <p className="text-xs text-neutral-600 truncate">{p.doctor_name ? `Dr. ${p.doctor_name}` : "—"}</p>
                      <p className="text-xs text-neutral-600 capitalize truncate">{(p.purpose ?? "—").replace(/_/g, " ")}</p>
                      <div>
                        <p className="text-sm font-semibold text-neutral-900">{p.currency} {p.amount.toLocaleString("en-IN")}</p>
                        {p.base_fee_amount != null && p.platform_fee_amount != null && p.platform_fee_amount > 0 && (
                          <p className="text-[10px] text-neutral-400">{p.base_fee_amount.toLocaleString("en-IN")} + {p.platform_fee_amount.toLocaleString("en-IN")} fee</p>
                        )}
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize w-fit ${STATUS_STYLES[p.status] ?? "bg-neutral-100 text-neutral-600"}`}>
                        {p.status}
                      </span>
                      <div>
                        <p className="text-xs text-neutral-600">{fmtDate(p.appointment_date)} {p.appointment_start_time ? `· ${p.appointment_start_time.slice(0, 5)}` : ""}</p>
                        {p.appointment_status === "completed" && p.appointment_completed_at ? (
                          <p className="text-[10px] text-green-600 mt-0.5">Completed {fmtDateTime(p.appointment_completed_at)}</p>
                        ) : p.appointment_status ? (
                          <Badge>{p.appointment_status.replace(/_/g, " ")}</Badge>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Payment event log — core.payment_logs, one row per event (order
          created, webhook received, client-verify attempt, staff change),
          not per payment. This is where a failed payment's actual reason
          lives — the table above only ever shows current state. */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h2 className="text-sm font-semibold text-neutral-700 flex items-center gap-1.5">
            <ListTree className="h-4 w-4" /> Payment Event Log
          </h2>
          <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1">
            {["", "failed", "paid", "refunded", "waived", "pending"].map((s) => (
              <button
                key={s || "all"}
                onClick={() => setLogStatusFilter(s)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                  logStatusFilter === s ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                {s || "All"}
              </button>
            ))}
          </div>
        </div>

        {logsLoading ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : logs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
              <p className="text-sm font-medium text-neutral-600">
                No {logStatusFilter || ""} events{logStatusFilter ? "" : " logged"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <div style={{ minWidth: 1000 }}>
                <div
                  className="grid gap-3 px-5 py-2.5 bg-neutral-50 border-b border-neutral-100"
                  style={{ gridTemplateColumns: "1.1fr 1fr 0.8fr 0.9fr 1fr 1.6fr 1fr" }}
                >
                  {["Patient", "Clinic", "Status", "Source", "Gateway Event", "Reason", "When"].map((h) => (
                    <span key={h} className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">{h}</span>
                  ))}
                </div>
                <div className="divide-y divide-neutral-100">
                  {logs.map((l) => (
                    <div
                      key={l.log_id}
                      className="grid gap-3 items-center px-5 py-3"
                      style={{ gridTemplateColumns: "1.1fr 1fr 0.8fr 0.9fr 1fr 1.6fr 1fr" }}
                    >
                      <p className="text-sm font-medium text-neutral-900 truncate">{l.patient_name ?? "Unknown"}</p>
                      <p className="text-xs text-neutral-600 truncate">{l.clinic_name ?? "—"}</p>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize w-fit ${STATUS_STYLES[l.status] ?? "bg-neutral-100 text-neutral-600"}`}>
                        {l.status}
                      </span>
                      <p className="text-xs text-neutral-500 capitalize truncate">{l.source.replace(/_/g, " ")}</p>
                      <p className="text-xs text-neutral-500 truncate">{l.gateway_event ?? "—"}</p>
                      <div className="min-w-0">
                        {l.failure_reason ? (
                          <p className="text-xs text-red-600 truncate" title={l.failure_reason}>
                            {l.failure_code ? `[${l.failure_code}] ` : ""}{l.failure_reason}
                          </p>
                        ) : (
                          <span className="text-xs text-neutral-300">—</span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500">{fmtDateTime(l.created_at)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
