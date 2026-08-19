"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity } from "lucide-react";
import { PageLoader } from "@/components/ui";
import { treatmentProtocolService } from "@/lib/api/services/treatmentProtocol.service";
import type { ProtocolRead, ProtocolSessionRead } from "@/types/treatmentProtocol.types";

type Row = { protocol: ProtocolRead; next: ProtocolSessionRead | null };

const STATUS_TONE: Record<string, string> = {
  completed: "bg-green-50 text-green-700",
  scheduled: "bg-amber-50 text-amber-700",
  in_progress: "bg-primary-50 text-primary-700",
  missed: "bg-red-50 text-red-700",
  cancelled: "bg-neutral-100 text-neutral-600",
};

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const FILTERS = ["All", "Scheduled", "In Progress", "Completed", "Missed"] as const;

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
            const sessions = await treatmentProtocolService.listProtocolSessions(protocol.protocol_id).catch(() => []);
            const next =
              sessions.find((s) => s.status === "in_progress") ||
              sessions.find((s) => s.status === "scheduled") ||
              null;
            return { protocol, next };
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
    const label = filter === "In Progress" ? "in_progress" : filter.toLowerCase();
    return r.next?.status === label;
  });

  if (isLoading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Sessions</h1>
        <p className="text-sm text-neutral-500 mt-0.5">Next scheduled device session across all patients on active treatment.</p>
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
                {filtered.map(({ protocol, next }) => (
                  <tr
                    key={protocol.protocol_id}
                    onClick={() => protocol.patient_id && router.push(`/doctor/patients/${protocol.patient_id}/treatment-protocol`)}
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
                      {next?.session_number != null ? `#${next.session_number} / ${protocol.session_count}` : "—"}
                    </td>
                    <td className="px-5 py-4 text-neutral-600">{fmtDate(next?.appointment_date)}</td>
                    <td className="px-5 py-4 text-neutral-600">{next?.start_time || "—"}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${next ? STATUS_TONE[next.status] || "bg-neutral-100 text-neutral-600" : "bg-neutral-100 text-neutral-400"}`}>
                        {next ? statusLabel(next.status) : "No sessions left"}
                      </span>
                    </td>
                    <td className="px-5 py-2 text-right">
                      <button
                        onClick={(e) => { e.stopPropagation(); protocol.patient_id && router.push(`/doctor/patients/${protocol.patient_id}/treatment-protocol`); }}
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
