"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Appointment, AppointmentType } from "@/types/domain.types";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const TYPE_DOT: Record<AppointmentType, string> = {
  initial: "bg-blue-500",
  follow_up: "bg-blue-400",
  protocol_followup: "bg-purple-500",
  device_session: "bg-orange-500",
};

const TYPE_LABEL: Record<AppointmentType, string> = {
  initial: "Initial",
  follow_up: "Follow-up",
  protocol_followup: "Protocol",
  device_session: "Device",
};

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface PatientMonthCalendarProps {
  appointments: Appointment[];
  selectedDate: string | null;
  onSelectDate: (dateStr: string) => void;
}

/**
 * Plain month grid, no calendar library (matches the rest of the codebase —
 * BookAppointmentModal/DoctorWeekCalendar both hand-roll date math too).
 * Read-only display + date selection; the day-detail list and payment flow
 * live in the parent page.
 */
export function PatientMonthCalendar({ appointments, selectedDate, onSelectDate }: PatientMonthCalendarProps) {
  const [viewMonth, setViewMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const todayStr = toDateStr(new Date());

  const apptsByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      if (!a.appointment_date) continue;
      const list = map.get(a.appointment_date) ?? [];
      list.push(a);
      map.set(a.appointment_date, list);
    }
    return map;
  }, [appointments]);

  const cells = useMemo(() => {
    const firstOfMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const startOffset = firstOfMonth.getDay(); // 0 = Sunday
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() - startOffset);

    return Array.from({ length: 42 }, (_, i) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      return { date, dateStr: toDateStr(date), inMonth: date.getMonth() === viewMonth.getMonth() };
    });
  }, [viewMonth]);

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-neutral-900">
          {viewMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>
        <div className="flex gap-1">
          <button
            onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
            className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="text-center text-[10px] font-semibold text-neutral-400 uppercase py-1">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map(({ date, dateStr, inMonth }) => {
          const dayAppts = apptsByDate.get(dateStr) ?? [];
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          return (
            <button
              key={dateStr}
              disabled={!inMonth}
              onClick={() => onSelectDate(dateStr)}
              className={cn(
                "min-h-[60px] rounded-lg flex flex-col items-center justify-start pt-1 px-0.5 gap-0.5 text-xs transition-colors overflow-hidden",
                !inMonth && "invisible",
                isSelected ? "bg-blue-600 text-white" : isToday ? "bg-blue-50 text-blue-700 font-semibold" : "hover:bg-neutral-50 text-neutral-700",
              )}
            >
              <span>{date.getDate()}</span>
              {dayAppts.length === 1 && (
                <span
                  className={cn(
                    "text-[8px] leading-tight px-1 py-0.5 rounded-full truncate max-w-full",
                    isSelected ? "bg-white/20 text-white" : "text-neutral-600",
                  )}
                >
                  {TYPE_LABEL[dayAppts[0].appointment_type] ?? dayAppts[0].appointment_type}
                </span>
              )}
              {dayAppts.length > 1 && (
                <span className={cn("text-[8px] leading-tight font-medium", isSelected ? "text-white" : "text-neutral-500")}>
                  {dayAppts.length} visits
                </span>
              )}
              {dayAppts.length > 0 && (
                <div className="flex gap-0.5">
                  {dayAppts.slice(0, 3).map((a) => (
                    <span
                      key={a.appointment_id}
                      className={cn("w-1.5 h-1.5 rounded-full", isSelected ? "bg-white" : TYPE_DOT[a.appointment_type] ?? "bg-neutral-400")}
                    />
                  ))}
                  {dayAppts.length > 3 && <span className={cn("text-[8px] leading-none", isSelected ? "text-white" : "text-neutral-400")}>+</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t border-neutral-100 text-[11px] text-neutral-500">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-blue-500" />Consultation</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-500" />Protocol Visit</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-500" />Device Session</span>
      </div>
    </div>
  );
}
