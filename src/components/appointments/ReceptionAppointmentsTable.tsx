"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { Printer, CalendarPlus, X, CalendarDays, Download } from "lucide-react";
import { appointmentsService } from "@/lib/api/services/appointments.service";
import { receptionService } from "@/lib/api/services/reception.service";
import { paymentsService, saveBlobAsFile } from "@/lib/api/services/payments.service";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/appointmentStatus";
import { MockPaymentModal } from "@/components/appointments/MockPaymentModal";
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

const STATUS_FILTERS: (AppointmentStatus | "")[] = [
  "", "selected", "paid", "checked_in", "in_progress", "completed", "cancelled", "no_show",
];

export function ReceptionAppointmentsTable({ clinicId }: { clinicId: string }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors,      setDoctors]      = useState<DoctorListItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [q,            setQ]            = useState("");
  const [doctorFilter, setDoctorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "">("");
  const [confirming,   setConfirming]   = useState<Appointment | null>(null);
  const [payingFor,    setPayingFor]    = useState<Appointment | null>(null);
  const [busy,         setBusy]         = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [apptRes, docRes] = await Promise.all([
        appointmentsService.list({ clinic_id: clinicId, limit: 200 }),
        receptionService.getDoctors(),
      ]);
      setAppointments(apptRes.appointments);
      setDoctors(docRes.doctors);
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [clinicId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onAppointmentEvent = () => load();
    window.addEventListener("sse:appointment", onAppointmentEvent);
    return () => window.removeEventListener("sse:appointment", onAppointmentEvent);
  }, [load]);

  const filtered = useMemo(() => {
    const query = q.toLowerCase();
    return [...appointments]
      .filter((a) => !doctorFilter || a.doctor_name === doctorFilter)
      .filter((a) => !statusFilter || a.status === statusFilter)
      .filter((a) => !query || `${a.appointment_id} ${a.patient_name ?? ""} ${a.doctor_name ?? ""}`.toLowerCase().includes(query))
      .sort((a, b) => {
        const dc = (b.appointment_date ?? "").localeCompare(a.appointment_date ?? "");
        return dc !== 0 ? dc : (a.start_time ?? "").localeCompare(b.start_time ?? "");
      });
  }, [appointments, doctorFilter, statusFilter, q]);

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
        <nav className="flex items-center gap-1.5 mb-1.5 text-xs">
          <span className="text-neutral-700 font-medium">Appointments</span>
        </nav>
        <h1 className="text-2xl font-bold text-neutral-900">Appointments</h1>
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
        <select
          value={doctorFilter}
          onChange={(e) => setDoctorFilter(e.target.value)}
          className="h-[38px] px-3 rounded-lg border border-neutral-300 bg-white text-sm text-neutral-700"
        >
          <option value="">All Doctors</option>
          {doctors.map((d) => (
            <option key={d.id} value={`${d.first_name} ${d.last_name}`}>Dr. {d.first_name} {d.last_name}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AppointmentStatus | "")}
          className="h-[38px] px-3 rounded-lg border border-neutral-300 bg-white text-sm text-neutral-700"
        >
          <option value="">All Statuses</option>
          {STATUS_FILTERS.filter(Boolean).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s as AppointmentStatus]}</option>
          ))}
        </select>

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
                    <p className="text-sm font-medium text-neutral-900 truncate">{a.patient_name ?? "Patient"}</p>
                    <p className="text-xs text-neutral-700 truncate">{a.doctor_name ? `Dr. ${a.doctor_name}` : "—"}</p>
                    <div>
                      <p className="text-xs text-neutral-700">{fmtDate(a.appointment_date)}</p>
                      <p className="text-[11px] text-neutral-400">{fmt12(a.start_time)}</p>
                    </div>
                    <p className="text-xs text-neutral-600 capitalize truncate">{(a.appointment_type ?? "").replace(/_/g, " ")}</p>
                    <StatusChip status={a.status} />
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
    </div>
  );
}
