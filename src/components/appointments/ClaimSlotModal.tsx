"use client";

import { useCallback, useEffect, useState } from "react";
import { Modal, Button } from "@/components/ui";
import { appointmentsService } from "@/lib/api/services/appointments.service";
import { TimeSlotGrid, upcomingOnly, type GridSlot } from "@/components/appointments/TimeSlotGrid";
import type { Appointment, AppointmentType, DeviceDayAvailability } from "@/types/domain.types";

interface ClaimSlotModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  /** device_session reads the clinic device's day (hours, bookings, break,
   * session duration);
   * protocol_followup reads the patient's own allocated doctor's calendar —
   * same claim-slot endpoint either way. */
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
    <Modal isOpen={isOpen} onClose={onClose} title="Select a Time" className="max-w-lg">
      <div className="space-y-4">
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-900">
            {new Date(plannedDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <p className="text-xs text-neutral-500 mt-0.5">Set by your treatment protocol — pick an open time this day.</p>
        </div>

        <SlotPicker appointmentId={appointmentId} appointmentType={appointmentType} plannedDate={plannedDate} onClose={onClose} onClaimed={onClaimed} />
      </div>
    </Modal>
  );
}

// Device session boxes are built from the device's day view (opening hours,
// booked intervals, break, this session's duration) — the same rules the old
// timeline picker used: a start is offered every 30 min, and it's open only
// if the whole session fits inside opening hours without touching a booking
// or the break.
const SNAP_MINUTES = 30;

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function fromMinutes(mins: number): string {
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}:00`;
}
function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function deviceSlots(avail: DeviceDayAvailability, plannedDate: string): GridSlot[] {
  if (!avail.is_open || !avail.open_start || !avail.open_end || !avail.duration_minutes) return [];
  const open = toMinutes(avail.open_start);
  const close = toMinutes(avail.open_end);
  const duration = avail.duration_minutes;
  const blocked = avail.busy.map((b) => [toMinutes(b.start_time), toMinutes(b.end_time)] as [number, number]);
  if (avail.break_start && avail.break_end) blocked.push([toMinutes(avail.break_start), toMinutes(avail.break_end)]);

  const out: GridSlot[] = [];
  for (let t = Math.ceil(open / SNAP_MINUTES) * SNAP_MINUTES; t + duration <= close; t += SNAP_MINUTES) {
    const end = t + duration;
    out.push({
      date: plannedDate,
      start_time: fromMinutes(t),
      end_time: fromMinutes(end),
      is_available: !blocked.some(([bs, be]) => t < be && end > bs),
    });
  }
  return out;
}

/** Time boxes for the planned day — the patient's doctor's calendar for a
 * protocol follow-up, the clinic device's day for a device session. Same
 * claim-slot endpoint either way. Already-passed times are hidden. */
function SlotPicker({
  appointmentId,
  appointmentType,
  plannedDate,
  onClose,
  onClaimed,
}: {
  appointmentId: string;
  appointmentType: AppointmentType;
  plannedDate: string;
  onClose: () => void;
  onClaimed: (appointment: Appointment) => void;
}) {
  const isDevice = appointmentType === "device_session";
  const isPastDay = plannedDate < todayStr();
  const [slots, setSlots] = useState<GridSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deviceClosed, setDeviceClosed] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [picked, setPicked] = useState<GridSlot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setPicked(null);
    setLoadError(null);
    setDeviceClosed(false);
    // A past planned date has nothing bookable — the session is overdue.
    if (isPastDay) { setSlots([]); return; }
    setLoadingSlots(true);
    const req: Promise<GridSlot[]> = isDevice
      ? appointmentsService.deviceDayAvailability(appointmentId).then((avail) => {
          setDuration(avail.duration_minutes || null);
          setDeviceClosed(!avail.is_open);
          return deviceSlots(avail, plannedDate);
        })
      : appointmentsService.myAvailability(plannedDate, plannedDate);
    req
      .then((s) => setSlots(upcomingOnly(s.filter((x) => x.date === plannedDate))))
      .catch((e) => {
        setSlots([]);
        setLoadError(e?.response?.data?.error?.message ?? `Could not load ${isDevice ? "device" : "doctor"} availability`);
      })
      .finally(() => setLoadingSlots(false));
  }, [appointmentId, plannedDate, isDevice, isPastDay]);

  useEffect(() => {
    setError(null);
    load();
  }, [load]);

  async function handleConfirm() {
    if (!picked) return;
    setSubmitting(true);
    setError(null);
    try {
      const claimed = await appointmentsService.claimSlot(appointmentId, { start_time: picked.start_time });
      onClaimed(claimed);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? "That time was just taken — pick another");
      load();
    } finally {
      setSubmitting(false);
    }
  }

  const emptyText = isPastDay
    ? `This date has already passed — contact the clinic to reschedule this ${isDevice ? "session" : "follow-up"}.`
    : loadError
    ? loadError
    : deviceClosed
    ? "This device doesn't run sessions on the planned date — contact the clinic."
    : `No open times left this day on the ${isDevice ? "device" : "doctor's"} calendar — contact the clinic.`;

  return (
    <>
      <div>
        <label className="block text-xs font-medium text-neutral-700 mb-1.5">
          Time
          {isDevice && duration && <span className="text-neutral-400 font-normal"> · each session is {duration} minutes</span>}
        </label>
        <TimeSlotGrid slots={slots} selected={picked} onSelect={setPicked} loading={loadingSlots} emptyText={emptyText} />
      </div>

      {picked && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 mt-4">
          <p className="text-sm font-semibold text-neutral-900">{fmt12(picked.start_time)} – {fmt12(picked.end_time)}</p>
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
