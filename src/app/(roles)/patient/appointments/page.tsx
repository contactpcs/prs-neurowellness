"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays, Clock, Plus, CheckCircle, XCircle,
  ChevronRight, Loader2, RefreshCw,
} from "lucide-react";
import { appointmentsService } from "@/lib/api/services/appointments.service";
import { BookAppointmentModal } from "@/components/appointments/BookAppointmentModal";
import { MockPaymentModal } from "@/components/appointments/MockPaymentModal";
import { STATUS_LABEL, ACTIVE_APPOINTMENT_STATUSES } from "@/lib/appointmentStatus";
import type { Appointment, AppointmentType } from "@/types/domain.types";

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

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtTime(t?: string | null) {
  if (!t) return "";
  return t.slice(0, 5);
}

export default function PatientAppointmentsPage() {
  const [appts, setAppts]             = useState<Appointment[]>([]);
  const [apptLoading, setApptLoading] = useState(true);
  const [tab, setTab]                 = useState<"upcoming" | "all">("upcoming");
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null);
  const [showBook, setShowBook]       = useState(false);
  const [payingId, setPayingId]       = useState<string | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

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

  useEffect(() => { loadAppointments(); }, [loadAppointments]);

  useEffect(() => {
    const onAppointmentEvent = () => loadAppointments();
    window.addEventListener("sse:appointment", onAppointmentEvent);
    return () => window.removeEventListener("sse:appointment", onAppointmentEvent);
  }, [loadAppointments]);

  const now = new Date();
  const upcoming = appts.filter((a) => {
    const d = new Date(`${a.appointment_date}T${a.start_time || "00:00"}`);
    return d >= now && !["cancelled", "no_show", "completed"].includes(a.status);
  });
  const displayAppts = tab === "upcoming" ? upcoming : appts;

  // Same gate the backend enforces (book_initial / book_follow_up): a
  // completed initial unlocks follow-ups; an initial still in flight blocks
  // booking anything new until it resolves.
  const hasCompletedInitial = appts.some((a) => a.appointment_type === "initial" && a.status === "completed");
  const hasActiveInitial = appts.some(
    (a) => a.appointment_type === "initial" && ACTIVE_APPOINTMENT_STATUSES.includes(a.status),
  );
  const bookableType: AppointmentType | null = hasActiveInitial ? null : hasCompletedInitial ? "follow_up" : "initial";

  return (
    <div className="space-y-6">
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${toast.ok ? "bg-green-600" : "bg-red-600"}`}>
          {toast.ok ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

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

      {/* Appointments */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setTab("upcoming")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === "upcoming" ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              Upcoming {upcoming.length > 0 && `(${upcoming.length})`}
            </button>
            <button
              onClick={() => setTab("all")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                tab === "all" ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              All
            </button>
          </div>
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
        ) : displayAppts.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-xl px-6 py-12 text-center">
            <CalendarDays className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
            <p className="font-medium text-neutral-600">
              {tab === "upcoming" ? "No upcoming appointments" : "No appointments yet"}
            </p>
            <p className="text-sm text-neutral-400 mt-1">
              {bookableType ? "Use the button above to book a slot." : "Your current appointment needs to be resolved first."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {displayAppts.map((a) => (
              <AppointmentCard key={a.appointment_id} appt={a} onPayClick={() => setPayingId(a.appointment_id)} />
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
            setPayingId(created.appointment_id);
          }}
        />
      )}

      {payingId && (
        <MockPaymentModal
          isOpen
          appointmentId={payingId}
          onClose={() => setPayingId(null)}
          onPaid={() => { setPayingId(null); loadAppointments(); showToast("Appointment booked and paid.", true); }}
        />
      )}
    </div>
  );
}

function AppointmentCard({ appt, onPayClick }: { appt: Appointment; onPayClick: () => void }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-xl px-4 py-4 flex items-center gap-4">
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
      {appt.status === "selected" ? (
        <button
          onClick={onPayClick}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-brand-gradient text-white text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          Pay Now
        </button>
      ) : (
        <ChevronRight className="h-4 w-4 text-neutral-300 flex-shrink-0" />
      )}
    </div>
  );
}
