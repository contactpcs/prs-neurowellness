"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Plus, Pencil, FileText, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { treatmentProtocolService } from "@/lib/api/services/treatmentProtocol.service";
import { usePatientScoresSummary } from "@/lib/hooks";
import type { ClinicalSessionTab } from "@/lib/hooks/usePatientClinicalSessions";
import type { ProtocolRead } from "@/types/treatmentProtocol.types";
import type { AnamnesisRecord } from "@/types/domain.types";
import { asOfSnapshot, deltaTone, type ClinicalSnapshot } from "@/lib/utils/clinicalSnapshot";

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function protocolSummary(p: ProtocolRead | null): string {
  if (!p) return "—";
  const bits = [
    p.device_name || p.modality || "Protocol",
    p.prescribed_current_ma != null ? `${p.prescribed_current_ma} mA` : null,
    p.prescribed_duration_min != null ? `${p.prescribed_duration_min} min` : null,
    p.sessions_per_week != null ? `${p.sessions_per_week}/week` : null,
  ].filter(Boolean);
  return bits.join(" · ");
}

/** The Treatment Plan for a given clinical stage (Consultation or a specific
 * Follow-up): the full journey up to and including that stage, plus what
 * changed since the previous stage. Editable only while `locked` is false —
 * the caller decides that (frozen once a later session exists, or once a
 * Final Report has been generated for this exact stage). */
export function TreatmentPlanPanel({
  patientId,
  currentSession,
  sessionsUpToCurrent,
  locked,
  anamnesis,
  doctorNoteText,
  onGenerateFinalReport,
}: {
  patientId: string;
  currentSession: ClinicalSessionTab | null;
  sessionsUpToCurrent: ClinicalSessionTab[];
  locked: boolean;
  anamnesis: AnamnesisRecord | null;
  doctorNoteText: string | null;
  onGenerateFinalReport: () => void;
}) {
  const router = useRouter();
  const [protocols, setProtocols] = useState<ProtocolRead[]>([]);
  const [protocolsLoading, setProtocolsLoading] = useState(true);
  const { instances: scoreInstances } = usePatientScoresSummary(patientId);

  useEffect(() => {
    setProtocolsLoading(true);
    treatmentProtocolService
      .listProtocols({ patientId })
      .then((list) => setProtocols(list))
      .catch(() => setProtocols([]))
      .finally(() => setProtocolsLoading(false));
  }, [patientId]);

  if (!currentSession) {
    return <p className="text-sm text-neutral-400">Loading…</p>;
  }

  const rows: { session: ClinicalSessionTab; snapshot: ClinicalSnapshot }[] = sessionsUpToCurrent.map((session) => ({
    session,
    snapshot: asOfSnapshot(session.appointment.appointment_date, scoreInstances, protocols),
  }));
  const current = rows[rows.length - 1] ?? null;
  const previous = rows.length >= 2 ? rows[rows.length - 2] : null;

  const scoreDelta =
    previous && current && previous.snapshot.score != null && current.snapshot.score != null
      ? Math.round((current.snapshot.score - previous.snapshot.score) * 10) / 10
      : null;

  const activeProtocol = protocols.find((p) => p.status === "active") ?? protocols[protocols.length - 1] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 mb-1 flex items-center gap-2">
            Treatment Plan — {currentSession.label}
            {locked && <Lock className="w-4 h-4 text-neutral-400" />}
          </h2>
          <p className="text-neutral-600 text-sm">
            {locked
              ? "This stage is locked — a later session or Final Report already closed it out. Data below is read-only."
              : "The full journey through this stage. Editable until a Final Report is generated or a follow-up begins."}
          </p>
        </div>
        {!locked && (
          <button
            onClick={onGenerateFinalReport}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 text-xs font-semibold flex-shrink-0"
          >
            <FileText className="w-3.5 h-3.5" /> Generate Final Report
          </button>
        )}
      </div>

      {/* Patient Journey */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-neutral-900">Patient Journey</h3>
        {protocolsLoading ? (
          <p className="text-sm text-neutral-400">Loading…</p>
        ) : (
          <div className="border border-neutral-200 rounded-xl overflow-hidden">
            <div className="grid grid-cols-4 gap-2 px-4 py-2.5 bg-neutral-50 text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
              <span>Stage</span><span>Date</span><span>PRS Score</span><span>Protocol</span>
            </div>
            {rows.map(({ session, snapshot }, i) => (
              <div
                key={session.appointment.appointment_id}
                className={`grid grid-cols-4 gap-2 px-4 py-3 border-t border-neutral-100 items-center ${
                  i === rows.length - 1 ? "bg-blue-50/50" : ""
                }`}
              >
                <span className="text-sm font-medium text-neutral-900">{session.label}</span>
                <span className="text-sm text-neutral-600">{fmtDate(session.appointment.appointment_date)}</span>
                <span className="text-sm text-neutral-900">
                  {snapshot.score != null ? snapshot.score.toFixed(0) : "—"}
                  {snapshot.severity && <span className="text-xs text-neutral-400"> · {snapshot.severity}</span>}
                </span>
                <span className="text-sm text-neutral-700">{protocolSummary(snapshot.protocol)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Progress since previous stage */}
      {previous && current && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-neutral-900">Progress Since {previous.session.label}</h3>
          <div className="border border-neutral-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-600">PRS Score</span>
              <span className="text-sm font-semibold text-neutral-900 flex items-center gap-1.5">
                {previous.snapshot.score != null ? previous.snapshot.score.toFixed(0) : "—"}
                <span className="text-neutral-300">→</span>
                {current.snapshot.score != null ? current.snapshot.score.toFixed(0) : "—"}
                {scoreDelta != null && (
                  <span className={`text-xs font-semibold flex items-center gap-0.5 ${deltaTone(scoreDelta)}`}>
                    {scoreDelta === 0 ? <Minus className="w-3 h-3" /> : scoreDelta < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                    ({scoreDelta > 0 ? "+" : ""}{scoreDelta})
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-600">Severity</span>
              <span className="text-sm text-neutral-900">{previous.snapshot.severity ?? "—"} <span className="text-neutral-300">→</span> {current.snapshot.severity ?? "—"}</span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="text-sm text-neutral-600 flex-shrink-0">Treatment Protocol</span>
              <span className="text-sm text-neutral-900 text-right">{protocolSummary(previous.snapshot.protocol)} <span className="text-neutral-300">→</span> {protocolSummary(current.snapshot.protocol)}</span>
            </div>
          </div>
          <p className="text-[11px] text-neutral-400">
            Best-effort snapshot as of each stage's date — the latest PRS score and protocol version recorded on or before it.
          </p>
        </div>
      )}

      {/* Current stage details */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-neutral-900">Current Stage Details</h3>
        <div className="border border-neutral-200 rounded-xl divide-y divide-neutral-100">
          <div className="px-4 py-3">
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">Chief Complaint</p>
            <p className="text-sm text-neutral-900">{anamnesis?.chief_complaint || "—"}</p>
          </div>
          <div className="px-4 py-3">
            <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">Doctor Notes</p>
            <p className="text-sm text-neutral-900 whitespace-pre-wrap">{doctorNoteText || "—"}</p>
          </div>
          <div className="px-4 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide mb-1">Treatment Protocol</p>
              <p className="text-sm text-neutral-900">{protocolSummary(activeProtocol)}</p>
            </div>
            {!locked && (
              activeProtocol && activeProtocol.status === "active" ? (
                <button
                  onClick={() => router.push(`/doctor/patients/${patientId}/treatment-protocol/wizard?mode=modify&protocolId=${activeProtocol.protocol_id}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-neutral-700 text-xs font-semibold flex-shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" /> Modify Protocol
                </button>
              ) : (
                <button
                  onClick={() => router.push(`/doctor/patients/${patientId}/treatment-protocol/wizard?mode=new`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-gradient text-white text-xs font-semibold flex-shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" /> Start Treatment Protocol
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
