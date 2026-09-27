"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, CalendarDays, ClipboardList, Lock, ChevronRight, CheckCircle2 } from "lucide-react";
import { appointmentsService } from "@/lib/api/services";
import { deviceSessionService } from "@/lib/api/services/deviceSession.service";
import { treatmentProtocolService } from "@/lib/api/services/treatmentProtocol.service";
import { Card, CardContent, PageSkeleton } from "@/components/ui";
import { patientDeviceSessionLabel, deviceSessionTone } from "@/lib/utils/deviceSessionStatus";
import { isSupersededCancellation } from "@/lib/appointmentStatus";
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

/** A locked (not-yet-open, future) or closed (cancelled/no_show) session can
 * never have an actionable/completed scale worth showing — its scale rows
 * either don't exist yet or will never change again. Fetching its scale
 * status is pure waste, and with a real treatment course running 20-50+
 * device sessions, fetching all of them unconditionally on every page load
 * was firing that many individual requests at once. */
function isOpenable(a: Appointment, now: number): boolean {
  const locked = scheduledAt(a) > now && a.status !== "in_progress" && a.status !== "completed";
  const closed = a.status === "cancelled" || a.status === "no_show" || a.status === "missed";
  return !locked && !closed;
}

type ScaleSummary = { total: number; completed: number; actionable: boolean } | null;

type FilterKey = "all" | "upcoming" | "in_progress" | "completed" | "paid" | "no_show" | "not_booked";

function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

const FILTERS: { key: FilterKey; label: string; test: (a: Appointment) => boolean }[] = [
  { key: "all", label: "All", test: () => true },
  {
    key: "upcoming",
    label: "Upcoming",
    test: (a) => scheduledAt(a) >= startOfToday() && !["completed", "no_show", "missed", "cancelled"].includes(a.status),
  },
  { key: "in_progress", label: "In Progress", test: (a) => a.status === "in_progress" },
  { key: "completed", label: "Completed", test: (a) => a.status === "completed" },
  { key: "paid", label: "Paid", test: (a) => a.status === "paid" },
  { key: "no_show", label: "No-Show", test: (a) => a.status === "no_show" },
  { key: "not_booked", label: "Not Booked", test: (a) => a.status === "missed" },
];

/** Statuses kept from an inactive (superseded/completed/cancelled) protocol:
 * only the historical record — Completed, Paid, Missed. Its not-yet-started
 * slots were replaced by the active protocol's own schedule. */
const HISTORICAL_STATUSES = new Set(["completed", "paid", "no_show", "missed"]);

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
  // protocol_id -> ProtocolRead.status ("active" | "completed" | "cancelled"
  // | "superseded" | …), or null when the lookup failed. Protocol versions
  // are an internal detail — this only decides which sessions to show.
  const [statusByProtocol, setStatusByProtocol] = useState<Record<string, string | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    appointmentsService
      .myList(true)
      .then(async (all) => {
        const ds = all.filter((a) => a.appointment_type === "device_session");
        setSessions(ds);

        // One status lookup per distinct protocol, not per session — a
        // course of 20-50 device sessions typically belongs to 1-3 protocol
        // versions.
        const protocolIds = [...new Set(ds.map((a) => a.protocol_id).filter((id): id is string => !!id))];
        await Promise.all(
          protocolIds.map(async (pid) => {
            try {
              const p = await treatmentProtocolService.getProtocolDetail(pid);
              setStatusByProtocol((prev) => ({ ...prev, [pid]: p.status ?? null }));
            } catch {
              setStatusByProtocol((prev) => ({ ...prev, [pid]: null }));
            }
          })
        );

        // Per-session assessment status — only for sessions that could
        // plausibly need it (see isOpenable), not every session in the
        // patient's whole history.
        const now = Date.now();
        const relevant = ds.filter((a) => isOpenable(a, now));

        // Batched, not all at once — a long-running course can still have
        // dozens of open/recent sessions, and firing every request in
        // parallel just moves the flood from "everything" to "everything
        // that's open," still hammering the API on one page load.
        const BATCH_SIZE = 6;
        for (let i = 0; i < relevant.length; i += BATCH_SIZE) {
          const batch = relevant.slice(i, i + BATCH_SIZE);
          await Promise.all(
            batch.map(async (a) => {
              try {
                const scales = await deviceSessionService.listScales(a.appointment_id);
                setSummaries((prev) => ({ ...prev, [a.appointment_id]: summarize(scales) }));
              } catch {
                setSummaries((prev) => ({ ...prev, [a.appointment_id]: null }));
              }
            })
          );
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load your sessions"));
  }, []);

  // Fallback active protocol while (or if) the status lookups aren't
  // available: the most recently scheduled protocol that still has at least
  // one item not auto-cancelled by a later amendment (see
  // isSupersededCancellation) — an amended version never qualifies.
  const fallbackActiveProtocolId = useMemo(() => {
    if (!sessions) return null;
    let best: string | null = null;
    let bestAt = -Infinity;
    for (const a of sessions) {
      if (!a.protocol_id || isSupersededCancellation(a)) continue;
      const at = scheduledAt(a);
      if (at > bestAt) {
        best = a.protocol_id;
        bestAt = at;
      }
    }
    return best;
  }, [sessions]);

  // One unified list: every session of the active protocol, plus only the
  // historical (Completed / Paid / Missed) sessions of inactive protocols.
  // Deduped by appointment_id, then chronological.
  const visibleSessions = useMemo(() => {
    if (!sessions) return [] as Appointment[];
    const isActiveProtocol = (pid: string | null | undefined): boolean => {
      // A device session not tied to any protocol has no older version to
      // be superseded by — always show it.
      if (!pid) return true;
      const status = statusByProtocol[pid];
      return status ? status === "active" : pid === fallbackActiveProtocolId;
    };
    const kept = sessions.filter((a) => isActiveProtocol(a.protocol_id) || HISTORICAL_STATUSES.has(a.status));
    const unique = Array.from(new Map(kept.map((a) => [a.appointment_id, a])).values());
    return unique.sort((a, b) => {
      const t = scheduledAt(a) - scheduledAt(b);
      return t !== 0 ? t : (a.session_number ?? 1e9) - (b.session_number ?? 1e9);
    });
  }, [sessions, statusByProtocol, fallbackActiveProtocolId]);

  if (error) return <p className="text-sm text-danger-600">{error}</p>;
  if (!sessions) return <PageSkeleton />;

  const now = Date.now();

  const renderSessionCard = (a: Appointment) => {
    const locked = scheduledAt(a) > now && a.status !== "in_progress" && a.status !== "completed";
    const closed = a.status === "cancelled" || a.status === "no_show" || a.status === "missed";
    const openable = isOpenable(a, now);
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
                {patientDeviceSessionLabel(a.status)}
              </span>
            </div>

            <div className="mt-1.5 text-xs text-neutral-500 flex items-center gap-1.5">
              {locked ? (
                <><Lock className="h-3.5 w-3.5" /> Opens {fmtWhen(a)}</>
              ) : closed ? (
                <>Session {a.status === "no_show" || a.status === "missed" ? "missed" : "cancelled"}</>
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

  const filteredItems = visibleSessions.filter(FILTERS.find((f) => f.key === filter)!.test);
  const first = visibleSessions[0];
  const last = visibleSessions[visibleSessions.length - 1];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Device Sessions</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          {visibleSessions.length === 0
            ? "Your treatment schedule."
            : `${visibleSessions.length} device session${visibleSessions.length === 1 ? "" : "s"} · ${fmtDay(first)}${
                visibleSessions.length > 1 ? ` – ${fmtDay(last)}` : ""
              }`}
        </p>
      </div>

      {visibleSessions.length === 0 ? (
        <Card>
          <CardContent className="px-6 py-14 text-center">
            <Activity className="h-8 w-8 text-neutral-200 mx-auto mb-2" />
            <p className="text-sm text-neutral-400">No device sessions scheduled yet.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition-colors ${
                  filter === f.key
                    ? "bg-primary-600 text-white"
                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredItems.length === 0 ? (
              <Card>
                <CardContent className="px-6 py-10 text-center">
                  <p className="text-sm text-neutral-400">No sessions match this filter.</p>
                </CardContent>
              </Card>
            ) : (
              filteredItems.map(renderSessionCard)
            )}
          </div>
        </>
      )}
    </div>
  );
}

