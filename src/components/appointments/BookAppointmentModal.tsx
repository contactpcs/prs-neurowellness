"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Modal, Button } from "@/components/ui";
import { appointmentsService } from "@/lib/api/services/appointments.service";
import { TimeSlotGrid, upcomingOnly } from "@/components/appointments/TimeSlotGrid";
import type { Appointment, AppointmentType, AvailabilitySlot } from "@/types/domain.types";

const DISPLAY_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}
function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
}
function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function fmt12(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

interface BookAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Which endpoint to book against — determined by the caller from the
   * patient's own appointment history (has a completed initial → follow_up,
   * otherwise initial), same gates the backend itself enforces. */
  appointmentType: AppointmentType;
  onBooked: (appointment: Appointment) => void;
}

export function BookAppointmentModal({ isOpen, onClose, appointmentType, onBooked }: BookAppointmentModalProps) {
  const [weekMonday, setWeekMonday] = useState<Date>(() => getMondayOf(new Date()));
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [picked, setPicked] = useState<AvailabilitySlot | null>(null);
  // Day whose times are shown; the patient picks a time box, then continues.
  const [day, setDay] = useState<string>(() => toDateStr(new Date()));
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayStr = toDateStr(new Date());
  const weekDates = getWeekDates(weekMonday);

  const fetchSlots = useCallback((monday: Date) => {
    setLoadingSlots(true);
    const end = new Date(monday);
    end.setDate(monday.getDate() + 6);
    appointmentsService
      .myAvailability(toDateStr(monday), toDateStr(end))
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setPicked(null);
    setConfirming(false);
    setReason("");
    setError(null);
    fetchSlots(weekMonday);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, weekMonday]);

  const slotsByDate: Record<string, AvailabilitySlot[]> = {};
  for (const s of upcomingOnly(slots)) (slotsByDate[s.date] ??= []).push(s);

  // Moving to another week lands on its first day that's today or later.
  useEffect(() => {
    const first = weekDates.map(toDateStr).find((d) => d >= todayStr);
    setDay(first ?? toDateStr(weekDates[0]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekMonday]);

  const weekLabel = (() => {
    const s = weekDates[0].toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const e = weekDates[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${s} – ${e}`;
  })();

  async function handleConfirm() {
    if (!picked) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = { appointment_date: picked.date, start_time: picked.start_time, reason: reason || undefined };
      const created = appointmentType === "initial"
        ? await appointmentsService.bookInitial(payload)
        : await appointmentsService.bookFollowUp(payload);
      onBooked(created);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? e?.response?.data?.detail ?? "Booking failed — please try another slot");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={appointmentType === "initial" ? "Book Initial Consultation" : "Book Follow-up"} className="max-w-lg">
      {!confirming ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => setWeekMonday((m) => { const d = new Date(m); d.setDate(d.getDate() - 7); return d; })}
                disabled={toDateStr(weekMonday) <= todayStr}
                className="p-1.5 text-neutral-500 border border-neutral-200 rounded-lg hover:bg-neutral-50 disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setWeekMonday((m) => { const d = new Date(m); d.setDate(d.getDate() + 7); return d; })}
                className="p-1.5 text-neutral-500 border border-neutral-200 rounded-lg hover:bg-neutral-50">
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-neutral-700">{weekLabel}</span>
            </div>
            <button onClick={() => setWeekMonday(getMondayOf(new Date()))} className="text-xs font-medium text-primary-600 hover:text-primary-700">
              This week
            </button>
          </div>

          {/* Day */}
          <div className="grid grid-cols-7 gap-1.5">
            {weekDates.map((d, i) => {
              const ds = toDateStr(d);
              const isPast = ds < todayStr;
              const isSel = ds === day;
              const open = (slotsByDate[ds] || []).some((s) => s.is_available);
              return (
                <button
                  key={ds}
                  disabled={isPast}
                  onClick={() => { setDay(ds); setPicked(null); }}
                  className={`flex flex-col items-center py-1.5 rounded-lg border text-xs transition-colors ${
                    isSel
                      ? "bg-primary-600 text-white border-primary-600"
                      : isPast
                      ? "bg-neutral-50 text-neutral-300 border-neutral-100 cursor-not-allowed"
                      : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase">{DISPLAY_DAYS[i]}</span>
                  <span className="text-sm font-bold">{d.getDate()}</span>
                  <span className={`mt-0.5 w-1.5 h-1.5 rounded-full ${!loadingSlots && open && !isPast ? (isSel ? "bg-white" : "bg-green-500") : "bg-transparent"}`} />
                </button>
              );
            })}
          </div>

          {/* Time */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1.5">Time</label>
            <TimeSlotGrid
              slots={slotsByDate[day] || []}
              selected={picked}
              onSelect={setPicked}
              loading={loadingSlots}
              emptyText={day === todayStr ? "No upcoming slots left today — pick another day." : "No slots on this day — pick another day."}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={() => setConfirming(true)} disabled={!picked}>Continue</Button>
          </div>
        </div>
      ) : picked && (
        <div className="space-y-4">
          <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
            <p className="text-sm font-semibold text-neutral-900">
              {new Date(picked.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </p>
            <p className="text-sm text-neutral-600">{fmt12(picked.start_time)} – {fmt12(picked.end_time)}</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Reason (optional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Follow-up on treatment progress"
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          {error && <p className="text-xs text-danger-600 bg-danger-50 border border-danger-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirming(false)} disabled={submitting}>Back</Button>
            <Button variant="primary" size="sm" onClick={handleConfirm} isLoading={submitting}>
              Confirm & Continue to Payment
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
