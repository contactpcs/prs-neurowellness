"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, CalendarDays, ClipboardList, Lock, ChevronRight, ChevronLeft, CheckCircle2 } from "lucide-react";
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

function fmtDay(a: Appointment): string {
  const d = new Date(`${a.appointment_date}T${a.start_time || "00:00"}`);
  if (Number.isNaN(d.getTime())) return a.appointment_date;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
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
  // Which "Treatment Session N" parent is open. null = parent list.
  const [openGroupKey, setOpenGroupKey] = useState<string | null>(null);

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

  // One "Treatment Session N" per treatment protocol the device sessions
  // belong to, ordered by the protocol's earliest scheduled session.
  const groups = useMemo(() => {
    if (!sessions) return [] as { key: string; items: Appointment[] }[];
    const byProtocol = new Map<string, Appointment[]>();
    for (const a of sessions) {
      const key = a.protocol_id ?? "unassigned";
      const bucket = byProtocol.get(key);
      if (bucket) bucket.push(a);
      else byProtocol.set(key, [a]);
    }
    return [...byProtocol.entries()]
      .map(([key, items]) => ({
        key,
        items: items.slice().sort((a, b) => {
          const sn = (a.session_number ?? 1e9) - (b.session_number ?? 1e9);
          return sn !== 0 ? sn : scheduledAt(a) - scheduledAt(b);
        }),
      }))
      .sort((g1, g2) => scheduledAt(g1.items[0]) - scheduledAt(g2.items[0]));
  }, [sessions]);

  if (error) return <p className="text-sm text-danger-600">{error}</p>;
  if (!sessions) return <PageLoader />;

  const now = Date.now();

  const openGroup = groups.find((g) => g.key === openGroupKey) ?? null;
  const openGroupNumber = openGroup ? groups.findIndex((g) => g.key === openGroup.key) + 1 : null;

  const renderSessionCard = (a: Appointment) => {
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
  };

  // ─── Child level — device sessions for the picked Treatment Session ───
  if (openGroup) {
    const first = openGroup.items[0];
    const last = openGroup.items[openGroup.items.length - 1];
    return (
      <div className="flex flex-col gap-5">
        <button
          onClick={() => setOpenGroupKey(null)}
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 w-fit"
        >
          <ChevronLeft className="h-4 w-4" /> Back to treatment sessions
        </button>
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Treatment Session {openGroupNumber}</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {openGroup.items.length} device session{openGroup.items.length === 1 ? "" : "s"}
            {" · "}{fmtDay(first)}{openGroup.items.length > 1 ? ` – ${fmtDay(last)}` : ""}
          </p>
        </div>
        <div className="space-y-3">{openGroup.items.map(renderSessionCard)}</div>
      </div>
    );
  }

  // ─── Parent level — one row per Treatment Session ───
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Device Sessions</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          Your treatment schedule. Open a treatment session to see its device sessions and assessments.
        </p>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-14 text-center">
            <Activity className="h-8 w-8 text-neutral-200 mx-auto mb-2" />
            <p className="text-sm text-neutral-400">No device sessions scheduled yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((g, i) => {
            const first = g.items[0];
            const last = g.items[g.items.length - 1];
            const actionable = g.items.some((a) => summaries[a.appointment_id]?.actionable);
            const done = g.items.filter((a) => a.status === "completed").length;
            return (
              <Card key={g.key} className="hover:border-primary-300 transition-colors">
                <CardContent
                  className="flex items-center gap-4 py-4 cursor-pointer"
                  onClick={() => setOpenGroupKey(g.key)}
                >
                  <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-600 flex flex-col items-center justify-center flex-shrink-0">
                    <span className="text-[9px] font-semibold uppercase leading-none">Tx</span>
                    <span className="text-sm font-bold leading-none mt-0.5">{i + 1}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-neutral-900">Treatment Session {i + 1}</span>
                      {actionable && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-warning-50 text-warning-700">
                          Assessment ready
                        </span>
                      )}
                    </div>
                    <div className="mt-1.5 text-xs text-neutral-500 flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5 text-neutral-400" />
                      {g.items.length} session{g.items.length === 1 ? "" : "s"}
                      {" · "}{fmtDay(first)}{g.items.length > 1 ? ` – ${fmtDay(last)}` : ""}
                      {done > 0 ? ` · ${done} done` : ""}
                    </div>
                  </div>

                  <ChevronRight className="h-4 w-4 text-neutral-300 flex-shrink-0" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
