"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity } from "lucide-react";
import { PageSkeleton } from "@/components/ui";
import { SessionCalendar, type CalendarSession } from "@/components/deviceSession/SessionCalendar";
import { treatmentProtocolService } from "@/lib/api/services/treatmentProtocol.service";
import { deviceSessionLabel, deviceSessionTone, isSessionFinished, SESSION_FILTER_DOT } from "@/lib/utils/deviceSessionStatus";
import type { ProtocolRead, ProtocolSessionRead } from "@/types/treatmentProtocol.types";

type Row = { protocol: ProtocolRead; sessions: ProtocolSessionRead[]; current: ProtocolSessionRead | null };

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// Matched against deviceSessionLabel by key, so the button text can't drift
// from the label casing (it used to: "Not Yet Started" never matched).
const FILTERS = [
  { key: "all", label: "All", match: null },
  { key: "not_started", label: "Not Yet Started", match: "Not yet started" },
  { key: "paid", label: "Paid", match: "Paid" },
  { key: "in_progress", label: "In Progress", match: "In Progress" },
  { key: "completed", label: "Completed", match: "Completed" },
  { key: "no_show", label: "No-Show", match: "No-Show" },
  { key: "not_booked", label: "Not Booked", match: "Not Booked" },
  { key: "cancelled", label: "Cancelled", match: "Cancelled" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

export default function DoctorSessionsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // One call: protocols + their device sessions (API audit F-034) —
        // was a full detail fetch per protocol.
        const protocols = await treatmentProtocolService.listProtocolsWithSessions({ status: "active" });
        const withSessions = protocols.map((protocol) => {
            const sessions = protocol.sessions.slice().sort((a, b) => (a.session_number ?? 0) - (b.session_number ?? 0));
            // The device session currently "up" — the earliest one that
            // hasn't finished yet (in progress or still not started).
            const current = sessions.find((s) => !isSessionFinished(s.status)) ?? sessions[sessions.length - 1] ?? null;
            return { protocol, sessions, current };
          });
        if (!cancelled) setRows(withSessions);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const matches = (key: FilterKey, status?: string | null) => {
    const f = FILTERS.find((x) => x.key === key)!;
    return f.match === null || deviceSessionLabel(status) === f.match;
  };
  // Table: one row per patient, filtered by their current session.
  const filtered = rows.filter((r) => matches(filter, r.current?.status));

  // Calendar: every session (across all patients) whose own status matches
  // the filter — "Completed" shows every completed session, etc.
  const patientHref = new Map<string, string>();
  const calendarItems: CalendarSession[] = rows.flatMap(({ protocol, sessions }) => {
    const name = protocol.patient_name || "Patient";
    return sessions.filter((s) => matches(filter, s.status)).map((s) => {
      if (protocol.patient_id) patientHref.set(s.appointment_id, `/doctor/patients/${protocol.patient_public_id ?? protocol.patient_id}?section=sessions`);
      return {
        id: s.appointment_id,
        date: s.appointment_date,
        time: s.start_time,
        status: s.status,
        label: s.session_number != null ? `${name} #${s.session_number}` : name,
      };
    });
  });

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Sessions</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Device sessions generated from each patient&apos;s active treatment protocol.</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex items-center gap-2 h-9 px-3.5 rounded-full border text-sm font-semibold transition-colors ${
              filter === f.key ? "bg-neutral-900 border-neutral-900 text-white" : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            {SESSION_FILTER_DOT[f.key] && <span className={`w-3 h-3 rounded-full ring-2 ring-white ${SESSION_FILTER_DOT[f.key]}`} />}
            {f.label}
            <span className={filter === f.key ? "text-white/70" : "text-neutral-400"}>
              {rows.filter((r) => matches(f.key, r.current?.status)).length}
            </span>
          </button>
        ))}
      </div>

      {calendarItems.length > 0 && (
        <SessionCalendar
          key={filter}
          sessions={calendarItems}
          onSelectSession={(c) => {
            const href = patientHref.get(c.id);
            if (href) router.push(href);
          }}
        />
      )}

      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Activity className="h-8 w-8 text-neutral-200 mx-auto mb-2" />
            <p className="text-sm text-neutral-400">No matching sessions.</p>
          </div>
        ) : (
          <div className="overflow-auto max-h-[calc(100vh-220px)]">
            <table className="w-full text-base min-w-[820px]">
              <thead className="sticky top-0 z-10 bg-neutral-50">
                <tr className="border-b border-neutral-100 bg-neutral-50">
                  {["Patient", "Session", "Date", "Time", "Status", ""].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map(({ protocol, sessions, current }) => (
                  <tr
                    key={protocol.protocol_id}
                    onClick={() => protocol.patient_id && router.push(`/doctor/patients/${protocol.patient_public_id ?? protocol.patient_id}?section=sessions`)}
                    className="hover:bg-neutral-50 cursor-pointer transition-colors"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-brand-gradient flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                          {(protocol.patient_name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2)}
                        </div>
                        <span className="font-semibold text-neutral-900">{protocol.patient_name || "—"}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-neutral-700">
                      {current?.session_number != null ? `#${current.session_number} / ${sessions.length}` : sessions.length ? `— / ${sessions.length}` : "—"}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">{fmtDate(current?.appointment_date)}</td>
                    <td className="px-5 py-4 text-neutral-600">{current?.start_time || "—"}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${deviceSessionTone(current?.status)}`}>
                        {sessions.length ? deviceSessionLabel(current?.status) : "No sessions scheduled"}
                      </span>
                    </td>
                    <td className="px-5 py-2 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); protocol.patient_id && router.push(`/doctor/patients/${protocol.patient_public_id ?? protocol.patient_id}?section=sessions`); }}
                        className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-action-orange hover:bg-action-orange-dark transition-colors"
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
