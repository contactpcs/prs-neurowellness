"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays, Clock, Plus,
  ChevronRight, Loader2, RefreshCw, Syringe, ClipboardList, Lock, History,
} from "lucide-react";
import { appointmentsService } from "@/lib/api/services/appointments.service";
import { BookAppointmentModal } from "@/components/appointments/BookAppointmentModal";
import { PatientMonthCalendar } from "@/components/appointments/PatientMonthCalendar";
import { STATUS_LABEL, ACTIVE_APPOINTMENT_STATUSES, isSupersededCancellation } from "@/lib/appointmentStatus";
import type { Appointment, AppointmentHistoryEntry, AppointmentType } from "@/types/domain.types";

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-neutral-100 shadow-sm">
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <p className="text-sm text-neutral-500">{label}</p>
      </div>
      <p className="text-xl font-bold text-neutral-800">{value}</p>
      {sub && <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>}
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  planned:     "bg-neutral-100 text-neutral-500",
  selected:    "bg-amber-50 text-amber-700",
  paid:        "bg-cyan-50 text-cyan-700",
  checked_in:  "bg-purple-50 text-purple-700",
  in_progress: "bg-orange-50 text-orange-700",
  completed:   "bg-green-50 text-green-700",
  cancelled:   "bg-neutral-100 text-neutral-500",
  no_show:     "bg-red-50 text-red-700",
  rescheduled: "bg-yellow-50 text-yellow-700",
};

const PAYMENT_STATUS_COLOR: Record<string, string> = {
  pending:  "bg-amber-50 text-amber-700",
  paid:     "bg-green-50 text-green-700",
  failed:   "bg-red-50 text-red-600",
  waived:   "bg-blue-50 text-blue-700",
  refunded: "bg-neutral-100 text-neutral-500",
};

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(t?: string | null) {
  if (!t) return "";
  return t.slice(0, 5);
}
function fmtMoney(n?: number | null, currency?: string | null) {
  if (n == null) return null;
  return `${currency === "INR" || !currency ? "₹" : currency + " "}${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function PatientAppointmentsPage() {
  const router = useRouter();
  const [appts, setAppts]             = useState<Appointment[]>([]);
  const [apptLoading, setApptLoading] = useState(true);
  const [showBook, setShowBook]       = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr());
  const [history, setHistory]           = useState<AppointmentHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadAppointments = useCallback(async () => {
    setApptLoading(true);
    try {
      setAppts(await appointmentsService.myList(true));
    } catch {
      // silent
    } finally {
      setApptLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      setHistory(await appointmentsService.myHistory());
    } catch {
      // silent
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { loadAppointments(); loadHistory(); }, [loadAppointments, loadHistory]);

  useEffect(() => {
    const onAppointmentEvent = () => { loadAppointments(); loadHistory(); };
    window.addEventListener("sse:appointment", onAppointmentEvent);
    return () => window.removeEventListener("sse:appointment", onAppointmentEvent);
  }, [loadAppointments, loadHistory]);

  // Drop appointments auto-cancelled by a protocol amendment superseding
  // their protocol — that's the old version's slot being cleared, not a
  // cancellation the patient should see; the new protocol's own appointments
  // carry the current schedule.
  const visibleAppts = useMemo(() => appts.filter((a) => !isSupersededCancellation(a)), [appts]);
  const visibleHistory = useMemo(() => history.filter((a) => !isSupersededCancellation(a)), [history]);

  const now = new Date();
  const upcoming = visibleAppts.filter((a) => {
    const d = new Date(`${a.appointment_date}T${a.start_time || "00:00"}`);
    return d >= now && !["cancelled", "no_show", "completed"].includes(a.status);
  });
  // Same gate the backend enforces (book_initial / book_follow_up): a
  // completed initial unlocks follow-ups; an initial still in flight blocks
  // booking anything new until it resolves.
  const hasCompletedInitial = visibleAppts.some((a) => a.appointment_type === "initial" && a.status === "completed");
  const hasActiveInitial = visibleAppts.some(
    (a) => a.appointment_type === "initial" && ACTIVE_APPOINTMENT_STATUSES.includes(a.status),
  );
  const bookableType: AppointmentType | null = hasActiveInitial ? null : hasCompletedInitial ? "follow_up" : "initial";

  // KPIs: soonest upcoming visit the protocol plan calls for, and the
  // doctor-planned device sessions still ahead.
  const nextProtocolVisit = useMemo(
    () =>
      upcoming
        .filter((a) => a.appointment_type === "protocol_followup")
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())[0] ?? null,
    [upcoming],
  );
  const upcomingDeviceSessions = useMemo(
    () =>
      upcoming
        .filter((a) => a.appointment_type === "device_session")
        .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()),
    [upcoming],
  );

  const dayAppts = visibleAppts.filter((a) => a.appointment_date === selectedDate);

  // A day with exactly one appointment goes straight to its detail page —
  // no point making the patient click twice. Multiple on the same day still
  // land on the picker list below so they can choose which one.
  function handleSelectDate(dateStr: string) {
    setSelectedDate(dateStr);
    const onThatDay = visibleAppts.filter((a) => a.appointment_date === dateStr);
    if (onThatDay.length === 1) router.push(`/patient/appointments/${onThatDay[0].appointment_id}`);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">My Appointments</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Book a slot, pay, and you're confirmed.</p>
        </div>
        {bookableType ? (
          <button
            onClick={() => setShowBook(true)}
            className="flex items-center gap-2 bg-brand-gradient text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{bookableType === "initial" ? "Book Initial Consultation" : "Book Follow-up"}</span>
            <span className="sm:hidden">Book</span>
          </button>
        ) : (
          <span className="text-xs text-neutral-400 flex-shrink-0 max-w-[220px] text-right">
            You already have an initial consultation in progress.
          </span>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <KpiCard
          icon={<ClipboardList className="h-4 w-4 text-purple-500" />}
          label="Next Protocol Visit"
          value={nextProtocolVisit ? fmtDate(nextProtocolVisit.appointment_date) : "None scheduled"}
          sub={nextProtocolVisit ? fmtTime(nextProtocolVisit.start_time) : "Your doctor sets this as your protocol progresses."}
        />
        <KpiCard
          icon={<Syringe className="h-4 w-4 text-orange-500" />}
          label="Device Sessions Planned"
          value={String(upcomingDeviceSessions.length)}
          sub={upcomingDeviceSessions[0] ? `Next: ${fmtDate(upcomingDeviceSessions[0].appointment_date)}` : "None planned by your doctor yet."}
        />
      </div>

      {/* Calendar + day detail */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
        <PatientMonthCalendar appointments={visibleAppts} selectedDate={selectedDate} onSelectDate={handleSelectDate} />

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-neutral-900">
              {selectedDate === todayStr() ? "Today" : fmtDate(selectedDate)}
            </p>
            <button
              onClick={loadAppointments}
              className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {apptLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
            </div>
          ) : dayAppts.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-xl px-4 py-8 text-center">
              <CalendarDays className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
              <p className="text-sm text-neutral-500">No appointments this day.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {dayAppts.map((a) => (
                <AppointmentRow key={a.appointment_id} appt={a} onClick={() => router.push(`/patient/appointments/${a.appointment_id}`)} />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Appointment history — every appointment ever, newest first, with its
          payment attached. A payment attempt that was abandoned mid-checkout
          shows here as "Payment Failed" (hold_sweeper.py cancels rather than
          deletes it) instead of silently disappearing. */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900 flex items-center gap-1.5">
            <History className="h-4 w-4 text-neutral-400" /> Appointment History
          </h2>
          <button
            onClick={loadHistory}
            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400 hover:text-neutral-600 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {historyLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
          </div>
        ) : visibleHistory.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-xl px-4 py-8 text-center">
            <History className="h-8 w-8 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm text-neutral-500">No appointments yet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleHistory.map((a) => (
              <HistoryRow key={a.appointment_id} appt={a} onClick={() => router.push(`/patient/appointments/${a.appointment_id}`)} />
            ))}
          </div>
        )}
      </section>

      {showBook && bookableType && (
        <BookAppointmentModal
          isOpen
          appointmentType={bookableType}
          onClose={() => setShowBook(false)}
          onBooked={(created) => {
            setShowBook(false);
            loadAppointments();
            router.push(`/patient/appointments/${created.appointment_id}`);
          }}
        />
      )}
    </div>
  );
}

// Whole row navigates to the appointment's detail page — that page is
// where payment/status/reschedule now live, this list is just a picker.
function AppointmentRow({ appt, onClick }: { appt: Appointment; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-neutral-200 rounded-xl px-4 py-4 flex items-center gap-4 hover:border-neutral-300 transition-colors"
    >
      <div className="bg-blue-50 rounded-xl p-2.5 flex-shrink-0">
        <CalendarDays className="h-5 w-5 text-blue-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-neutral-900">
            {appt.doctor_name ?? "Your Doctor"}
          </p>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[appt.status] ?? "bg-neutral-100 text-neutral-500"}`}>
            {STATUS_LABEL[appt.status] ?? appt.status.replace(/_/g, " ")}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {fmtDate(appt.appointment_date)}
          </span>
          {appt.start_time && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {fmtTime(appt.start_time)}
            </span>
          )}
          {appt.appointment_type && (
            <span className="capitalize">{appt.appointment_type.replace(/_/g, " ")}</span>
          )}
        </div>
        {appt.reason && (
          <p className="text-xs text-neutral-400 mt-0.5 truncate">{appt.reason}</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-neutral-300 flex-shrink-0" />
    </button>
  );
}

// One row per appointment ever, its most recent payment folded in. A
// 'selected' row is mid-checkout — locked to this slot, awaiting payment or
// its hold expiring — so it gets a lock icon instead of the usual chevron;
// everything else (including an abandoned attempt the sweeper cancelled) is
// a plain settled row, clickable through to detail like AppointmentRow.
function HistoryRow({ appt, onClick }: { appt: AppointmentHistoryEntry; onClick: () => void }) {
  const isLocked = appt.status === "selected";
  const money = fmtMoney(appt.payment_amount, appt.payment_currency);
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white border border-neutral-200 rounded-xl px-4 py-4 flex items-center gap-4 hover:border-neutral-300 transition-colors"
    >
      <div className={`rounded-xl p-2.5 flex-shrink-0 ${isLocked ? "bg-amber-50" : "bg-blue-50"}`}>
        {isLocked ? <Lock className="h-5 w-5 text-amber-600" /> : <CalendarDays className="h-5 w-5 text-blue-600" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-neutral-900">
            {appt.doctor_name ?? "Your Doctor"}
          </p>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[appt.status] ?? "bg-neutral-100 text-neutral-500"}`}>
            {STATUS_LABEL[appt.status] ?? appt.status.replace(/_/g, " ")}
          </span>
          {appt.payment_status && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${PAYMENT_STATUS_COLOR[appt.payment_status] ?? "bg-neutral-100 text-neutral-500"}`}>
              {appt.payment_status === "failed" && appt.status === "cancelled" ? "Payment Failed" : appt.payment_status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-neutral-500">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            {fmtDate(appt.appointment_date)}
          </span>
          {appt.start_time && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {fmtTime(appt.start_time)}
            </span>
          )}
          {appt.appointment_type && (
            <span className="capitalize">{appt.appointment_type.replace(/_/g, " ")}</span>
          )}
          {money && <span className="font-medium text-neutral-600">{money}</span>}
        </div>
        {isLocked && (
          <p className="text-xs text-amber-600 mt-0.5">Slot held — complete payment to confirm.</p>
        )}
        {appt.status === "cancelled" && appt.cancellation_reason && (
          <p className="text-xs text-neutral-400 mt-0.5 truncate">{appt.cancellation_reason}</p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 text-neutral-300 flex-shrink-0" />
    </button>
  );
}
