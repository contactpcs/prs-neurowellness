"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, CalendarDays, Info } from "lucide-react";
import { Modal, Button } from "@/components/ui";
import { appointmentsService, type RescheduleOptions } from "@/lib/api/services/appointments.service";
import type { Appointment, AvailabilitySlot } from "@/types/domain.types";

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

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment;
  onRescheduled: (appointment: Appointment) => void;
  /** From myRescheduleOptions(): limits the pickable dates (e.g. the two
   * days after a course ends for a missed device session) and carries the
   * reason to show. */
  options?: RescheduleOptions | null;
}

/** Moves a booked or missed appointment to a new slot. Mirrors
 * BookAppointmentModal's week-view picker, just calls myReschedule() on an
 * EXISTING appointment. A device session picks from its clinic device's
 * slots; everything else from the doctor's calendar. Dates outside
 * options.earliest_date..latest_date are not offered. A still-'planned'
 * protocol session uses ClaimSlotModal instead. */
export function RescheduleModal({ isOpen, onClose, appointment, onRescheduled, options }: RescheduleModalProps) {
  const isDevice = appointment.appointment_type === "device_session";
  const earliest = options?.earliest_date ?? null;
  const latest = options?.latest_date ?? null;
  const [weekMonday, setWeekMonday] = useState<Date>(() => getMondayOf(earliest ? new Date(earliest + "T00:00:00") : new Date()));
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [picked, setPicked] = useState<AvailabilitySlot | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayStr = toDateStr(new Date());
  const weekDates = getWeekDates(weekMonday);

  const fetchSlots = useCallback((monday: Date) => {
    setLoadingSlots(true);
    const end = new Date(monday);
    end.setDate(monday.getDate() + 6);
    (isDevice
      ? appointmentsService.deviceAvailability(appointment.appointment_id, toDateStr(monday), toDateStr(end))
      : appointmentsService.myAvailability(toDateStr(monday), toDateStr(end))
    )
      .then((rows) => setSlots(rows.filter((r) => (!earliest || r.date >= earliest) && (!latest || r.date <= latest))))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [isDevice, appointment.appointment_id, earliest, latest]);

  useEffect(() => {
    if (!isOpen) return;
    setPicked(null);
    setReason("");
    setError(null);
    fetchSlots(weekMonday);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, weekMonday]);

  const slotsByDate: Record<string, AvailabilitySlot[]> = {};
  for (const s of slots) (slotsByDate[s.date] ??= []).push(s);

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
      const updated = await appointmentsService.myReschedule(appointment.appointment_id, {
        appointment_date: picked.date,
        start_time: picked.start_time,
        reason: reason || undefined,
      });
      onRescheduled(updated);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? e?.response?.data?.detail ?? "Reschedule failed — please try another slot");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reschedule Appointment" className="max-w-2xl">
      {options?.date_rule_reason && (
        <div className="flex items-start gap-2 mb-3 rounded-lg border border-primary-100 bg-primary-50 px-3 py-2.5">
          <Info className="h-4 w-4 text-primary-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-primary-800 leading-relaxed">{options.date_rule_reason}</p>
        </div>
      )}
      {!picked ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setWeekMonday((m) => { const d = new Date(m); d.setDate(d.getDate() - 7); return d; })}
                className="p-1.5 text-neutral-500 border border-neutral-200 rounded-lg hover:bg-neutral-50">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setWeekMonday((m) => { const d = new Date(m); d.setDate(d.getDate() + 7); return d; })}
                className="p-1.5 text-neutral-500 border border-neutral-200 rounded-lg hover:bg-neutral-50">
                <ChevronRight className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-neutral-700">{weekLabel}</span>
            </div>
            <button
              onClick={() => setWeekMonday(getMondayOf(earliest ? new Date(earliest + "T00:00:00") : new Date()))}
              className="text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              {earliest ? "First allowed week" : "This week"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <div className="grid" style={{ gridTemplateColumns: "repeat(7, 1fr)", minWidth: 560 }}>
              {weekDates.map((d, i) => {
                const ds = toDateStr(d);
                const isToday = ds === todayStr;
                const daySlots = (slotsByDate[ds] || []).filter((s) => s.is_available);
                return (
                  <div key={i} className="border-r border-neutral-100 last:border-r-0">
                    <div className="text-center py-2 px-1 border-b border-neutral-100">
                      <div className="text-[10px] font-semibold text-neutral-500 uppercase">{DISPLAY_DAYS[i]}</div>
                      <div className={`inline-flex items-center justify-center w-7 h-7 mx-auto mt-1 rounded-full text-xs font-bold ${isToday ? "bg-brand-gradient text-white" : "text-neutral-700"}`}>
                        {d.getDate()}
                      </div>
                    </div>
                    <div className="p-1.5 space-y-1 min-h-[120px]">
                      {loadingSlots ? (
                        <div className="flex items-center justify-center h-16">
                          <div className="w-4 h-4 border-2 border-neutral-200 border-t-primary-500 rounded-full animate-spin" />
                        </div>
                      ) : daySlots.length === 0 ? (
                        <div className="flex items-center justify-center h-16">
                          <span className="text-[10px] text-neutral-300">no slots</span>
                        </div>
                      ) : (
                        daySlots.map((s) => (
                          <button
                            key={s.start_time}
                            onClick={() => setPicked(s)}
                            className="w-full text-[11px] font-medium px-1.5 py-1 rounded-md text-center bg-success-50 text-success-700 border border-success-100 hover:bg-success-100 transition-colors"
                          >
                            {fmt12(s.start_time)}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {!loadingSlots && slots.every((s) => !s.is_available) && (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-neutral-400">
              <CalendarDays className="h-6 w-6" />
              <p className="text-xs">No open slots this week — try the next one.</p>
            </div>
          )}
        </div>
      ) : (
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
              placeholder="e.g. Missed the original slot"
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>
          {error && <p className="text-xs text-danger-600 bg-danger-50 border border-danger-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setPicked(null)} disabled={submitting}>Back</Button>
            <Button variant="primary" size="sm" onClick={handleConfirm} isLoading={submitting}>
              Confirm New Slot
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
