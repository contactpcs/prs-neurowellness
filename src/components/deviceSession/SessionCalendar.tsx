"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { deviceSessionLabel, deviceSessionColors, type SessionTone } from "@/lib/utils/deviceSessionStatus";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_CHIPS = 3;

export interface CalendarSession {
  id: string;
  /** YYYY-MM-DD, as appointment_date comes from the API. */
  date: string;
  time?: string | null;
  status: string;
  /** Short chip text, e.g. "#3" or "Jane D. #3". */
  label: string;
  /** Follow-ups get a dashed chip so they read apart from device sessions. */
  kind?: "session" | "follow_up";
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtTime(t?: string | null): string {
  return t && t.length >= 5 ? t.slice(0, 5) : "";
}

/** Month to open on: the month of the next session from today, else the
 * latest session's month, else this month. */
function initialMonth(sessions: CalendarSession[]): Date {
  const today = toDateStr(new Date());
  const dates = sessions.map((s) => s.date).filter(Boolean).sort();
  const pick = dates.find((d) => d >= today) ?? dates[dates.length - 1];
  const base = pick ? new Date(`${pick}T00:00`) : new Date();
  return Number.isNaN(base.getTime()) ? new Date() : new Date(base.getFullYear(), base.getMonth(), 1);
}

interface SessionCalendarProps {
  sessions: CalendarSession[];
  /** Chip click. Omit to make chips inert. */
  onSelectSession?: (s: CalendarSession) => void;
  /** Status -> label; defaults to the staff vocabulary (deviceSessionLabel). */
  labelFor?: (status?: string | null) => string;
  /** Status -> colours; defaults to the staff palette (deviceSessionColors). */
  colorsFor?: (status?: string | null) => SessionTone;
  /** When given, clicking a day selects it and this renders under the grid. */
  renderSelectedDay?: (dateStr: string, sessions: CalendarSession[]) => ReactNode;
}

/**
 * Month grid of device sessions — hand-rolled date math like
 * PatientMonthCalendar/DoctorWeekCalendar, no calendar library. Each session
 * is a chip coloured by its status, using the same palette as the session
 * list badges and filter buttons (deviceSessionStatus.ts).
 */
export function SessionCalendar({
  sessions,
  onSelectSession,
  labelFor = deviceSessionLabel,
  colorsFor = deviceSessionColors,
  renderSelectedDay,
}: SessionCalendarProps) {
  const [viewMonth, setViewMonth] = useState(() => initialMonth(sessions));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const todayStr = toDateStr(new Date());

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarSession[]>();
    for (const s of sessions) {
      if (!s.date) continue;
      const list = map.get(s.date) ?? [];
      list.push(s);
      map.set(s.date, list);
    }
    for (const list of map.values()) list.sort((a, b) => (a.time || "99").localeCompare(b.time || "99"));
    return map;
  }, [sessions]);

  const cells = useMemo(() => {
    const first = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - first.getDay());
    const last = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);
    // 5 or 6 weeks — only as many rows as the month needs.
    const weeks = Math.ceil((first.getDay() + last.getDate()) / 7);
    return Array.from({ length: weeks * 7 }, (_, i) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      return { date, dateStr: toDateStr(date), inMonth: date.getMonth() === viewMonth.getMonth() };
    });
  }, [viewMonth]);

  const monthCount = useMemo(() => {
    const prefix = `${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, "0")}`;
    return sessions.filter((s) => s.date?.startsWith(prefix)).length;
  }, [sessions, viewMonth]);

  // Legend: each status on the calendar, with its colour and count.
  const legend = useMemo(() => {
    const seen = new Map<string, { dot: string; count: number }>();
    for (const s of sessions) {
      const label = labelFor(s.status);
      const entry = seen.get(label) ?? { dot: colorsFor(s.status).dot, count: 0 };
      entry.count += 1;
      seen.set(label, entry);
    }
    return Array.from(seen.entries());
  }, [sessions, labelFor, colorsFor]);

  const shift = (months: number) => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + months, 1));
  const selectable = !!renderSelectedDay;

  return (
    <div className="space-y-3">
      <div className="bg-white border border-neutral-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-neutral-100">
          <div>
            <p className="text-lg font-bold text-neutral-900">
              {viewMonth.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
            </p>
            <p className="text-sm text-neutral-500">{monthCount} session{monthCount === 1 ? "" : "s"} this month</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
              className="h-9 px-3 rounded-lg text-sm font-semibold text-neutral-700 border border-neutral-200 hover:bg-neutral-100"
            >
              Today
            </button>
            <button onClick={() => shift(-1)} className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600" aria-label="Previous month">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button onClick={() => shift(1)} className="p-2 rounded-lg hover:bg-neutral-100 text-neutral-600" aria-label="Next month">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {legend.length > 0 && (
          <div className="flex flex-wrap gap-x-5 gap-y-2 px-4 py-3 border-b border-neutral-100 bg-neutral-50/60">
            {legend.map(([label, { dot, count }]) => (
              <span key={label} className="flex items-center gap-2 text-sm font-medium text-neutral-800">
                <span className={cn("w-3.5 h-3.5 rounded-full flex-shrink-0", dot)} />
                {label}
                <span className="text-neutral-400 font-normal">({count})</span>
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-7 border-b border-neutral-100 bg-neutral-50">
          {WEEKDAYS.map((w) => (
            <div key={w} className="py-2 text-center text-xs font-semibold text-neutral-600 uppercase tracking-wide">
              <span className="sm:hidden">{w[0]}</span>
              <span className="hidden sm:inline">{w}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map(({ date, dateStr, inMonth }) => {
            const day = byDate.get(dateStr) ?? [];
            const isToday = dateStr === todayStr;
            const isSelected = selectable && dateStr === selectedDate;
            return (
              <div
                key={dateStr}
                onClick={selectable ? () => setSelectedDate(isSelected ? null : dateStr) : undefined}
                className={cn(
                  "min-h-[72px] sm:min-h-[112px] border-b border-r border-neutral-100 p-1 sm:p-1.5 flex flex-col gap-1 [&:nth-child(7n)]:border-r-0",
                  !inMonth && "bg-neutral-50/60",
                  selectable && "cursor-pointer hover:bg-neutral-50",
                  isSelected && "bg-primary-50 hover:bg-primary-50 ring-1 ring-inset ring-primary-300",
                )}
              >
                <span
                  className={cn(
                    "text-sm w-7 h-7 flex items-center justify-center rounded-full",
                    inMonth ? "text-neutral-800 font-medium" : "text-neutral-300",
                    isToday && "bg-primary-600 text-white font-bold",
                  )}
                >
                  {date.getDate()}
                </span>

                {/* Mobile: one solid dot per session. */}
                {day.length > 0 && (
                  <div className="flex flex-wrap gap-1 sm:hidden">
                    {day.slice(0, 4).map((s) => (
                      <span key={s.id} className={cn("w-2.5 h-2.5 rounded-full", colorsFor(s.status).dot)} />
                    ))}
                    {day.length > 4 && <span className="text-[10px] leading-none text-neutral-500">+</span>}
                  </div>
                )}

                {/* Desktop: chips with a coloured left stripe. */}
                <div className="hidden sm:flex flex-col gap-1 min-w-0">
                  {day.slice(0, MAX_CHIPS).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      title={`${s.label}${s.time ? ` · ${fmtTime(s.time)}` : ""} · ${labelFor(s.status)}`}
                      onClick={(e) => {
                        if (!onSelectSession) return;
                        e.stopPropagation();
                        onSelectSession(s);
                      }}
                      className={cn(
                        "w-full truncate text-left text-xs font-semibold leading-snug px-1.5 py-1 rounded border-l-4",
                        colorsFor(s.status).badge,
                        s.kind === "follow_up" && "border border-l-4 border-dashed",
                        onSelectSession ? "hover:brightness-95" : "cursor-default",
                      )}
                    >
                      {fmtTime(s.time) && <span className="font-normal opacity-75 mr-1">{fmtTime(s.time)}</span>}
                      {s.label}
                    </button>
                  ))}
                  {day.length > MAX_CHIPS && (
                    <span className="text-xs font-medium text-neutral-500 px-1.5">+{day.length - MAX_CHIPS} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectable &&
        (selectedDate ? (
          renderSelectedDay!(selectedDate, byDate.get(selectedDate) ?? [])
        ) : (
          <p className="text-sm text-neutral-500 px-1">Select a day to see its sessions.</p>
        ))}
    </div>
  );
}
