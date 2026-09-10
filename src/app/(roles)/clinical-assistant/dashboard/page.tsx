"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { Users, ClipboardCheck, Activity, Calendar } from "lucide-react";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { staffService } from "@/lib/api/services/staff.service";
import { PageLoader, Card, CardContent, Button } from "@/components/ui";
import { isSupersededCancellation } from "@/lib/appointmentStatus";

/** Device sessions AND protocol follow-ups — a CA's actual worklist,
 * matching what /clinical-assistant/appointments and /clinical-assistant/
 * device-sessions already scope to (SQL/v1/30's single appointments row-type,
 * appointment_type in device_session/protocol_followup). The previous
 * version of this page called staffService.getDashboard(), which — same gap
 * as the doctor dashboard's own dead getDashboard() stub — hardcoded
 * upcoming_sessions to an empty array unconditionally: there was never a
 * real aggregate endpoint behind it, so "No upcoming sessions" showed
 * regardless of how many device sessions or follow-ups actually existed. */
interface UpcomingRow {
  appointment_id: string;
  appointment_type: string;
  appointment_date: string;
  start_time: string | null;
  status: string;
  cancellation_reason?: string | null;
  session_number: number | null;
  patient_id: string;
  patient_name: string | null;
}

const STATUS_TONE: Record<string, string> = {
  planned: "bg-neutral-100 text-neutral-700",
  selected: "bg-amber-100 text-amber-800",
  paid: "bg-blue-100 text-blue-800",
  checked_in: "bg-indigo-100 text-indigo-800",
  in_progress: "bg-purple-100 text-purple-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-red-100 text-red-700",
};

function fmtDate(s: string) {
  return new Date(s + "T00:00:00").toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "Today, Wed, Sep 9, 2026" for the current day, "Wed, Sep 10, 2026" for
 * any other — matches how a doctor's own calendar labels today vs. any
 * other date they've navigated to. */
function fmtPillDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const label = d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  return iso === todayStr() ? `Today, ${label}` : label;
}

export default function CADashboard() {
  const [patientCount, setPatientCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [sessions, setSessions] = useState<UpcomingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [date, setDate] = useState(todayStr);

  const fetchSessions = useCallback(() => {
    setIsLoading(true);
    const params: Record<string, unknown> = { limit: 200, date_from: date, date_to: date };

    Promise.all([
      staffService.getDashboard().catch(() => ({ patient_count: 0, pending_count: 0 })),
      // getDashboard()'s own pending_count counts anyone still mid-registration
      // wizard (registration_status !== "registration_complete") — a much
      // broader, wrong-for-this-card definition than an actual pending
      // approval. getPendingPatients() is the same approval_status=pending
      // AND registration_status=registration_complete query the /approvals
      // page itself uses, so the two numbers can no longer disagree.
      staffService.getPendingPatients().catch(() => ({ patients: [], total: 0 })),
      apiClient.get(ENDPOINTS.APPOINTMENTS.LIST, { params: { ...params, appointment_type: "device_session" } }).catch(() => ({ data: [] })),
      apiClient.get(ENDPOINTS.APPOINTMENTS.LIST, { params: { ...params, appointment_type: "protocol_followup" } }).catch(() => ({ data: [] })),
    ]).then(([dash, pending, deviceRes, followUpRes]) => {
      setPatientCount(dash.patient_count ?? 0);
      setPendingCount(pending.total ?? 0);
      const device: UpcomingRow[] = Array.isArray(deviceRes.data) ? deviceRes.data : [];
      const followUps: UpcomingRow[] = Array.isArray(followUpRes.data) ? followUpRes.data : [];
      setSessions([...device, ...followUps]);
    }).finally(() => setIsLoading(false));
  }, [date]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const upcoming = useMemo(() => {
    return sessions
      .filter((s) => !isSupersededCancellation(s))
      .filter((s) => s.status !== "cancelled" && s.status !== "no_show" && s.status !== "completed")
      .sort((a, b) => {
        const dc = a.appointment_date.localeCompare(b.appointment_date);
        return dc !== 0 ? dc : (a.start_time || "").localeCompare(b.start_time || "");
      });
  }, [sessions]);

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Single date pill — click anywhere on it to open the native date
              picker (invisible input stacked over the styled label). Scopes
              the Upcoming Sessions list and its count below to that one day. */}
          <label className="relative inline-flex items-center gap-2 h-[38px] pl-3 pr-3.5 rounded-full border border-neutral-300 bg-white text-sm font-medium text-neutral-700 cursor-pointer hover:border-neutral-400 transition-colors">
            <Calendar className="h-4 w-4 text-primary-500 flex-shrink-0" />
            {fmtPillDate(date)}
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value || todayStr())}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </label>
          {date !== todayStr() && (
            <button
              onClick={() => setDate(todayStr())}
              className="text-xs font-medium text-neutral-500 hover:text-neutral-700 whitespace-nowrap"
            >
              Today
            </button>
          )}
          <Link href="/clinical-assistant/patients">
            <Button>
              <Users className="h-4 w-4" /> View All Patients
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Total Patients", value: patientCount, icon: Users, color: "text-primary-500", href: "/clinical-assistant/patients" },
          { label: "Pending Approvals", value: pendingCount, icon: ClipboardCheck, color: "text-warning-500", href: "/clinical-assistant/approvals" },
          { label: "Upcoming Sessions", value: upcoming.length, icon: Activity, color: "text-success-500", href: "/clinical-assistant/appointments" },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="hover:border-primary-300 hover:shadow-card-hover transition-all cursor-pointer">
              <CardContent className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg bg-neutral-50 flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-neutral-900">{stat.value}</p>
                  <p className="text-xs text-neutral-500">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <section>
        <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Upcoming Sessions</h2>
        <Card>
          <div className="divide-y divide-neutral-100">
            {upcoming.slice(0, 10).map((s) => (
              <Link
                key={s.appointment_id}
                href={
                  s.appointment_type === "device_session"
                    ? `/clinical-assistant/device-sessions/${s.appointment_id}`
                    : `/clinical-assistant/appointments`
                }
                className="block px-6 py-3 hover:bg-neutral-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900 truncate">{s.patient_name || "—"}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {s.appointment_type === "device_session"
                        ? `Device Session${s.session_number ? ` ${s.session_number}` : ""}`
                        : "Protocol Follow-up"}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 ${STATUS_TONE[s.status] ?? "bg-neutral-100 text-neutral-600"}`}>
                    {s.status.replace(/_/g, " ")}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-1">{fmtDate(s.appointment_date)}</p>
              </Link>
            ))}
            {upcoming.length === 0 && (
              <div className="px-6 py-8 text-center text-neutral-500 text-sm">No upcoming sessions</div>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
