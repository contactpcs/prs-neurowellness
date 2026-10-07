"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Search, RefreshCw, Stethoscope } from "lucide-react";
import { Card, CardContent, Skeleton } from "@/components/ui";
import { Pager } from "@/components/ui/Pager";
import { adminService } from "@/lib/api/services/admin.service";
import { appointmentsService } from "@/lib/api/services/appointments.service";
import { doctorsService } from "@/lib/api/services/doctors.service";
import { AppointmentDetailModal } from "@/components/appointments/AppointmentDetailModal";
import type { AdminStaffMember } from "@/types/admin.types";
import type { Appointment } from "@/types/domain.types";

const APPT_STATUS_STYLES: Record<string, string> = {
  planned: "bg-neutral-100 text-neutral-600",
  selected: "bg-amber-100 text-amber-700",
  paid: "bg-blue-100 text-blue-700",
  checked_in: "bg-teal-100 text-teal-700",
  in_progress: "bg-amber-100 text-amber-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-neutral-200 text-neutral-600",
  no_show: "bg-red-100 text-red-600",
  rescheduled: "bg-purple-100 text-purple-700",
};

const PAGE_SIZE = 50;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface DoctorSchedule { day_of_week: number; start_time: string; end_time: string; slot_duration_minutes: number }
interface ScheduleOverride { override_id: string; override_date: string; is_available: boolean; reason: string | null }

function timeLabel(t: string | null | undefined) {
  if (!t) return "No time booked yet";
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

function AppointmentsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="bg-white rounded-xl border border-neutral-200/80 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-neutral-100 last:border-0">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Shared by clinic-admin/appointments and regional-admin/appointments
 * (regional_admin picks a clinic first, then renders this with that
 * clinic's id) — same content, same data shape, only the entry point differs. */
export function AppointmentsSection({ clinicId }: { clinicId: string }) {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [staff, setStaff] = useState<AdminStaffMember[]>([]);
  const [doctorSchedules, setDoctorSchedules] = useState<Record<string, DoctorSchedule[]>>({});
  const [doctorOverrides, setDoctorOverrides] = useState<Record<string, ScheduleOverride[]>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<"current" | "upcoming" | "past">("current");
  const [search, setSearch] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("all");
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [byPeriod, setByPeriod] = useState({ past: 0, today: 0, upcoming: 0 });
  const [rowsReady, setRowsReady] = useState(false);
  const [qDebounced, setQDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setQDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => { setPage(1); }, [tab, doctorFilter, qDebounced, clinicId]);

  // Staff + every doctor's schedule/overrides: 1 call each (F-052/F-056),
  // was 2 calls per doctor in a second round.
  async function loadClinic() {
    const [staffRes, schedules, overrides] = await Promise.all([
      adminService.getStaff({ clinic_id: clinicId }),
      doctorsService.listClinicWeeklySchedules(clinicId),
      doctorsService.listClinicScheduleOverrides(clinicId),
    ]);
    setStaff(staffRes.staff);
    setDoctorSchedules(schedules);
    setDoctorOverrides(overrides);
  }

  // One server page of the open tab + tab counts (F-055). A bare list()
  // returned the clinic's OLDEST 100 appointments, so Current/Upcoming were
  // empty and Past was cut at 100. Superseded cancellations kept, as before.
  async function loadRows() {
    const today = new Date().toISOString().slice(0, 10);
    const shift = (days: number) => new Date(Date.parse(today) + days * 86_400_000).toISOString().slice(0, 10);
    const range = tab === "current" ? { date_from: today, date_to: today }
      : tab === "upcoming" ? { date_from: shift(1) }
      : { date_to: shift(-1), date_order: "desc" as const };
    // The select holds profile_id (what appointment rows carry); the API takes doctors.doctor_id.
    const doctorId = doctorFilter === "all" ? undefined : staff.find((d) => (d.profile_id ?? d.id) === doctorFilter)?.id;
    const res = await appointmentsService.page({
      clinic_id: clinicId, ...range, doctor_id: doctorId, search: qDebounced || undefined,
      exclude_superseded: false, period_today: today, page, page_size: PAGE_SIZE,
    });
    setAppointments(res.appointments);
    setTotal(res.total);
    setTotalPages(res.totalPages);
    if (res.counts.by_period) setByPeriod(res.counts.by_period);
    setRowsReady(true);
  }

  async function load(what: "all" | "rows" = "all") {
    setError(null);
    try {
      await Promise.all(what === "all" ? [loadClinic(), loadRows()] : [loadRows()]);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Failed to load appointments");
    }
  }

  useEffect(() => { setIsLoading(true); loadClinic().catch(() => setError("Failed to load appointments")).finally(() => setIsLoading(false)); }, [clinicId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load("rows"); }, [clinicId, tab, doctorFilter, qDebounced, page]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live update — any appointment/request change at this clinic pushes here
  // via SSE. Only the visible page is re-read; staff/schedules don't change.
  useEffect(() => {
    const onAppointmentEvent = () => load("rows");
    window.addEventListener("sse:appointment", onAppointmentEvent);
    return () => window.removeEventListener("sse:appointment", onAppointmentEvent);
  }, [clinicId, tab, doctorFilter, qDebounced, page]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  if (isLoading || (!rowsReady && !error)) return <AppointmentsSkeleton />;

  const doctors = staff.filter((s) => s.role === "doctor");

  const todayStr = new Date().toISOString().slice(0, 10);
  const currentCount = byPeriod.today;
  const upcomingCount = byPeriod.upcoming;
  const pastCount = byPeriod.past;

  const filtered = appointments; // tab, doctor, search and order applied server-side

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Appointments</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{currentCount + upcomingCount + pastCount} total</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} title="Refresh"
          className="p-2.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1 w-fit">
        {([
          { key: "current", label: "Current", count: currentCount },
          { key: "upcoming", label: "Upcoming", count: upcomingCount },
          { key: "past", label: "Past", count: pastCount },
        ] as const).map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === t.key ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
            }`}>
            {t.label}
            <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 min-w-[18px] text-center ${
              tab === t.key ? "bg-blue-100 text-blue-700" : "bg-neutral-200 text-neutral-500"
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by patient…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg bg-white" />
        </div>
        <select value={doctorFilter} onChange={(e) => setDoctorFilter(e.target.value)} className="px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white">
          <option value="all">All Doctors</option>
          {/* appointments.doctor_id is profiles.id, not doctors.doctor_id — filter by profile_id to match. */}
          {doctors.map((d) => <option key={d.id} value={d.profile_id ?? d.id}>{d.first_name} {d.last_name}</option>)}
        </select>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <CardContent className="py-16 text-center">
            <CalendarDays className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-600">No {tab} appointments</p>
          </CardContent>
        ) : (
          <div className="divide-y divide-neutral-100">
            {filtered.map((a) => (
              <div key={a.appointment_id} className="flex items-center justify-between px-6 py-4">
                <div>
                  <button
                    onClick={() => setSelectedAppointment(a)}
                    className="text-sm font-medium text-neutral-900 hover:text-primary-600 hover:underline transition-colors text-left"
                  >
                    {a.patient_name ?? "Unknown patient"}
                  </button>
                  <p className="text-xs text-neutral-400 mt-0.5">{a.appointment_date} · {a.start_time && a.end_time ? `${timeLabel(a.start_time)}–${timeLabel(a.end_time)}` : "No time booked yet"} · Dr. {a.doctor_name ?? "Unknown"}</p>
                  <p className="text-xs text-neutral-400 capitalize">{a.appointment_type.replace(/_/g, " ")}</p>
                  {/* a.rescheduled_from: this row replaced an earlier
                      appointment — distinct from status==='rescheduled',
                      which is the OLD superseded row instead. */}
                  {a.rescheduled_from && (
                    <p className="text-xs text-purple-600 mt-0.5">
                      ↻ Originally booked for {a.rescheduled_from_date ?? "—"}
                      {a.rescheduled_from_start_time ? ` · ${timeLabel(a.rescheduled_from_start_time)}` : ""}
                    </p>
                  )}
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize flex-shrink-0 ${APPT_STATUS_STYLES[a.status] ?? "bg-neutral-100 text-neutral-600"}`}>
                  {a.status.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
      <Pager page={page} totalPages={totalPages} total={total} noun="appointments" onPage={setPage} />

      <div>
        <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Stethoscope className="h-4 w-4" />Doctors' Schedule
        </h2>
        {doctors.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-neutral-500">No doctors at this clinic</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {doctors.map((d) => {
              const schedule = doctorSchedules[d.id] ?? [];
              const overrides = (doctorOverrides[d.id] ?? []).filter((o) => o.override_date >= todayStr);
              return (
                <Card key={d.id}>
                  <CardContent className="p-4 space-y-2">
                    <p className="text-sm font-semibold text-neutral-900">Dr. {d.first_name} {d.last_name}</p>
                    <div className="space-y-1">
                      {DAY_NAMES.map((name, dow) => {
                        const slot = schedule.find((s) => s.day_of_week === dow);
                        return (
                          <div key={dow} className="flex items-center justify-between text-xs">
                            <span className="text-neutral-500">{name}</span>
                            <span className={slot ? "text-neutral-800 font-medium" : "text-neutral-300"}>
                              {slot ? `${timeLabel(slot.start_time)} – ${timeLabel(slot.end_time)}` : "Off"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {overrides.length > 0 && (
                      <div className="pt-2 border-t border-neutral-100 space-y-1">
                        <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wide">Upcoming Exceptions</p>
                        {overrides.map((o) => (
                          <div key={o.override_id} className="flex items-center justify-between text-xs">
                            <span className="text-neutral-600">{o.override_date}{o.reason ? ` — ${o.reason}` : ""}</span>
                            <span className={o.is_available ? "text-green-600" : "text-red-500"}>{o.is_available ? "Available" : "Unavailable"}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <AppointmentDetailModal
        appointment={selectedAppointment}
        isOpen={!!selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
      />
    </div>
  );
}
