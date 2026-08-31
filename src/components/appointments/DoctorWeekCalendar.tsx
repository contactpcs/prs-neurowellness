"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { BookingModal } from "@/components/appointments/BookingModal";
import type { AvailabilitySlot } from "@/types/domain.types";

const DISPLAY_DAYS = [
  { label: "Monday",    short: "Mon", dow: 1 },
  { label: "Tuesday",   short: "Tue", dow: 2 },
  { label: "Wednesday", short: "Wed", dow: 3 },
  { label: "Thursday",  short: "Thu", dow: 4 },
  { label: "Friday",    short: "Fri", dow: 5 },
  { label: "Saturday",  short: "Sat", dow: 6 },
  { label: "Sunday",    short: "Sun", dow: 0 },
];

const BRAND_GRADIENT = "linear-gradient(135deg, #00A1E4 0%, #09172E 100%)";

function getMondayOf(d: Date): Date {
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  mon.setHours(0, 0, 0, 0);
  return mon;
}

function getWeekDates(monday: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
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

/** Same weekly slot-grid as the doctor's own /doctor/schedule page, but for
 * any doctor the caller picks — used by staff (receptionist/admin) who need
 * to see a doctor's calendar and book directly into an open slot, without
 * the doctor-only weekly-template/override editing that page also has. */
export function DoctorWeekCalendar({ doctorId }: { doctorId: string }) {
  const today = new Date();
  const todayStr = toDateStr(today);

  const [weekMonday, setWeekMonday] = useState<Date>(() => getMondayOf(new Date()));
  const weekDates = getWeekDates(weekMonday);

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingSlot, setBookingSlot] = useState<AvailabilitySlot | null>(null);

  const fetchSlots = useCallback(async (monday: Date) => {
    if (!doctorId) return;
    setLoadingSlots(true);
    try {
      const dateFrom = toDateStr(monday);
      const end = new Date(monday);
      end.setDate(monday.getDate() + 6);
      const dateTo = toDateStr(end);
      const { data } = await apiClient.get(ENDPOINTS.SCHEDULE.SLOTS(doctorId), {
        params: { from_date: dateFrom, to_date: dateTo, include_unavailable: true },
      });
      setSlots(Array.isArray(data) ? data : []);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [doctorId]);

  useEffect(() => { fetchSlots(weekMonday); }, [weekMonday, fetchSlots]);

  useEffect(() => {
    const onAppointmentEvent = () => fetchSlots(weekMonday);
    window.addEventListener("sse:appointment", onAppointmentEvent);
    return () => window.removeEventListener("sse:appointment", onAppointmentEvent);
  }, [weekMonday, fetchSlots]);

  const slotsByDate: Record<string, AvailabilitySlot[]> = {};
  for (const s of slots) {
    (slotsByDate[s.date] ??= []).push(s);
  }

  const weekLabel = (() => {
    const s = weekDates[0].toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const e = weekDates[6].toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return `${s} – ${e}`;
  })();

  const prevWeek = () => setWeekMonday((m) => { const d = new Date(m); d.setDate(d.getDate() - 7); return d; });
  const nextWeek = () => setWeekMonday((m) => { const d = new Date(m); d.setDate(d.getDate() + 7); return d; });

  if (!doctorId) {
    return <div className="py-10 text-center text-sm text-neutral-400">Select a doctor to view their calendar.</div>;
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-card overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 flex-wrap gap-2">
        <h2 className="text-base font-semibold text-neutral-900">Weekly Slots</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekMonday(getMondayOf(new Date()))}
            className="px-3 py-1.5 text-sm font-medium text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors"
          >
            Today
          </button>
          <button onClick={prevWeek} className="p-1.5 text-neutral-500 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button onClick={nextWeek} className="p-1.5 text-neutral-500 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium text-neutral-700 min-w-[180px]">{weekLabel}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid" style={{ gridTemplateColumns: "repeat(7, 1fr)", minWidth: 560 }}>
          {weekDates.map((d, i) => {
            const ds = toDateStr(d);
            const isToday = ds === todayStr;
            const daySlots = slotsByDate[ds] || [];
            const freeCount = daySlots.filter((s) => s.is_available).length;

            return (
              <div key={i} className="border-r border-neutral-100 last:border-r-0">
                <div className="text-center py-3 px-2 border-b border-neutral-100">
                  <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                    {DISPLAY_DAYS[i].short}
                  </div>
                  <div
                    className="inline-flex items-center justify-center w-8 h-8 mx-auto mt-1 rounded-full text-sm font-bold"
                    style={isToday ? { background: BRAND_GRADIENT, color: "#fff" } : { color: "#262626" }}
                  >
                    {d.getDate()}
                  </div>
                  {daySlots.length > 0 && (
                    <div className="text-[10px] text-neutral-400 mt-1">{freeCount}/{daySlots.length} free</div>
                  )}
                </div>

                <div className="p-2 space-y-1 min-h-[140px]">
                  {loadingSlots ? (
                    <div className="flex items-center justify-center h-16">
                      <div className="w-4 h-4 border-2 border-neutral-200 border-t-sky-400 rounded-full animate-spin" />
                    </div>
                  ) : daySlots.length === 0 ? (
                    <div className="flex items-center justify-center h-16">
                      <span className="text-[11px] text-neutral-300">no slots</span>
                    </div>
                  ) : (
                    daySlots.map((slot) => (
                      <button
                        key={slot.start_time}
                        disabled={!slot.is_available}
                        onClick={() => slot.is_available && setBookingSlot(slot)}
                        title={slot.is_available ? `Book ${fmt12(slot.start_time)} – ${fmt12(slot.end_time)}` : "Already booked"}
                        className={`w-full text-[11px] font-medium px-1.5 py-1 rounded-md text-center transition-all ${
                          slot.is_available
                            ? "bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 cursor-pointer"
                            : "bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-default line-through"
                        }`}
                      >
                        {fmt12(slot.start_time)}
                      </button>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-6 px-6 py-3 border-t border-neutral-100">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-100 border border-green-300" />
          <span className="text-xs text-neutral-500">Available — click to book</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-neutral-100 border border-neutral-200" />
          <span className="text-xs text-neutral-500">Already booked</span>
        </div>
      </div>

      {bookingSlot && (
        <BookingModal
          slot={bookingSlot}
          doctorId={doctorId}
          onClose={() => setBookingSlot(null)}
          onSuccess={() => { setBookingSlot(null); fetchSlots(weekMonday); }}
        />
      )}
    </div>
  );
}
