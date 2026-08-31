"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, CalendarDays, ClipboardList, Lock, ChevronRight, CheckCircle2 } from "lucide-react";
import { appointmentsService } from "@/lib/api/services";
import { deviceSessionService } from "@/lib/api/services/deviceSession.service";
import { Card, CardContent, PageLoader } from "@/components/ui";
import { deviceSessionLabel, deviceSessionTone } from "@/lib/utils/deviceSessionStatus";
import type { Appointment } from "@/types/domain.types";
import type { DeviceSessionScale } from "@/types/deviceSession.types";

/** Scheduled datetime of a session. Falls back to end-of-day when the slot has
 * no start_time yet (a 'planned' protocol row the patient hasn't claimed). */
function scheduledAt(a: Appointment): number {
  const t = a.start_time && a.start_time.length >= 4 ? a.start_time : "23:59";
  const d = new Date(`${a.appointment_date}T${t}`);
  return Number.isNaN(d.getTime()) ? new Date(`${a.appointment_date}T23:59`).getTime() : d.getTime();
}

function fmtWhen(a: Appointment): string {
  const d = new Date(`${a.appointment_date}T${a.start_time || "00:00"}`);
  if (Number.isNaN(d.getTime())) return a.appointment_date;
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  return a.start_time ? `${date} · ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}` : date;
}

type ScaleSummary = { total: number; completed: number; actionable: boolean } | null;

function summarize(scales: DeviceSessionScale[]): ScaleSummary {
  if (!scales.length) return { total: 0, completed: 0, actionable: false };
  return {
    total: scales.length,
    completed: scales.filter((s) => s.status === "completed").length,
    actionable: scales.some((s) => s.delivery_mode === "patient_app" && s.status !== "completed"),
  };
}

export default function PatientDeviceSessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Appointment[] | null>(null);
  const [summaries, setSummaries] = useState<Record<string, ScaleSummary>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    appointmentsService
      .myList(true)
      .then((all) => {
        const ds = all
          .filter((a) => a.appointment_type === "device_session")
          .sort((a, b) => {
            const sn = (a.session_number ?? 1e9) - (b.session_number ?? 1e9);
            return sn !== 0 ? sn : scheduledAt(a) - scheduledAt(b);
          });
        setSessions(ds);
        // Per-session assessment status. listScales seeds the row set from the
        // protocol's assigned scales; it 404s before the CA opens the session,
        // which just means "nothing to show yet".
        ds.forEach(async (a) => {
          try {
            const scales = await deviceSessionService.listScales(a.appointment_id);
            setSummaries((prev) => ({ ...prev, [a.appointment_id]: summarize(scales) }));
          } catch {
            setSummaries((prev) => ({ ...prev, [a.appointment_id]: null }));
          }
        });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load your sessions"));
  }, []);

  if (error) return <p className="text-sm text-danger-600">{error}</p>;
  if (!sessions) return <PageLoader />;

  const now = Date.now();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Device Sessions</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Your treatment schedule. Each session unlocks its activities and assessment at its scheduled time.
        </p>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-14 text-center">
            <Activity className="h-8 w-8 text-neutral-200 mx-auto mb-2" />
            <p className="text-sm text-neutral-400">No device sessions scheduled yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((a) => {
            const locked = scheduledAt(a) > now && a.status !== "in_progress" && a.status !== "completed";
            const closed = a.status === "cancelled" || a.status === "no_show";
            const openable = !locked && !closed;
            const sum = summaries[a.appointment_id];

            return (
              <Card
                key={a.appointment_id}
                className={openable ? "hover:border-primary-300 transition-colors" : ""}
              >
                <CardContent
                  className={`flex items-center gap-4 py-4 ${openable ? "cursor-pointer" : ""}`}
                  onClick={openable ? () => router.push(`/patient/device-sessions/${a.appointment_id}`) : undefined}
                >
                  <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-600 flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-semibold uppercase leading-none">Sess</span>
                    <span className="text-sm font-bold leading-none mt-0.5">{a.session_number ?? "—"}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-neutral-900 flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5 text-neutral-400" />
                        {fmtWhen(a)}
                      </span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${deviceSessionTone(a.status)}`}>
                        {deviceSessionLabel(a.status)}
                      </span>
                    </div>

                    <div className="mt-1.5 text-xs text-neutral-500 flex items-center gap-1.5">
                      {locked ? (
                        <><Lock className="h-3.5 w-3.5" /> Opens {fmtWhen(a)}</>
                      ) : closed ? (
                        <>Session {a.status === "no_show" ? "missed" : "cancelled"}</>
                      ) : sum === undefined ? (
                        <>Loading assessment status…</>
                      ) : sum === null || sum.total === 0 ? (
                        <><ClipboardList className="h-3.5 w-3.5" /> No assessment for this session</>
                      ) : sum.actionable ? (
                        <span className="text-warning-700 font-medium flex items-center gap-1.5">
                          <ClipboardList className="h-3.5 w-3.5" /> Assessment ready to complete
                        </span>
                      ) : sum.completed === sum.total ? (
                        <span className="text-success-700 font-medium flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Assessment complete
                        </span>
                      ) : (
                        <><ClipboardList className="h-3.5 w-3.5" /> {sum.completed} of {sum.total} assessment{sum.total === 1 ? "" : "s"} done</>
                      )}
                    </div>
                  </div>

                  {openable ? <ChevronRight className="h-4 w-4 text-neutral-300 flex-shrink-0" /> : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
