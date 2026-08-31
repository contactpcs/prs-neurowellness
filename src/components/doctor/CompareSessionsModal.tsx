"use client";

import { useEffect, useState } from "react";
import { X, ArrowRight } from "lucide-react";
import { treatmentProtocolService } from "@/lib/api/services/treatmentProtocol.service";
import { usePatientScoresSummary } from "@/lib/hooks";
import type { ClinicalSessionTab } from "@/lib/hooks/usePatientClinicalSessions";
import type { ProtocolRead } from "@/types/treatmentProtocol.types";
import { asOfSnapshot, deltaTone } from "@/lib/utils/clinicalSnapshot";

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** "View Changes" — what actually changed between two clinical sessions:
 * PRS score trend and treatment protocol parameters. There's no backend
 * link from a session to "the PRS instance / protocol version recorded at
 * that session", so this is a best-effort snapshot: the latest PRS
 * completion and latest protocol version whose date is on/before each
 * session's date. Good enough to see the improvement trend the doctor is
 * asking about; not a guarantee that this exact protocol row was the one
 * live during that exact appointment. */
export function CompareSessionsModal({ patientId, sessions, onClose }: { patientId: string; sessions: ClinicalSessionTab[]; onClose: () => void }) {
  const [fromId, setFromId] = useState(sessions.length >= 2 ? sessions[sessions.length - 2].appointment.appointment_id : sessions[0]?.appointment.appointment_id);
  const [toId, setToId] = useState(sessions[sessions.length - 1]?.appointment.appointment_id);
  const [protocols, setProtocols] = useState<ProtocolRead[]>([]);
  const [protocolsLoading, setProtocolsLoading] = useState(true);
  const { instances: scoreInstances } = usePatientScoresSummary(patientId);

  useEffect(() => {
    treatmentProtocolService
      .listProtocols({ patientId })
      .then((list) => setProtocols(list))
      .catch(() => setProtocols([]))
      .finally(() => setProtocolsLoading(false));
  }, [patientId]);

  const from = sessions.find((s) => s.appointment.appointment_id === fromId) ?? null;
  const to = sessions.find((s) => s.appointment.appointment_id === toId) ?? null;

  const fromSnap = asOfSnapshot(from?.appointment.appointment_date, scoreInstances, protocols);
  const toSnap = asOfSnapshot(to?.appointment.appointment_date, scoreInstances, protocols);
  const scoreDelta = fromSnap.score != null && toSnap.score != null ? Math.round((toSnap.score - fromSnap.score) * 10) / 10 : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="flex items-start justify-between px-5 py-4 border-b border-neutral-100 sticky top-0 bg-white">
          <div>
            <h3 className="text-base font-semibold text-neutral-900">View Changes</h3>
            <p className="text-xs text-neutral-400 mt-0.5">Progress between two clinical sessions</p>
          </div>
          <button onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center gap-2">
            <select value={fromId} onChange={(e) => setFromId(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-neutral-200 rounded-lg">
              {sessions.map((s) => <option key={s.appointment.appointment_id} value={s.appointment.appointment_id}>{s.label} — {fmtDate(s.appointment.appointment_date)}</option>)}
            </select>
            <ArrowRight className="w-4 h-4 text-neutral-400 flex-shrink-0" />
            <select value={toId} onChange={(e) => setToId(e.target.value)} className="flex-1 px-3 py-2 text-sm border border-neutral-200 rounded-lg">
              {sessions.map((s) => <option key={s.appointment.appointment_id} value={s.appointment.appointment_id}>{s.label} — {fmtDate(s.appointment.appointment_date)}</option>)}
            </select>
          </div>

          {protocolsLoading ? (
            <p className="text-sm text-neutral-400">Loading…</p>
          ) : (
            <div className="border border-neutral-200 rounded-xl overflow-hidden">
              <div className="grid grid-cols-3 gap-2 px-4 py-2.5 bg-neutral-50 text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                <span>Metric</span><span>{from?.label ?? "—"}</span><span>{to?.label ?? "—"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 px-4 py-3 border-t border-neutral-100 items-center">
                <span className="text-sm text-neutral-600">PRS Score</span>
                <span className="text-sm font-semibold text-neutral-900">{fromSnap.score != null ? fromSnap.score.toFixed(0) : "—"}</span>
                <span className="text-sm font-semibold text-neutral-900 flex items-center gap-1.5">
                  {toSnap.score != null ? toSnap.score.toFixed(0) : "—"}
                  {scoreDelta != null && (
                    <span className={`text-xs font-semibold ${deltaTone(scoreDelta)}`}>
                      ({scoreDelta > 0 ? "+" : ""}{scoreDelta})
                    </span>
                  )}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 px-4 py-3 border-t border-neutral-100 items-center">
                <span className="text-sm text-neutral-600">Severity</span>
                <span className="text-sm text-neutral-900">{fromSnap.severity ?? "—"}</span>
                <span className="text-sm text-neutral-900">{toSnap.severity ?? "—"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 px-4 py-3 border-t border-neutral-100 items-center">
                <span className="text-sm text-neutral-600">Current</span>
                <span className="text-sm text-neutral-900">{fromSnap.protocol?.prescribed_current_ma != null ? `${fromSnap.protocol.prescribed_current_ma} mA` : "—"}</span>
                <span className="text-sm text-neutral-900">{toSnap.protocol?.prescribed_current_ma != null ? `${toSnap.protocol.prescribed_current_ma} mA` : "—"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 px-4 py-3 border-t border-neutral-100 items-center">
                <span className="text-sm text-neutral-600">Duration</span>
                <span className="text-sm text-neutral-900">{fromSnap.protocol?.prescribed_duration_min != null ? `${fromSnap.protocol.prescribed_duration_min} min` : "—"}</span>
                <span className="text-sm text-neutral-900">{toSnap.protocol?.prescribed_duration_min != null ? `${toSnap.protocol.prescribed_duration_min} min` : "—"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 px-4 py-3 border-t border-neutral-100 items-center">
                <span className="text-sm text-neutral-600">Frequency</span>
                <span className="text-sm text-neutral-900">{fromSnap.protocol?.sessions_per_week != null ? `${fromSnap.protocol.sessions_per_week}/week` : "—"}</span>
                <span className="text-sm text-neutral-900">{toSnap.protocol?.sessions_per_week != null ? `${toSnap.protocol.sessions_per_week}/week` : "—"}</span>
              </div>
            </div>
          )}
          <p className="text-[11px] text-neutral-400">
            Best-effort snapshot as of each session's date — the latest PRS score and protocol version recorded on or before it.
          </p>
        </div>
      </div>
    </div>
  );
}
