"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, CalendarDays, Clock, User, RotateCcw, CheckCircle2, XCircle } from "lucide-react";
import { appointmentsService } from "@/lib/api/services/appointments.service";
import { MockPaymentModal } from "@/components/appointments/MockPaymentModal";
import { ClaimSlotModal } from "@/components/appointments/ClaimSlotModal";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/appointmentStatus";
import { PageLoader, Button } from "@/components/ui";
import type { Appointment } from "@/types/domain.types";

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
function fmtTime(t?: string | null) {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function AppointmentDetailPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const router = useRouter();
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [showClaim, setShowClaim] = useState(false);

  useEffect(() => {
    setLoading(true);
    appointmentsService.getById(appointmentId).then(setAppt).finally(() => setLoading(false));
  }, [appointmentId]);

  if (loading) return <PageLoader />;

  if (!appt) {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <p className="text-neutral-500">Appointment not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/patient/appointments")}>
          Back to Appointments
        </Button>
      </div>
    );
  }

  // 'planned' = a protocol-born slot (device_session/protocol_followup)
  // that hasn't been claimed yet — no date/time locked in, nothing paid.
  // An overdue 'planned' row stays 'planned' (scheduling/service.py never
  // auto-flips it), so it's never "missed" either — it just needs claiming.
  const isPlanned = appt.status === "planned";
  // Matches backend's PROTOCOL_BORN_TYPES (scheduling/service.py) — the
  // only two types claim-slot will ever accept.
  const claimable = isPlanned && (appt.appointment_type === "device_session" || appt.appointment_type === "protocol_followup");

  // Only statuses that actually reached a claimed, timed slot can be past
  // due and therefore "missed" — was previously a blacklist that also
  // caught 'planned' (no slot, no time) and called it paid. Explicit
  // whitelist instead: no_show is always missed; the others only count if
  // their claimed slot's time has actually elapsed without completing.
  const isPast = !isPlanned && new Date(`${appt.appointment_date}T${appt.start_time || "23:59"}`) < new Date();
  const isMissed = appt.status === "no_show" || (isPast && ["selected", "paid", "checked_in", "in_progress"].includes(appt.status));
  const awaitingPayment = appt.status === "selected" && !isPast;
  const isPaidUpcoming = !isPast && ["paid", "checked_in", "in_progress"].includes(appt.status);

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <button
        onClick={() => router.push("/patient/appointments")}
        className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Appointments
      </button>

      <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-neutral-400 uppercase tracking-wide">{appt.appointment_type?.replace(/_/g, " ")}</p>
            <h1 className="text-lg font-bold text-neutral-900 mt-0.5">
              {appt.doctor_name ? `With ${appt.doctor_name}` : "Appointment"}
            </h1>
          </div>
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${
              isMissed ? "bg-danger-100 text-danger-700" : STATUS_TONE[appt.status]
            }`}
          >
            {isMissed ? "Missed" : STATUS_LABEL[appt.status]}
          </span>
        </div>

        <div className="divide-y divide-neutral-100 border border-neutral-100 rounded-lg overflow-hidden text-sm">
          <div className="flex items-center gap-2 px-4 py-2.5">
            <CalendarDays className="h-4 w-4 text-neutral-400" />
            <span className="text-neutral-700">{fmtDate(appt.appointment_date)}</span>
          </div>
          {appt.start_time && (
            <div className="flex items-center gap-2 px-4 py-2.5">
              <Clock className="h-4 w-4 text-neutral-400" />
              <span className="text-neutral-700">{fmtTime(appt.start_time)}</span>
            </div>
          )}
          {appt.doctor_name && (
            <div className="flex items-center gap-2 px-4 py-2.5">
              <User className="h-4 w-4 text-neutral-400" />
              <span className="text-neutral-700">{appt.doctor_name}</span>
            </div>
          )}
        </div>

        {appt.reason && <p className="text-sm text-neutral-500">{appt.reason}</p>}
      </div>

      {appt.status === "completed" && (
        <div className="bg-success-50 border border-success-100 rounded-xl p-5 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-success-600 flex-shrink-0" />
          <p className="text-sm text-success-800">This visit is complete.</p>
        </div>
      )}

      {appt.status === "cancelled" && (
        <div className="bg-neutral-100 border border-neutral-200 rounded-xl p-5 text-sm text-neutral-600">
          This appointment was cancelled{appt.cancellation_reason ? `: ${appt.cancellation_reason}` : "."}
        </div>
      )}

      {isMissed && (
        <div className="bg-danger-50 border border-danger-100 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <XCircle className="h-6 w-6 text-danger-600 flex-shrink-0" />
            <p className="text-sm text-danger-800">This slot has passed without being completed.</p>
          </div>
          {/* Non-functional on purpose — rescheduling isn't built yet. */}
          <Button variant="outline" disabled title="Rescheduling isn't available yet — contact the clinic to rebook.">
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reschedule
          </Button>
        </div>
      )}

      {isPlanned && (
        <div className="bg-neutral-100 border border-neutral-200 rounded-xl p-5 space-y-3">
          <p className="text-sm text-neutral-600">
            This session hasn't been scheduled to a specific slot yet — no time is locked in and nothing is due until it is.
          </p>
          {claimable && (
            <Button variant="primary" size="sm" onClick={() => setShowClaim(true)}>
              Select a Slot
            </Button>
          )}
        </div>
      )}

      {claimable && (
        <ClaimSlotModal
          isOpen={showClaim}
          onClose={() => setShowClaim(false)}
          appointmentId={appt.appointment_id}
          appointmentType={appt.appointment_type}
          plannedDate={appt.appointment_date}
          onClaimed={(claimed) => {
            setShowClaim(false);
            setAppt(claimed);
          }}
        />
      )}

      {isPaidUpcoming && (
        <div className="bg-primary-50 border border-primary-100 rounded-xl p-5 text-sm text-primary-800">
          This appointment is confirmed and paid.
        </div>
      )}

      {/* Payment happens right here — MockPaymentModal's review stage shows
          patient/doctor/date/amount again with a Cancel option, matching
          this page's own detail card above rather than duplicating it. */}
      {awaitingPayment && (
        <MockPaymentModal
          isOpen
          appointmentId={appt.appointment_id}
          onClose={() => router.push("/patient/appointments")}
          onPaid={() => appointmentsService.getById(appointmentId).then(setAppt)}
        />
      )}
    </div>
  );
}
