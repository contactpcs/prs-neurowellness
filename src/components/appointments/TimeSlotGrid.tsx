"use client";

import { Loader2, CalendarDays } from "lucide-react";

// Same box grid as the receptionist's Book Appointment time picker, shared by
// the patient booking/claim modals. Device slots also carry capacity/remaining.
export type GridSlot = {
  date: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  capacity?: number;
  remaining?: number;
};

function fmt12(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Slots that have already started are dropped. */
export function upcomingOnly<T extends GridSlot>(slots: T[]): T[] {
  const now = Date.now();
  return slots.filter((s) => new Date(`${s.date}T${s.start_time}`).getTime() > now);
}

export function TimeSlotGrid<T extends GridSlot>({
  slots, selected, onSelect, loading, emptyText, showRemaining = false,
}: {
  slots: T[];
  selected: T | null;
  onSelect: (slot: T) => void;
  loading: boolean;
  emptyText: string;
  /** Device slots: show "N free" under each time. */
  showRemaining?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-neutral-400 py-3">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading slots…
      </div>
    );
  }
  if (slots.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-neutral-400 py-3">
        <CalendarDays className="w-4 h-4" /> {emptyText}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-60 overflow-y-auto">
      {slots.map((s) => {
        const picked = selected?.date === s.date && selected?.start_time === s.start_time;
        return (
          <button
            key={`${s.date}-${s.start_time}`}
            disabled={!s.is_available}
            onClick={() => onSelect(s)}
            title={
              !s.is_available
                ? (showRemaining ? "Device fully booked" : "Already booked")
                : `${fmt12(s.start_time)} – ${fmt12(s.end_time)}${showRemaining && s.remaining != null ? ` · ${s.remaining} of ${s.capacity} free` : ""}`
            }
            className={`text-xs font-medium px-2 py-1.5 rounded-md border transition-colors ${
              !s.is_available
                ? "bg-neutral-100 text-neutral-400 border-neutral-200 line-through cursor-not-allowed"
                : picked
                ? "bg-primary-600 text-white border-primary-600"
                : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
            }`}
          >
            {fmt12(s.start_time)}
            {showRemaining && s.is_available && s.remaining != null && (
              <span className={`block text-[10px] ${picked ? "text-white/80" : "text-green-600/80"}`}>{s.remaining} free</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
