"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Printer, CalendarPlus, X, CalendarDays, Download, Search } from "lucide-react";
import { appointmentsService } from "@/lib/api/services/appointments.service";
import { receptionService } from "@/lib/api/services/reception.service";
import { paymentsService, saveBlobAsFile } from "@/lib/api/services/payments.service";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/appointmentStatus";
import { Modal } from "@/components/ui";
import { StaffPaymentPanel } from "@/components/appointments/StaffPaymentPanel";
import { AppointmentDetailModal } from "@/components/appointments/AppointmentDetailModal";
import { ReceptionBookAppointmentModal } from "@/components/appointments/ReceptionBookAppointmentModal";
import type { Appointment, AppointmentStatus, DoctorListItem } from "@/types/domain.types";

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

// Quick-filter pills, same pattern as the doctor's appointments page — one
// row mixing visit-type filters (follow_up/protocol_followup/device_session,
// matched on appointment_type) with status filters (matched on status).
type QuickFilter = AppointmentStatus | "all" | "initial" | "follow_up" | "protocol_followup" | "device_sessions";

const QUICK_FILTERS: QuickFilter[] = [
  "all", "initial", "follow_up", "protocol_followup", "selected", "paid", "checked_in", "in_progress",
  "completed", "cancelled", "no_show", "missed", "rescheduled", "device_sessions",
];

// The front desk's working list: paid appointments waiting to be checked in.
const DEFAULT_QUICK_FILTER: QuickFilter = "paid";
const PAGE_SIZE = 25;

function quickFilterLabel(f: QuickFilter): string {
  if (f === "all") return "All";
  if (f === "initial") return "Initial";
  if (f === "device_sessions") return "Device Sessions";
  if (f === "follow_up") return "Follow-up";
  if (f === "protocol_followup") return "Protocol Follow-up";
  return STATUS_LABEL[f];
}

/** Local-time YYYY-MM-DD — toISOString() would shift to UTC and be off by a day in IST mornings. */
function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const selectCls = "h-[38px] px-3 rounded-lg border border-neutral-300 bg-white text-sm text-neutral-700";
const dateCls = "h-[38px] px-2.5 rounded-lg border border-neutral-300 bg-white text-sm text-neutral-700 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500";

export function ReceptionAppointmentsTable({ clinicId }: { clinicId: string }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors,      setDoctors]      = useState<DoctorListItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [q,            setQ]            = useState("");
  const [doctorFilter, setDoctorFilter] = useState("");
  const [quickFilter,  setQuickFilter]  = useState<QuickFilter>(DEFAULT_QUICK_FILTER);
  // From/To calendar range, same as the doctor's page — defaults to today
  // onward; clear or widen it to look back.
  const [dateFrom,     setDateFrom]     = useState(() => ymd(new Date()));
  const [dateTo,       setDateTo]       = useState("");
  const [confirming,   setConfirming]   = useState<Appointment | null>(null);
  const [payingFor,    setPayingFor]    = useState<Appointment | null>(null);
  const [busy,         setBusy]         = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [showBooking,  setShowBooking]  = useState(false);

  const range = useMemo(
    () => ({ date_from: dateFrom || undefined, date_to: dateTo || undefined }),
    [dateFrom, dateTo],
  );

  // One server page at a time (API audit F-023): date range, doctor, quick
  // filter and search are applied in SQL, pill counts come back with it.
  // Used to download every appointment in range (343 KB at 230 rows) and
  // filter/count in the browser — again on every SSE appointment event.
  const [page,       setPage]       = useState(1);
  const [total,      setTotal]      = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [counts,     setCounts]     = useState<{ all: number; by_status: Record<string, number>; by_type: Record<string, number> }>({ all: 0, by_status: {}, by_type: {} });
  const [qDebounced, setQDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => { setPage(1); }, [qDebounced, doctorFilter, quickFilter, range]);

  useEffect(() => {
    receptionService.getDoctors().then(({ doctors: d }) => setDoctors(d)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    const typeFilter = quickFilter === "device_sessions" ? "device_session"
      : quickFilter === "initial" || quickFilter === "follow_up" || quickFilter === "protocol_followup" ? quickFilter
      : undefined;
    const statusFilter = quickFilter === "all" || typeFilter ? undefined : quickFilter;
    try {
      const res = await appointmentsService.page({
        clinic_id: clinicId, ...range, doctor_name: doctorFilter || undefined,
        status: statusFilter, appointment_type: typeFilter, search: qDebounced || undefined,
        page, page_size: PAGE_SIZE,
      });
      setAppointments(res.appointments);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setCounts(res.counts);
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [clinicId, range, doctorFilter, quickFilter, qDebounced, page]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  useEffect(() => {
    const onAppointmentEvent = () => load();
    window.addEventListener("sse:appointment", onAppointmentEvent);
    return () => window.removeEventListener("sse:appointment", onAppointmentEvent);
  }, [load]);

  // Server already filtered, sorted and paged (superseded cancellations excluded).
  const filtered = appointments;
  const quickCounts = Object.fromEntries(QUICK_FILTERS.map((f) => [f,
    f === "all" ? counts.all
      : f === "device_sessions" ? counts.by_type.device_session ?? 0
      : f === "initial" || f === "follow_up" || f === "protocol_followup" ? counts.by_type[f] ?? 0
      : counts.by_status[f] ?? 0,
  ])) as Record<QuickFilter, number>;

  const hasFilters = !!(q || doctorFilter || quickFilter !== DEFAULT_QUICK_FILTER || dateFrom !== ymd(new Date()) || dateTo);
  const clearFilters = () => {
    setQ(""); setDoctorFilter(""); setQuickFilter(DEFAULT_QUICK_FILTER);
    setDateFrom(ymd(new Date())); setDateTo("");
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
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Appointments</h1>
          {!loading && (
            <p className="text-xs text-neutral-500 mt-1">
              Showing {total} of {counts.all} appointment{counts.all === 1 ? "" : "s"}
            </p>
          )}
        </div>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => window.print()}
            className="h-[38px] px-3.5 rounded-lg border border-neutral-300 bg-white text-neutral-700 text-sm font-medium flex items-center gap-1.5 hover:bg-neutral-50 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <button
            onClick={() => setShowBooking(true)}
            className="h-[38px] px-4 rounded-lg bg-brand-gradient text-white text-sm font-medium flex items-center gap-1.5 hover:opacity-90 transition-opacity"
          >
            <CalendarPlus className="w-4 h-4" /> Schedule Appointment
          </button>
        </div>
      </div>

      {/* filters + actions */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="relative flex-[0_1_260px] min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search patient, doctor, appointment ID…"
            className="w-full h-[38px] pl-8 pr-3 rounded-lg border border-neutral-300 bg-white text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} className={dateCls} aria-label="From date" />
          <span className="text-xs text-neutral-400">to</span>
          <input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} className={dateCls} aria-label="To date" />
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="h-[38px] px-2.5 rounded-lg text-xs font-medium text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
        <select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)} className={selectCls}>
          <option value="">All Doctors</option>
          {doctors.map((d) => (
            <option key={d.id} value={`${d.first_name} ${d.last_name}`}>Dr. {d.first_name} {d.last_name}</option>
          ))}
        </select>
        {hasFilters && (
          <button onClick={clearFilters} className="h-[38px] px-3 text-sm font-medium text-primary-600 hover:underline">
            Clear
          </button>
        )}
      </div>

      {/* status / visit-type quick filters — same pills as the doctor's page */}
      <div className="flex items-center gap-2 flex-wrap -mt-2">
        {QUICK_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setQuickFilter(f)}
            className={
              quickFilter === f
                ? "h-8 px-3.5 rounded-full text-[11.5px] font-medium bg-brand-gradient text-white"
                : "h-8 px-3.5 rounded-full text-[11.5px] font-medium bg-neutral-100 text-neutral-600 hover:bg-neutral-200 transition-colors"
            }
          >
            {quickFilterLabel(f)}
            {!loading && <span className="ml-1.5 opacity-70">{quickCounts[f]}</span>}
          </button>
        ))}
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
        {totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-t border-neutral-100">
            <p className="text-xs text-neutral-500">
              Showing page {Math.min(page, totalPages)} of {totalPages} · {total} records
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 rounded-lg text-xs font-medium text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                    n === page ? "bg-brand-gradient text-white" : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 rounded-lg text-xs font-medium text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              >
                Next
              </button>
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
        <Modal isOpen onClose={() => { setPayingFor(null); load(); }} title="Collect Payment" className="max-w-lg">
          <StaffPaymentPanel
            appointmentId={payingFor.appointment_id}
            onDone={() => { setPayingFor(null); load(); }}
            onCancel={() => { setPayingFor(null); load(); }}
          />
        </Modal>
      )}

      <ReceptionBookAppointmentModal
        isOpen={showBooking}
        clinicId={clinicId}
        onClose={() => setShowBooking(false)}
        onBooked={() => { setShowBooking(false); load(); }}
      />

      <AppointmentDetailModal
        appointment={selectedAppointment}
        isOpen={!!selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
      />
    </div>
  );
}
