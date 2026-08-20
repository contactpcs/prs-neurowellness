"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity } from "lucide-react";
import { PageLoader } from "@/components/ui";
import { treatmentProtocolService } from "@/lib/api/services/treatmentProtocol.service";
import { deviceSessionLabel, deviceSessionTone, isSessionFinished } from "@/lib/utils/deviceSessionStatus";
import type { ProtocolRead, ProtocolSessionRead } from "@/types/treatmentProtocol.types";

type Row = { protocol: ProtocolRead; sessions: ProtocolSessionRead[]; current: ProtocolSessionRead | null };

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const FILTERS = ["All", "Not Yet Started", "In Progress", "Completed", "Missed"] as const;

export default function DoctorSessionsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const protocols = await treatmentProtocolService.listProtocols({ status: "active" });
        const withSessions = await Promise.all(
          protocols.map(async (protocol) => {
            const detail = await treatmentProtocolService.getProtocolDetail(protocol.protocol_id).catch(() => null);
            const sessions = (detail?.sessions ?? []).slice().sort((a, b) => (a.session_number ?? 0) - (b.session_number ?? 0));
            // The device session currently "up" — the earliest one that
            // hasn't finished yet (in progress or still not started).
            const current = sessions.find((s) => !isSessionFinished(s.status)) ?? sessions[sessions.length - 1] ?? null;
            return { protocol, sessions, current };
          })
        );
        if (!cancelled) setRows(withSessions);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = rows.filter((r) => {
    if (filter === "All") return true;
    const label = deviceSessionLabel(r.current?.status);
    return label === filter;
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Sessions</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Device sessions generated from each patient&apos;s active treatment protocol.</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-8 px-3.5 rounded-full text-xs font-semibold transition-colors ${
              filter === f ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Activity className="h-8 w-8 text-neutral-200 mx-auto mb-2" />
            <p className="text-sm text-neutral-400">No matching sessions.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50">
                  {["Patient", "Session", "Date", "Time", "Status", ""].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map(({ protocol, sessions, current }) => (
                  <tr
                    key={protocol.protocol_id}
                    onClick={() => protocol.patient_id && router.push(`/doctor/patients/${protocol.patient_id}?section=sessions`)}
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
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${deviceSessionTone(current?.status)}`}>
                        {sessions.length ? deviceSessionLabel(current?.status) : "No sessions scheduled"}
                      </span>
                    </td>
                    <td className="px-5 py-2 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); protocol.patient_id && router.push(`/doctor/patients/${protocol.patient_id}?section=sessions`); }}
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
