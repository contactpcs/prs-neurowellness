"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Search, Eye } from "lucide-react";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { STATUS_LABEL, STATUS_TONE, isSupersededCancellation } from "@/lib/appointmentStatus";
import type { Appointment, AppointmentStatus } from "@/types/domain.types";

// ─── Constants ────────────────────────────────────────────────────────────────

// "device_sessions"/"follow_up"/"protocol_followup" are type filters, not
// status ones — a device session has no treating doctor (scheduling/service.py)
// and is run by a clinical assistant, not started/completed from here, so it
// lives in its own filter rather than mixed into the regular status list;
// follow_up/protocol_followup are likewise filtered by appointment_type so a
// doctor can isolate those visit kinds regardless of their current status.
type FilterValue = AppointmentStatus | "all" | "device_sessions" | "follow_up" | "protocol_followup";

const STATUS_FILTERS: FilterValue[] = [
  "all", "follow_up", "protocol_followup", "paid", "checked_in", "in_progress", "completed", "cancelled", "device_sessions",
];

function filterLabel(f: FilterValue): string {
  if (f === "all") return "All";
  if (f === "device_sessions") return "Device Sessions";
  if (f === "follow_up") return "Follow-up";
  if (f === "protocol_followup") return "Protocol Follow-up";
  return STATUS_LABEL[f];
}

function humanize(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function StatusPill({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${STATUS_TONE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt12(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Field (detail card) ───────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-neutral-900 mt-0.5">{value}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DoctorAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [status,       setStatus]       = useState<FilterValue>("all");
  const [q,            setQ]            = useState("");
  const [dateFrom,     setDateFrom]     = useState("");
  const [dateTo,       setDateTo]       = useState("");
  const [selId,        setSelId]        = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiClient.get(ENDPOINTS.APPOINTMENTS.LIST, { params: { limit: 200 } });
      setAppointments(Array.isArray(data) ? data : []);
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  useEffect(() => {
    const onAppointmentEvent = () => fetchAppointments();
    window.addEventListener("sse:appointment", onAppointmentEvent);
    return () => window.removeEventListener("sse:appointment", onAppointmentEvent);
  }, [fetchAppointments]);

  const filtered = useMemo(() => {
    const query = q.toLowerCase();
    return [...appointments]
      .filter((a) => !isSupersededCancellation(a))
      .filter((a) => {
        if (status === "device_sessions") return a.appointment_type === "device_session";
        if (status === "follow_up") return a.appointment_type === "follow_up";
        if (status === "protocol_followup") return a.appointment_type === "protocol_followup";
        return a.appointment_type !== "device_session" && (status === "all" || a.status === status);
      })
      .filter((a) => !query || `${a.appointment_id} ${a.patient_name ?? ""} ${a.appointment_type ?? ""}`.toLowerCase().includes(query))
      // appointment_date is already a plain "YYYY-MM-DD" string (see
      // fmtDate above) — lexicographic comparison sorts/bounds it correctly
      // without parsing into a Date, and sidesteps timezone drift entirely.
      .filter((a) => !dateFrom || (a.appointment_date || "") >= dateFrom)
      .filter((a) => !dateTo || (a.appointment_date || "") <= dateTo)
      .sort((a, b) => {
        // Date-wise then time-wise, chronological (soonest first) — was
        // sorting newest-date-first, which mixed dates and times in a way
        // that didn't read as a straightforward schedule.
        const dc = (a.appointment_date || "").localeCompare(b.appointment_date || "");
        return dc !== 0 ? dc : (a.start_time || "").localeCompare(b.start_time || "");
      });
  }, [appointments, status, q, dateFrom, dateTo]);

  useEffect(() => {
    if (!selId && filtered.length > 0) setSelId(filtered[0].appointment_id);
  }, [filtered, selId]);

  const sel = filtered.find((a) => a.appointment_id === selId) ?? filtered[0] ?? null;
  const locked = sel ? ["completed", "cancelled"].includes(sel.status) : false;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Appointments</h1>
      </div>

      {/* search + status filters */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="relative flex-[0_1_300px] min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search patient, appointment ID…"
            className="w-full h-[38px] pl-8 pr-3 rounded-lg border border-neutral-300 bg-white text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            max={dateTo || undefined}
            className="h-[38px] px-2.5 rounded-lg border border-neutral-300 bg-white text-sm text-neutral-700 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
          <span className="text-xs text-neutral-400">to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            min={dateFrom || undefined}
            className="h-[38px] px-2.5 rounded-lg border border-neutral-300 bg-white text-sm text-neutral-700 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="h-[38px] px-2.5 rounded-lg text-xs font-medium text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={
              status === s
                ? "h-8 px-3.5 rounded-full text-[11.5px] font-medium bg-brand-gradient text-white"
                : "h-8 px-3.5 rounded-full text-[11.5px] font-medium bg-neutral-100 text-neutral-600"
            }
          >
            {filterLabel(s)}
          </button>
        ))}
      </div>

      {/* selected appointment detail */}
      {sel && (
        <div className="bg-white rounded-xl border border-neutral-200/80 shadow-card overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-100">
            <h3 className="text-[13px] font-semibold text-neutral-900">
              Appointment Details · {sel.appointment_id.slice(0, 8)}
            </h3>
            <StatusPill status={sel.status} />
          </div>
          <div className="p-5 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-neutral-900">{sel.patient_name ?? "Patient"}</h2>
                  <Link href={`/doctor/patients/${sel.patient_public_id ?? sel.patient_id}`}>
                    <Eye className="w-3.5 h-3.5 text-neutral-400 hover:text-neutral-600 transition-colors" />
                  </Link>
                </div>
                <p className="text-xs text-neutral-500 mt-1 capitalize">{(sel.appointment_type ?? "").replace(/_/g, " ")}</p>
                <p className="text-sm font-semibold text-neutral-700 mt-2">{fmtDate(sel.appointment_date)} · {fmt12(sel.start_time)}</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Link href={`/doctor/appointments/${sel.appointment_id}`}>
                  <button className="h-9 px-4 rounded-lg bg-action-orange text-white text-xs font-semibold hover:bg-action-orange-dark transition-colors">
                    {sel.status === "checked_in" ? "Start Visit" : "View Patient"}
                  </button>
                </Link>
                {!locked && (
                  <Link href={`/doctor/appointments/${sel.appointment_id}`}>
                    <button className="h-9 px-3.5 rounded-lg border border-neutral-300 bg-white text-neutral-600 text-xs font-medium hover:bg-neutral-50 transition-colors">
                      Manage
                    </button>
                  </Link>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-neutral-100">
              <Field label="Reason" value={sel.reason || "—"} />
              <Field label="Booked By" value={humanize(sel.booked_by_role || "—")} />
              <Field label="Created" value={sel.created_at ? new Date(sel.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"} />
              <Field label="Notes" value={sel.notes || "—"} />
            </div>
          </div>
        </div>
      )}

      {/* table */}
      <div className="bg-white rounded-xl border border-neutral-200/80 shadow-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-neutral-200 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <p className="text-sm font-medium text-neutral-400">No appointments match</p>
            <p className="text-xs text-neutral-300 mt-1">Adjust the search, date range, or status filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 780 }}>
              <div className="grid gap-3 px-5 py-2.5 bg-neutral-50 border-b border-neutral-100" style={{ gridTemplateColumns: "1fr 1.3fr 1.1fr 1.6fr 1fr" }}>
                {["Date / Time", "Patient", "Type", "Reason", "Status"].map((h) => (
                  <span key={h} className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">{h}</span>
                ))}
              </div>
              {filtered.map((a) => (
                <div
                  key={a.appointment_id}
                  onClick={() => setSelId(a.appointment_id)}
                  className={`grid gap-3 items-center px-5 py-3 border-b border-neutral-100 last:border-0 cursor-pointer ${selId === a.appointment_id ? "bg-primary-50" : "bg-white"}`}
                  style={{ gridTemplateColumns: "1fr 1.3fr 1.1fr 1.6fr 1fr" }}
                >
                  <div>
                    <p className="text-[12.5px] font-semibold text-neutral-800">{fmtDate(a.appointment_date)}</p>
                    <p className="text-[11px] text-neutral-400">{fmt12(a.start_time)}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900 truncate">{a.patient_name ?? "Patient"}</p>
                  </div>
                  <p className="text-xs text-neutral-700 capitalize truncate">{(a.appointment_type ?? "").replace(/_/g, " ")}</p>
                  <p className="text-xs text-neutral-600 truncate">{a.reason ?? "—"}</p>
                  <StatusPill status={a.status} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
