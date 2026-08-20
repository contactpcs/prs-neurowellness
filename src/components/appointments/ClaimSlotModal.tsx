"use client";

import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Modal, Button } from "@/components/ui";
import { appointmentsService } from "@/lib/api/services/appointments.service";
import { DeviceTimelinePicker } from "@/components/appointments/DeviceTimelinePicker";
import type { Appointment, AppointmentType, AvailabilitySlot } from "@/types/domain.types";

function fmt12(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

interface ClaimSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  /** device_session reads clinic device capacity (continuous timeline,
   * variable duration from billable_items); protocol_followup reads the
   * patient's own allocated doctor's calendar (discrete list, doctor slots
   * are exclusive/fixed) — same claim-slot endpoint either way. */
  appointmentType: AppointmentType;
  /** The protocol's own prescribed date (appt.appointment_date) — the only
   * day slots are ever shown for. Device sessions/protocol follow-ups are
   * dosed on a schedule the doctor set; the patient picks a time, not a
   * different day. claimSlot is called without appointment_date on purpose
   * so the backend always defaults onto this same date too. */
  plannedDate: string;
  onClaimed: (appointment: Appointment) => void;
}

export function ClaimSlotModal({ isOpen, onClose, appointmentId, appointmentType, plannedDate, onClaimed }: ClaimSlotModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Select a Time" className="max-w-4xl">
      <div className="space-y-4">
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-900">
            {new Date(plannedDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <p className="text-xs text-neutral-500 mt-0.5">Set by your treatment protocol — pick any open time this day.</p>
        </div>

        {appointmentType === "device_session" ? (
          <DeviceTimelinePicker appointmentId={appointmentId} onClaimed={onClaimed} />
        ) : (
          <DoctorSlotList appointmentId={appointmentId} plannedDate={plannedDate} onClose={onClose} onClaimed={onClaimed} />
        )}
      </div>
    </Modal>
  );
}

/** Doctor calendar — genuinely slot-based (one exclusive slot at a time),
 * unchanged from before this file was split. */
function DoctorSlotList({
  appointmentId,
  plannedDate,
  onClose,
  onClaimed,
}: {
  appointmentId: string;
  plannedDate: string;
  onClose: () => void;
  onClaimed: (appointment: Appointment) => void;
}) {
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [picked, setPicked] = useState<AvailabilitySlot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPicked(null);
    setError(null);
    setLoadingSlots(true);
    appointmentsService
      .myAvailability(plannedDate, plannedDate)
      .then((s) => setSlots(s.filter((x) => x.date === plannedDate)))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [appointmentId, plannedDate]);

  async function handleConfirm() {
    if (!picked) return;
    setSubmitting(true);
    setError(null);
    try {
      const claimed = await appointmentsService.claimSlot(appointmentId, { start_time: picked.start_time });
      onClaimed(claimed);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? "Could not claim that slot — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  const available = slots.filter((s) => s.is_available);

  return (
    <>
      {loadingSlots ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-neutral-200 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : available.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-neutral-400">
          <CalendarDays className="h-6 w-6" />
          <p className="text-xs">No open times left this day — contact the clinic.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {available.map((s) => (
            <button
              key={s.start_time}
              onClick={() => setPicked(s)}
              className={`text-sm font-medium px-2 py-2 rounded-lg text-center border transition-colors ${
                picked?.start_time === s.start_time
                  ? "bg-primary-600 text-white border-primary-600"
                  : "bg-success-50 text-success-700 border-success-100 hover:bg-success-100"
              }`}
            >
              {fmt12(s.start_time)}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-xs text-danger-600 bg-danger-50 border border-danger-200 rounded-lg px-3 py-2 mt-4">{error}</p>}

      <div className="flex justify-end gap-2 mt-4">
        <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>Cancel</Button>
        <Button variant="primary" size="sm" onClick={handleConfirm} disabled={!picked} isLoading={submitting}>
          Confirm &amp; Continue to Payment
        </Button>
      </div>
    </>
  );
}
