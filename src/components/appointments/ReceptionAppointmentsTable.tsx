"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Printer, CalendarPlus, X, CalendarDays, Download } from "lucide-react";
import { appointmentsService } from "@/lib/api/services/appointments.service";
import { receptionService } from "@/lib/api/services/reception.service";
import { paymentsService, saveBlobAsFile } from "@/lib/api/services/payments.service";
import { STATUS_LABEL, STATUS_TONE, isSupersededCancellation } from "@/lib/appointmentStatus";
import { MockPaymentModal } from "@/components/appointments/MockPaymentModal";
import { AppointmentDetailModal } from "@/components/appointments/AppointmentDetailModal";
import type { Appointment, AppointmentStatus, AppointmentType, DoctorListItem } from "@/types/domain.types";

function StatusChip({ status }: { status: AppointmentStatus }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${STATUS_TONE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

function fmt12(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function fmtDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_FILTERS: AppointmentStatus[] = [
  "selected", "paid", "checked_in", "in_progress", "completed", "cancelled", "no_show", "missed", "rescheduled",
];

const TYPE_FILTERS: { value: AppointmentType; label: string }[] = [
  { value: "initial",           label: "Initial" },
  { value: "follow_up",         label: "Follow Up" },
  { value: "device_session",    label: "Device Session" },
  { value: "protocol_followup", label: "Protocol Follow-up" },
];

type DatePreset = "all" | "today" | "tomorrow" | "upcoming" | "past7" | "past30" | "this_month" | "custom";

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "all",        label: "All Dates" },
  { value: "today",      label: "Today" },
  { value: "tomorrow",   label: "Tomorrow" },
  { value: "upcoming",   label: "Upcoming" },
  { value: "past7",      label: "Last 7 Days" },
  { value: "past30",     label: "Last 30 Days" },
  { value: "this_month", label: "This Month" },
  { value: "custom",     label: "Custom Range" },
];

type SortKey = "date_desc" | "date_asc" | "patient_asc" | "patient_desc" | "doctor_asc" | "status" | "booked_desc" | "updated_desc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "date_desc",    label: "Date: Newest first" },
  { value: "date_asc",     label: "Date: Oldest first" },
  { value: "booked_desc",  label: "Recently booked" },
  { value: "updated_desc", label: "Recently updated" },
  { value: "patient_asc",  label: "Patient: A → Z" },
  { value: "patient_desc", label: "Patient: Z → A" },
  { value: "doctor_asc",   label: "Doctor: A → Z" },
  { value: "status",       label: "Status" },
];

/** Local-time YYYY-MM-DD — toISOString() would shift to UTC and be off by a day in IST mornings. */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function presetRange(p: DatePreset, from: string, to: string): { date_from?: string; date_to?: string } {
  const today = new Date();
  const addDays = (n: number) => { const d = new Date(today); d.setDate(d.getDate() + n); return ymd(d); };
  switch (p) {
    case "today":      return { date_from: ymd(today), date_to: ymd(today) };
    case "tomorrow":   return { date_from: addDays(1), date_to: addDays(1) };
    case "upcoming":   return { date_from: ymd(today) };
    case "past7":      return { date_from: addDays(-7), date_to: ymd(today) };
    case "past30":     return { date_from: addDays(-30), date_to: ymd(today) };
    case "this_month": return {
      date_from: ymd(new Date(today.getFullYear(), today.getMonth(), 1)),
      date_to:   ymd(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
    };
    case "custom":     return { date_from: from || undefined, date_to: to || undefined };
    default:           return {};
  }
}

const selectCls = "h-[38px] px-3 rounded-lg border border-neutral-300 bg-white text-sm text-neutral-700";

export function ReceptionAppointmentsTable({ clinicId }: { clinicId: string }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors,      setDoctors]      = useState<DoctorListItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [q,            setQ]            = useState("");
  const [doctorFilter, setDoctorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "">("");
  const [typeFilter,   setTypeFilter]   = useState<AppointmentType | "">("");
  const [datePreset,   setDatePreset]   = useState<DatePreset>("all");
  const [customFrom,   setCustomFrom]   = useState("");
  const [customTo,     setCustomTo]     = useState("");
  const [sortKey,      setSortKey]      = useState<SortKey>("date_desc");
  const [confirming,   setConfirming]   = useState<Appointment | null>(null);
  const [payingFor,    setPayingFor]    = useState<Appointment | null>(null);
  const [busy,         setBusy]         = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);

  const range = useMemo(() => presetRange(datePreset, customFrom, customTo), [datePreset, customFrom, customTo]);

  // Date range is applied server-side; every page is fetched (listAll) so the
  // list is never truncated to the oldest N rows — that truncation is what
  // hid appointments after 23 Sep 2026 once the clinic passed 200 bookings.
  const load = useCallback(async () => {
    try {
      const [apptRes, docRes] = await Promise.all([
        appointmentsService.listAll({ clinic_id: clinicId, order: "desc", ...range }),
        receptionService.getDoctors(),
      ]);
      setAppointments(apptRes.appointments);
      setDoctors(docRes.doctors);
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [clinicId, range]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  useEffect(() => {
    const onAppointmentEvent = () => load();
    window.addEventListener("sse:appointment", onAppointmentEvent);
    return () => window.removeEventListener("sse:appointment", onAppointmentEvent);
  }, [load]);

  const filtered = useMemo(() => {
    const query = q.toLowerCase();
    const byDateTime = (a: Appointment, b: Appointment) =>
      (a.appointment_date ?? "").localeCompare(b.appointment_date ?? "") || (a.start_time ?? "").localeCompare(b.start_time ?? "");
    const cmp: Record<SortKey, (a: Appointment, b: Appointment) => number> = {
      // Newest date first, but earliest slot first within a day — how the front desk reads a day.
      date_desc:    (a, b) => (b.appointment_date ?? "").localeCompare(a.appointment_date ?? "") || (a.start_time ?? "").localeCompare(b.start_time ?? ""),
      date_asc:     byDateTime,
      booked_desc:  (a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""),
      updated_desc: (a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""),
      patient_asc:  (a, b) => (a.patient_name ?? "").localeCompare(b.patient_name ?? "") || byDateTime(a, b),
      patient_desc: (a, b) => (b.patient_name ?? "").localeCompare(a.patient_name ?? "") || byDateTime(a, b),
      doctor_asc:   (a, b) => (a.doctor_name ?? "").localeCompare(b.doctor_name ?? "") || byDateTime(a, b),
      status:       (a, b) => STATUS_LABEL[a.status].localeCompare(STATUS_LABEL[b.status]) || byDateTime(a, b),
    };
    return appointments
      .filter((a) => !isSupersededCancellation(a))
      .filter((a) => !doctorFilter || a.doctor_name === doctorFilter)
      .filter((a) => !statusFilter || a.status === statusFilter)
      .filter((a) => !typeFilter || a.appointment_type === typeFilter)
      .filter((a) => !query || `${a.appointment_id} ${a.patient_name ?? ""} ${a.patient_mrn ?? ""} ${a.patient_public_id ?? ""} ${a.doctor_name ?? ""}`.toLowerCase().includes(query))
      .sort(cmp[sortKey]);
  }, [appointments, doctorFilter, statusFilter, typeFilter, q, sortKey]);

  const hasFilters = !!(q || doctorFilter || statusFilter || typeFilter || datePreset !== "all" || sortKey !== "date_desc");
  const clearFilters = () => {
    setQ(""); setDoctorFilter(""); setStatusFilter(""); setTypeFilter("");
    setDatePreset("all"); setCustomFrom(""); setCustomTo(""); setSortKey("date_desc");
  };

  const doCheckIn = async (a: Appointment) => {
    setBusy(true);
    try { await appointmentsService.checkIn(a.appointment_id); await load(); }
    catch { /* ignore */ }
    finally { setBusy(false); }
  };

  const handleDownloadReceipt = async (a: Appointment) => {
    setDownloadingId(a.appointment_id);
    try {
      const blob = await paymentsService.downloadReceipt(a.appointment_id);
      saveBlobAsFile(blob, `receipt-${a.appointment_id}.pdf`);
    } catch { /* ignore */ }
    finally { setDownloadingId(null); }
  };

  const doCancel = async () => {
    if (!confirming) return;
    setBusy(true);
    try {
      await appointmentsService.cancel(confirming.appointment_id, { cancellation_reason: "Cancelled by receptionist" });
      setConfirming(null);
      await load();
    } catch { /* ignore */ }
    finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* breadcrumb + title */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Appointments</h1>
        {!loading && (
          <p className="text-xs text-neutral-500 mt-1">
            Showing {filtered.length} of {appointments.length} appointment{appointments.length === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {/* filters + actions */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="relative flex-[0_1_260px] min-w-[200px]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search patient, doctor, appointment ID…"
            className="w-full h-[38px] px-3 rounded-lg border border-neutral-300 bg-white text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
        </div>
        <select value={datePreset} onChange={(e) => setDatePreset(e.target.value as DatePreset)} className={selectCls}>
          {DATE_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        {datePreset === "custom" && (
          <>
            <input type="date" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} className={selectCls} aria-label="From date" />
            <span className="text-xs text-neutral-400">to</span>
            <input type="date" value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} className={selectCls} aria-label="To date" />
          </>
        )}
        <select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)} className={selectCls}>
          <option value="">All Doctors</option>
          {doctors.map((d) => (
            <option key={d.id} value={`${d.first_name} ${d.last_name}`}>Dr. {d.first_name} {d.last_name}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as AppointmentStatus | "")} className={selectCls}>
          <option value="">All Statuses</option>
          {STATUS_FILTERS.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as AppointmentType | "")} className={selectCls}>
          <option value="">All Visit Types</option>
          {TYPE_FILTERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} className={selectCls} aria-label="Sort by">
          {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>Sort: {o.label}</option>)}
        </select>
        {hasFilters && (
          <button onClick={clearFilters} className="h-[38px] px-3 text-sm font-medium text-primary-600 hover:underline">
            Clear
          </button>
        )}

        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => window.print()}
            className="h-[38px] px-3.5 rounded-lg border border-neutral-300 bg-white text-neutral-700 text-sm font-medium flex items-center gap-1.5 hover:bg-neutral-50 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <Link
            href="/receptionist/dashboard"
            className="h-[38px] px-4 rounded-lg bg-brand-gradient text-white text-sm font-medium flex items-center gap-1.5 hover:opacity-90 transition-opacity"
          >
            <CalendarPlus className="w-4 h-4" /> Schedule Appointment
          </Link>
        </div>
      </div>

      {/* table */}
      <div className="bg-white rounded-xl border border-neutral-200/80 shadow-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-5 h-5 border-2 border-neutral-200 border-t-primary-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <CalendarDays className="w-8 h-8 text-neutral-200 mb-2" />
            <p className="text-sm font-medium text-neutral-400">No appointments match</p>
            <p className="text-xs text-neutral-300 mt-1">Adjust the filters to see scheduled appointments.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 920 }}>
              <div className="grid gap-3 px-5 py-2.5 bg-neutral-50 border-b border-neutral-100" style={{ gridTemplateColumns: "1.3fr 1.2fr 1fr 0.9fr 1fr 170px" }}>
                {["Patient", "Doctor", "Date / Time", "Visit Type", "Status", "Actions"].map((h) => (
                  <span key={h} className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">{h}</span>
                ))}
              </div>
              {filtered.map((a) => {
                const cancelled        = a.status === "cancelled";
                const awaitingPayment  = a.status === "selected";
                const readyForCheckIn  = a.status === "paid";
                const locked           = ["completed", "in_progress", "checked_in", "no_show", "rescheduled"].includes(a.status);
                const hasPayment       = !["planned", "selected", "cancelled"].includes(a.status);
                return (
                  <div key={a.appointment_id} className="grid gap-3 items-center px-5 py-3 border-b border-neutral-100 last:border-0" style={{ gridTemplateColumns: "1.3fr 1.2fr 1fr 0.9fr 1fr 170px" }}>
                    <button
                      onClick={() => setSelectedAppointment(a)}
                      className="text-sm font-medium text-neutral-900 truncate hover:text-primary-600 hover:underline transition-colors text-left"
                    >
                      {a.patient_name ?? "Patient"}
                    </button>
                    <p className="text-xs text-neutral-700 truncate">{a.doctor_name ? `Dr. ${a.doctor_name}` : "—"}</p>
                    <div>
                      <p className="text-xs text-neutral-700">{fmtDate(a.appointment_date)}</p>
                      <p className="text-[11px] text-neutral-400">{fmt12(a.start_time)}</p>
                    </div>
                    <p className="text-xs text-neutral-600 capitalize truncate">{(a.appointment_type ?? "").replace(/_/g, " ")}</p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <StatusChip status={a.status} />
                      {/* rescheduled_from: this row replaced an earlier
                          appointment — distinct from status==='rescheduled',
                          which is the OLD superseded row instead. */}
                      {a.rescheduled_from && (
                        <span
                          title={a.rescheduled_from_date ? `Originally booked for ${fmtDate(a.rescheduled_from_date)} · ${fmt12(a.rescheduled_from_start_time || "")}` : undefined}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap bg-purple-100 text-purple-700"
                        >
                          Rescheduled
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      {hasPayment && (
                        <button
                          disabled={downloadingId === a.appointment_id}
                          onClick={() => handleDownloadReceipt(a)}
                          title="Download Receipt"
                          className="h-7 w-7 rounded-md border border-neutral-200 bg-white text-neutral-600 flex items-center justify-center hover:bg-neutral-50 transition-colors disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {locked ? null : cancelled ? (
                        <Link
                          href="/receptionist/dashboard"
                          className="h-7 px-2.5 rounded-md border border-neutral-300 bg-white text-neutral-600 text-xs font-medium hover:bg-neutral-50 transition-colors flex items-center"
                        >
                          Reschedule
                        </Link>
                      ) : (
                        <>
                          {awaitingPayment ? (
                            <button
                              disabled={busy}
                              onClick={() => setPayingFor(a)}
                              className="h-7 px-2.5 rounded-md bg-warning-500 text-white text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                              Collect Payment
                            </button>
                          ) : readyForCheckIn ? (
                            <button
                              disabled={busy}
                              onClick={() => doCheckIn(a)}
                              className="h-7 px-2.5 rounded-md bg-success-500 text-white text-xs font-medium hover:bg-success-700 transition-colors disabled:opacity-50"
                            >
                              Check-In
                            </button>
                          ) : null}
                          <button
                            onClick={() => setConfirming(a)}
                            title="Cancel"
                            className="h-7 w-7 rounded-md border border-danger-100 bg-white text-danger-700 flex items-center justify-center hover:bg-danger-50 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* cancel confirm dialog */}
      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="px-5 py-4 border-b border-neutral-100">
              <h3 className="text-base font-semibold text-neutral-900">Cancel this appointment?</h3>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-neutral-600">
                {confirming.patient_name ?? "This patient"}&apos;s {fmt12(confirming.start_time)} appointment
                {confirming.doctor_name ? ` with Dr. ${confirming.doctor_name}` : ""} will be cancelled. This can&apos;t be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-neutral-100">
              <button onClick={() => setConfirming(null)} className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors">
                Back
              </button>
              <button
                disabled={busy}
                onClick={doCancel}
                className="px-4 py-2 text-sm font-medium text-white bg-danger-500 hover:bg-danger-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {busy ? "Cancelling…" : "Cancel appointment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {payingFor && (
        <MockPaymentModal
          isOpen
          appointmentId={payingFor.appointment_id}
          onClose={() => setPayingFor(null)}
          onPaid={() => { setPayingFor(null); load(); }}
        />
      )}

      <AppointmentDetailModal
        appointment={selectedAppointment}
        isOpen={!!selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
      />
    </div>
  );
}
