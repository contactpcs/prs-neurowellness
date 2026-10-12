"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, ClipboardCheck, UserPlus, ArrowRight, Clock, CheckCircle, Stethoscope,
  CalendarPlus, LogIn,
} from "lucide-react";
import { useAuth, useReceptionDashboard } from "@/lib/hooks";
import { PageSkeleton, Card, CardContent } from "@/components/ui";
import { receptionService } from "@/lib/api/services/reception.service";
import { DoctorWeekCalendar } from "@/components/appointments/DoctorWeekCalendar";
import { ReceptionBookAppointmentModal } from "@/components/appointments/ReceptionBookAppointmentModal";
import RegisterPatientModal from "../patients/RegisterPatientModal";
import type { AvailabilitySlot, DoctorListItem } from "@/types/domain.types";

export default function ReceptionistDashboard() {
  const { user } = useAuth();
  // One call: counts + first 5 pending (API audit F-019) — used to download
  // every patient and every pending registration to count them.
  const { dashboard, isLoading } = useReceptionDashboard();
  const pending = dashboard?.pending_preview ?? [];

  const [doctors, setDoctors] = useState<DoctorListItem[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState("");
  const [calendarView, setCalendarView] = useState<"single" | "all">("single");
  const [showRegister, setShowRegister] = useState(false);
  const [showBooking, setShowBooking] = useState(false);
  // Doctor/date/time when booking was opened from a calendar slot.
  const [bookingPrefill, setBookingPrefill] = useState<{ doctorId: string; date: string; startTime: string } | null>(null);
  const openBookingFromSlot = (slot: AvailabilitySlot, doctorId: string) => {
    setBookingPrefill({ doctorId, date: slot.date, startTime: slot.start_time });
    setShowBooking(true);
  };

  useEffect(() => {
    receptionService.getDoctors().then(({ doctors: d }) => {
      setDoctors(d);
      setSelectedDoctorId((prev) => prev || d[0]?.id || "");
    }).catch(() => {});
  }, []);

  const totalPatients = dashboard?.patient_count ?? 0;
  const pendingCount  = dashboard?.pending_count ?? 0;
  const registeredToday = dashboard?.registered_today ?? 0;

  if (isLoading) return <PageSkeleton />;

  const stats = [
    { label: "Total Patients",    value: totalPatients,  icon: Users,         color: "text-primary-600",  bg: "bg-primary-50",  href: "/receptionist/patients"  },
    { label: "Pending Approvals", value: pendingCount,   icon: ClipboardCheck,color: "text-warning-700",  bg: "bg-warning-50",  href: "/receptionist/approvals"  },
    { label: "Registered Today",  value: registeredToday,icon: UserPlus,      color: "text-success-700",  bg: "bg-success-50",  href: "/receptionist/patients"   },
  ];

  const quickActions = [
    { label: "Register Patient",    icon: UserPlus,       onClick: () => setShowRegister(true) },
    { label: "Book Appointment",    icon: CalendarPlus,   onClick: () => { setBookingPrefill(null); setShowBooking(true); } },
    { label: "Check-In Patient",    icon: LogIn,          href: "/receptionist/appointments" },
    { label: "Pending Approvals",   icon: ClipboardCheck, href: "/receptionist/approvals" },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Welcome , {user?.first_name}</h1>
        {user?.clinic_name && (
          <p className="text-xs font-medium text-primary-600 mt-0.5">{user.clinic_name}</p>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="hover:shadow-card-hover transition-shadow cursor-pointer">
              <CardContent className="flex items-center gap-4">
                <div className={`w-[34px] h-[34px] rounded-lg ${s.bg} flex items-center justify-center ${s.color} flex-shrink-0`}>
                  <s.icon className="h-[17px] w-[17px]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-neutral-900 leading-tight">{s.value}</p>
                  <p className="text-xs text-neutral-500 leading-tight mt-0.5">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {quickActions.map((q) => {
          const content = (
            <>
              <span className="w-[34px] h-[34px] rounded-lg bg-primary-50 flex items-center justify-center text-primary-600">
                <q.icon className="h-[17px] w-[17px]" />
              </span>
              <span className="text-xs font-medium text-neutral-700 text-center leading-tight">{q.label}</span>
            </>
          );
          const className = "flex flex-col items-center justify-center gap-2 px-2 py-4 rounded-xl border border-neutral-200 bg-white shadow-xs hover:shadow-card transition-shadow";
          return q.href ? (
            <Link key={q.label} href={q.href} className={className}>{content}</Link>
          ) : (
            <button key={q.label} onClick={q.onClick} className={className}>{content}</button>
          );
        })}
      </div>

      {/* Doctor calendar — same weekly slot-grid as the doctor's own
          schedule page. "Single" switches across one doctor at a time;
          "All" stacks every doctor's calendar at this clinic at once. */}
      <section>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide flex items-center gap-1.5">
            <Stethoscope className="h-4 w-4" />Doctor Calendar
          </h2>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1">
              <button
                onClick={() => setCalendarView("single")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  calendarView === "single" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                Single Doctor
              </button>
              <button
                onClick={() => setCalendarView("all")}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  calendarView === "all" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                All Doctors
              </button>
            </div>
            {calendarView === "single" && (
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="px-3 py-1.5 text-sm border border-neutral-200 rounded-lg bg-white"
              >
                {doctors.length === 0 && <option value="">No doctors at this clinic</option>}
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {calendarView === "single" ? (
          <DoctorWeekCalendar doctorId={selectedDoctorId} onSlotClick={openBookingFromSlot} />
        ) : doctors.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-neutral-500">No doctors at this clinic</CardContent></Card>
        ) : (
          <div className="space-y-6">
            {doctors.map((d) => (
              <div key={d.id}>
                <p className="text-sm font-semibold text-neutral-800 mb-2">Dr. {d.first_name} {d.last_name}</p>
                <DoctorWeekCalendar doctorId={d.id} onSlotClick={openBookingFromSlot} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pending registrations preview */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide">
            Pending Registration Approvals
          </h2>
          {pending.length > 0 && (
            <Link href="/receptionist/approvals" className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium">
              Review all <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>

        <Card>
          <div className="divide-y divide-neutral-100">
            {pending.slice(0, 5).map((p) => (
              <div key={p.id} className="flex items-center gap-4 px-6 py-4">
                <div className="h-9 w-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm flex-shrink-0">
                  {(p.first_name?.[0] || p.full_name?.[0] || "?").toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-neutral-900 truncate">
                    {p.full_name || `${p.first_name} ${p.last_name}`.trim() || "Unknown"}
                  </p>
                  <p className="text-xs text-neutral-500 truncate">{p.email}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="flex items-center gap-1 text-xs text-warning-700 bg-warning-50 px-2 py-0.5 rounded-full font-medium">
                    <Clock className="h-3 w-3" />Pending
                  </span>
                  <Link href="/receptionist/approvals">
                    <button className="h-7 px-2.5 rounded-md bg-success-500 text-white text-xs font-medium hover:bg-success-700 transition-colors">
                      Approve
                    </button>
                  </Link>
                  <Link href="/receptionist/approvals">
                    <button className="h-7 px-2.5 rounded-md border border-danger-100 bg-white text-danger-700 text-xs font-medium hover:bg-danger-50 transition-colors">
                      Reject
                    </button>
                  </Link>
                </div>
              </div>
            ))}

            {pending.length === 0 && (
              <div className="px-6 py-10 text-center">
                <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-neutral-600">All caught up!</p>
                <p className="text-xs text-neutral-400 mt-0.5">No pending registrations at the moment.</p>
              </div>
            )}
          </div>
        </Card>
      </section>

      {user?.clinic_id && (
        <ReceptionBookAppointmentModal
          isOpen={showBooking}
          clinicId={user.clinic_id}
          prefill={bookingPrefill}
          onClose={() => setShowBooking(false)}
          // The doctor calendars below refresh themselves on this event.
          onBooked={() => { setShowBooking(false); window.dispatchEvent(new Event("sse:appointment")); }}
        />
      )}

      {showRegister && (
        <RegisterPatientModal onClose={() => setShowRegister(false)} onSuccess={() => setShowRegister(false)} />
      )}
    </div>
  );
}

