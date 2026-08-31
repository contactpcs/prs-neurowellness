"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui";
import { appointmentsService } from "@/lib/api/services/appointments.service";
import type { Appointment, DeviceDayAvailability } from "@/types/domain.types";

function toMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}
function fmt12(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

const SNAP_MINUTES = 30;

interface DeviceTimelinePickerProps {
  appointmentId: string;
  onClaimed: (appointment: Appointment) => void;
}

/** Continuous red/green day timeline — the device's real booked intervals,
 * not a discrete slot grid. Duration is fixed (this appointment's own
 * billable_items.duration_minutes, resolved server-side); the patient only
 * picks where in the free time a window that long fits. */
export function DeviceTimelinePicker({ appointmentId, onClaimed }: DeviceTimelinePickerProps) {
  const [avail, setAvail] = useState<DeviceDayAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedStart, setSelectedStart] = useState<number | null>(null); // minutes from midnight
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const load = () => {
    setLoading(true);
    setLoadError(null);
    setSelectedStart(null);
    appointmentsService
      .deviceDayAvailability(appointmentId)
      .then(setAvail)
      .catch((e) => setLoadError(e?.response?.data?.error?.message ?? "Could not load device availability"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  const openStartMin = avail?.open_start ? toMinutes(avail.open_start) : 0;
  const openEndMin = avail?.open_end ? toMinutes(avail.open_end) : 0;
  const totalMin = Math.max(1, openEndMin - openStartMin);
  const duration = avail?.duration_minutes ?? 0;

  const blockedRanges = useMemo(() => {
    if (!avail) return [];
    const ranges = avail.busy.map((b) => [toMinutes(b.start_time), toMinutes(b.end_time)] as [number, number]);
    if (avail.break_start && avail.break_end) ranges.push([toMinutes(avail.break_start), toMinutes(avail.break_end)]);
    return ranges;
  }, [avail]);

  function windowIsFree(start: number, end: number): boolean {
    if (start < openStartMin || end > openEndMin) return false;
    return !blockedRanges.some(([bs, be]) => start < be && end > bs);
  }

  // Gridlines every 30 min across the open window.
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let t = Math.ceil(openStartMin / SNAP_MINUTES) * SNAP_MINUTES; t <= openEndMin; t += SNAP_MINUTES) out.push(t);
    return out;
  }, [openStartMin, openEndMin]);

  function pct(min: number): number {
    return ((min - openStartMin) / totalMin) * 100;
  }

  function handleBarClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!barRef.current || !duration) return;
    const rect = barRef.current.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const rawMin = openStartMin + ratio * totalMin;
    const snapped = Math.round(rawMin / SNAP_MINUTES) * SNAP_MINUTES;
    const clamped = Math.min(snapped, openEndMin - duration);
    if (windowIsFree(clamped, clamped + duration)) {
      setSelectedStart(clamped);
      setSubmitError(null);
    }
  }

  async function handleConfirm() {
    if (selectedStart === null) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const claimed = await appointmentsService.claimSlot(appointmentId, { start_time: fromMinutes(selectedStart) });
      onClaimed(claimed);
    } catch (e: any) {
      setSubmitError(e?.response?.data?.error?.message ?? "That window was just taken — pick another");
      load();
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-5 h-5 border-2 border-neutral-200 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (loadError || !avail || !avail.is_open) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center text-neutral-400">
        <CalendarDays className="h-6 w-6" />
        <p className="text-xs">{loadError ?? "This device doesn't run sessions on the planned date — contact the clinic."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">
        Select a <strong>{duration}-minute</strong> window — tap anywhere on the green area.
      </p>

      <div className="relative pt-5 pb-6">
        {/* gridline labels */}
        <div className="relative h-4 mb-1">
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute -translate-x-1/2 text-[9px] text-neutral-400 whitespace-nowrap"
              style={{ left: `${pct(t)}%` }}
            >
              {fmt12(t).replace(":00", "")}
            </span>
          ))}
        </div>

        {/* the bar itself */}
        <div
          ref={barRef}
          onClick={handleBarClick}
          className="relative h-10 rounded-lg bg-success-100 border border-success-200 cursor-pointer overflow-hidden"
        >
          {/* gridlines */}
          {ticks.map((t) => (
            <div key={t} className="absolute top-0 bottom-0 w-px bg-white/60" style={{ left: `${pct(t)}%` }} />
          ))}
          {/* busy/break bands */}
          {blockedRanges.map(([bs, be], i) => (
            <div
              key={i}
              className="absolute top-0 bottom-0 bg-danger-400"
              style={{ left: `${pct(bs)}%`, width: `${pct(be) - pct(bs)}%` }}
            />
          ))}
          {/* selected window */}
          {selectedStart !== null && (
            <div
              className="absolute top-0 bottom-0 bg-primary-600 ring-2 ring-primary-700"
              style={{ left: `${pct(selectedStart)}%`, width: `${pct(selectedStart + duration) - pct(selectedStart)}%` }}
            />
          )}
        </div>
      </div>

      {selectedStart !== null && (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
          <p className="text-sm font-semibold text-neutral-900">
            {fmt12(selectedStart)} – {fmt12(selectedStart + duration)}
          </p>
        </div>
      )}

      {submitError && <p className="text-xs text-danger-600 bg-danger-50 border border-danger-200 rounded-lg px-3 py-2">{submitError}</p>}

      <div className="flex justify-end">
        <Button variant="primary" size="sm" onClick={handleConfirm} disabled={selectedStart === null} isLoading={submitting}>
          Confirm &amp; Continue to Payment
        </Button>
      </div>
    </div>
  );
}
