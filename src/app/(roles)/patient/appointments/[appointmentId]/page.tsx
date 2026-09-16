"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, CalendarDays, Clock, User, RotateCcw, CheckCircle2, XCircle, Brain, Sparkles, TrendingUp } from "lucide-react";
import { appointmentsService } from "@/lib/api/services/appointments.service";
import { MockPaymentModal } from "@/components/appointments/MockPaymentModal";
import { ClaimSlotModal } from "@/components/appointments/ClaimSlotModal";
import { RescheduleModal } from "@/components/appointments/RescheduleModal";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/appointmentStatus";
import { treatmentProtocolService } from "@/lib/api/services/treatmentProtocol.service";
import { getDeviceSessionLabel, SESSION_TYPE_LABEL } from "@/lib/utils/sessionType";
import { doctorLabel } from "@/lib/utils/doctorLabel";
import { PageLoader, Button } from "@/components/ui";
import { useGoBack } from "@/lib/hooks";
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

// One card, one message — cycles through the three angles across a
// patient's course instead of dumping all of it on every visit: session 1
// (nobody has a mental model yet) explains the mechanism, session 2 lists
// concrete advantages, session 3 is pure motivation to keep going, then it
// repeats for session 4, 5, 6...
function getSessionEducation(sessionNumber: number | null | undefined, modality?: string | null) {
  const device = modality || "Neuromodulation";
  const n = sessionNumber && sessionNumber > 0 ? sessionNumber : 1;
  const slot = (n - 1) % 3;

  if (slot === 0) {
    return {
      kind: "mechanism" as const,
      title: `How ${device} Works`,
      body: `${device} passes a mild, painless current through targeted areas of the brain to gently adjust how active those neurons are. It's non-invasive, needs no anesthesia, and most patients feel little more than a light tingling as the session starts. Each session builds on the last — the effect comes from a full course of consistent sessions, not any single one.`,
    };
  }
  if (slot === 1) {
    return {
      kind: "advantages" as const,
      title: `Advantages of ${device}`,
      items: [
        "Non-invasive — no surgery, no anesthesia, no downtime",
        "Painless, with most patients feeling only a light tingling sensation",
        "Cumulative benefit that builds session over session",
        "Can be combined with other therapies in your treatment plan",
        "Well-tolerated, with a strong safety record across clinical use",
      ],
    };
  }
  return {
    kind: "motivation" as const,
    title: "Keep Up the Momentum",
    body: `Session ${n} — you're building on real progress. ${device} works cumulatively: each completed session reinforces the changes made by the ones before it. Patients who complete their full course see steadier, longer-lasting improvement than those who stop partway through.`,
  };
}

export default function AppointmentDetailPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <AppointmentDetail />
    </Suspense>
  );
}

function AppointmentDetail() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const goBack = useGoBack("/patient/appointments");
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [showClaim, setShowClaim] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [modality, setModality] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    appointmentsService.getById(appointmentId).then(setAppt).finally(() => setLoading(false));
  }, [appointmentId]);

  useEffect(() => {
    if (!appt?.protocol_id) { setModality(null); return; }
    let cancelled = false;
    treatmentProtocolService.getProtocolDetail(appt.protocol_id)
      .then((p) => { if (!cancelled) setModality(p.modality ?? null); })
      .catch(() => { if (!cancelled) setModality(null); });
    return () => { cancelled = true; };
  }, [appt?.protocol_id]);

  // Dashboard's "Select Slot" links here with ?claim=1 so the picker opens
  // immediately instead of landing on the detail page and making the
  // patient tap the button again.
  useEffect(() => {
    if (!appt || searchParams.get("claim") !== "1") return;
    const isClaimable = appt.status === "planned" && (appt.appointment_type === "device_session" || appt.appointment_type === "protocol_followup");
    if (isClaimable) setShowClaim(true);
  }, [appt, searchParams]);

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
  // Backend accepts a reschedule from 'selected', 'paid', or 'no_show'
  // (scheduling/service.py's PATIENT_RESCHEDULE_FROM_STATUSES) — checked_in/
  // in_progress are excluded (the patient is already there, nothing to
  // move). no_show is the one exception to the 24h-notice check; a
  // still-upcoming 'paid' appointment needs the usual 24h notice, and a
  // past-due 'paid' one not yet swept into no_show (no_show_sweeper.py,
  // 2h/6h grace) will correctly be rejected until it is. Protocol-born types
  // (device_session/protocol_followup) are rejected outright server-side
  // (USE_CLAIM_SLOT_INSTEAD) — claim-slot is their equivalent, not reschedule.
  const isProtocolBorn = appt.appointment_type === "device_session" || appt.appointment_type === "protocol_followup";
  const canReschedule = ["no_show", "paid"].includes(appt.status) && !isProtocolBorn;

  return (
    <div className="max-w-lg mx-auto space-y-5">
      <button
        onClick={goBack}
        className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700"
      >
        <ChevronLeft className="h-4 w-4" />
        Back
      </button>

      <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-neutral-900">
              {appt.appointment_type === "device_session"
                ? getDeviceSessionLabel(modality)
                : appt.appointment_type ? SESSION_TYPE_LABEL[appt.appointment_type] : "Appointment"}
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
              <span className="text-neutral-700">{doctorLabel(appt.doctor_name)}</span>
            </div>
          )}
        </div>

        {appt.reason && <p className="text-sm text-neutral-500">{appt.reason}</p>}
      </div>

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

      {appt.appointment_type === "device_session" && (() => {
        const edu = getSessionEducation(appt.session_number, modality);
        const Icon = edu.kind === "mechanism" ? Brain : edu.kind === "advantages" ? Sparkles : TrendingUp;
        return (
          <div className="bg-white border border-neutral-200 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <Icon className="h-5 w-5 text-primary-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-neutral-900">{edu.title}</p>
                {edu.kind === "advantages" ? (
                  <ul className="space-y-1.5 mt-2">
                    {edu.items.map((a) => (
                      <li key={a} className="flex items-start gap-2 text-sm text-neutral-600">
                        <span className="mt-1.5 h-1 w-1 rounded-full bg-primary-500 flex-shrink-0" />
                        {a}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-neutral-600 mt-1 leading-relaxed">{edu.body}</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

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
          <Button
            variant="outline"
            disabled={!canReschedule}
            onClick={() => canReschedule && setShowReschedule(true)}
            title={
              canReschedule
                ? undefined
                : isProtocolBorn
                ? "This session needs a new slot claimed instead — contact the clinic to rebook."
                : "Not reschedulable yet — this slot hasn't been marked as missed on our side."
            }
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Reschedule
          </Button>
        </div>
      )}

      {canReschedule && (
        <RescheduleModal
          isOpen={showReschedule}
          onClose={() => setShowReschedule(false)}
          appointment={appt}
          onRescheduled={(updated) => {
            setShowReschedule(false);
            router.push(`/patient/appointments/${updated.appointment_id}`);
          }}
        />
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
        <div className="bg-primary-50 border border-primary-100 rounded-xl p-5 space-y-3">
          <p className="text-sm text-primary-800">This appointment is confirmed and paid.</p>
          {appt.status === "paid" && (
            <Button
              variant="outline"
              size="sm"
              disabled={!canReschedule}
              onClick={() => canReschedule && setShowReschedule(true)}
              title={
                canReschedule
                  ? undefined
                  : isProtocolBorn
                  ? "This session needs a new slot claimed instead — contact the clinic to rebook."
                  : undefined
              }
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Reschedule
            </Button>
          )}
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
