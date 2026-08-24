"use client";

import { useMemo } from "react";
import {
  ChevronLeft, ChevronRight, AlertTriangle, Check, Lock, Zap, Activity,
  Cable, HeartPulse, ShieldAlert, Shield, ClipboardList, Lightbulb,
  MessageSquare, FileText, Image as ImageIcon, Calendar, Siren,
} from "lucide-react";
import Link from "next/link";
import { useDeviceSession } from "@/lib/hooks/useDeviceSession";
import { deviceSessionLabel, deviceSessionTone } from "@/lib/utils/deviceSessionStatus";
import type { ProtocolDetail, ProtocolSessionRead } from "@/types/treatmentProtocol.types";
import type { Severity, SessionStatus } from "@/types/deviceSession.types";

// ─── Formatting ─────────────────────────────────────────────────────────────

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso + (iso.length <= 10 ? "T00:00:00" : "")).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
}
function fmtTime(t?: string | null): string {
  if (!t) return "—";
  return t.slice(0, 5);
}
function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
function humanize(s?: string | null): string {
  if (!s) return "—";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const SEVERITY_TONE: Record<Severity, string> = {
  mild: "bg-amber-50 text-amber-700",
  moderate: "bg-orange-100 text-orange-800",
  severe: "bg-red-50 text-red-700",
};

const SESSION_STATUS_LABEL: Record<SessionStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  paused: "Paused",
  completed: "Completed",
  stopped_early: "Stopped Early",
};

const SESSION_STATUS_TONE: Record<SessionStatus, string> = {
  not_started: "bg-neutral-100 text-neutral-500",
  in_progress: "bg-primary-50 text-primary-700",
  paused: "bg-amber-50 text-amber-700",
  completed: "bg-green-50 text-green-700",
  stopped_early: "bg-orange-50 text-orange-700",
};

function impedanceChip(kohm: number | null): [string, string] {
  if (kohm === null || kohm === undefined) return ["Not recorded", "bg-neutral-100 text-neutral-500"];
  if (kohm < 5) return [`Good — ${kohm} kΩ`, "bg-green-50 text-green-700"];
  if (kohm <= 10) return [`Acceptable — ${kohm} kΩ`, "bg-amber-50 text-amber-700"];
  return [`Too high — ${kohm} kΩ`, "bg-red-50 text-red-700"];
}

// ─── Small building blocks ──────────────────────────────────────────────────

function Sec({
  title, icon, action, tone, children,
}: { title: string; icon?: React.ReactNode; action?: React.ReactNode; tone?: "warning" | "danger"; children: React.ReactNode }) {
  const border = tone === "danger" ? "border-red-200" : tone === "warning" ? "border-amber-200" : "border-neutral-200";
  const accent = tone === "danger" ? "border-l-red-500" : tone === "warning" ? "border-l-amber-500" : "border-l-transparent";
  const bg = tone === "danger" ? "bg-red-50/40" : tone === "warning" ? "bg-amber-50/40" : "bg-white";
  return (
    <div className={`border ${border} border-l-[3px] ${accent} rounded-xl ${bg} overflow-hidden`}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-100 flex-wrap">
        {icon && <span className="text-neutral-500 flex-shrink-0">{icon}</span>}
        <span className="text-[13.5px] font-bold text-neutral-900">{title}</span>
        <div className="flex-1" />
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Rows({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <div className="grid gap-x-5 gap-y-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
      {items.map(([k, v], i) => (
        <div key={i} className="flex gap-2.5 text-xs leading-relaxed">
          <span className="w-28 flex-shrink-0 text-neutral-400">{k}</span>
          <span className="flex-1 text-neutral-800 font-medium">{v}</span>
        </div>
      ))}
    </div>
  );
}

function Ok({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-neutral-700">
      <span className="w-4 h-4 rounded-full bg-green-500 text-white flex items-center justify-center flex-shrink-0">
        <Check className="w-2.5 h-2.5" />
      </span>
      {label}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-dashed border-neutral-200 rounded-lg px-4 py-3.5 text-xs text-neutral-400 text-center">
      {children}
    </div>
  );
}

// ─── Panel ───────────────────────────────────────────────────────────────

export function SessionReviewPanel({
  patientId, patientName, protocol, session, sessions, onBack, onSelectSession, onOpenProtocol,
}: {
  patientId: string;
  patientName?: string | null;
  protocol: ProtocolDetail;
  session: ProtocolSessionRead;
  sessions: ProtocolSessionRead[];
  onBack: () => void;
  onSelectSession: (appointmentId: string) => void;
  onOpenProtocol?: () => void;
}) {
  const { session: detail, isLoading, error } = useDeviceSession(session.appointment_id);

  const ordered = useMemo(
    () => sessions.slice().sort((a, b) => (a.session_number ?? 0) - (b.session_number ?? 0)),
    [sessions],
  );
  const idx = ordered.findIndex((s) => s.appointment_id === session.appointment_id);
  const prev = idx > 0 ? ordered[idx - 1] : null;
  const next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;

  const started = session.status !== "planned" && session.status !== "selected" && session.status !== "paid" && session.status !== "checked_in";
  const readOnly = ["completed", "cancelled", "no_show"].includes(session.status);

  const plannedMin = protocol.dosing?.session_duration_min ?? protocol.prescribed_duration_min ?? null;
  const actualMin = detail?.actual_duration_min ?? null;
  const pct = actualMin != null && plannedMin ? Math.round((actualMin / plannedMin) * 100) : null;
  const [impLabel, impTone] = impedanceChip(detail?.impedance_kohm ?? null);

  const hasSevereSymptom = (detail?.symptoms ?? []).some((s) => s.severity === "severe");
  const hasAdverseEvent = (detail?.adverse_events ?? []).length > 0;
  const openSos = (detail?.sos_events ?? []).filter((e) => !e.acknowledged_at);

  return (
    <div className="flex flex-col gap-4">
      {/* Nav */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <button onClick={onBack} className="flex items-center gap-1.5 text-neutral-500 hover:text-neutral-800 text-xs font-medium">
          <ChevronLeft className="w-3.5 h-3.5" /> Back to Sessions
        </button>
        <div className="flex-1" />
        <button
          disabled={!prev}
          onClick={() => prev && onSelectSession(prev.appointment_id)}
          className="h-8 px-3 rounded-lg border border-neutral-200 bg-white text-xs font-semibold flex items-center gap-1 disabled:text-neutral-300 disabled:cursor-not-allowed text-neutral-700 hover:bg-neutral-50"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Previous
        </button>
        <button
          disabled={!next}
          onClick={() => next && onSelectSession(next.appointment_id)}
          className="h-8 px-3 rounded-lg border border-neutral-200 bg-white text-xs font-semibold flex items-center gap-1 disabled:text-neutral-300 disabled:cursor-not-allowed text-neutral-700 hover:bg-neutral-50"
        >
          Next <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm px-5 py-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-neutral-900">{patientName ?? "Patient"}</h2>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-primary-50 text-primary-700">
                Session {session.session_number ?? "—"} of {protocol.session_count}
              </span>
              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${deviceSessionTone(session.status)}`}>
                {deviceSessionLabel(session.status)}
              </span>
              {readOnly && (
                <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-neutral-100 text-neutral-500 flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Read-only
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 mt-1 capitalize">{humanize(session.appointment_type)}</p>
          </div>
          <div className="flex gap-5 flex-wrap">
            {([
              ["Date", fmtDate(session.appointment_date)],
              ["Time", session.start_time ? `${fmtTime(session.start_time)} – ${fmtTime(session.end_time)}` : "—"],
              ["Clinical Assistant", session.ca_id ? "Assigned" : "Not assigned"],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k}>
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">{k}</p>
                <p className="text-[13px] font-semibold text-neutral-800 mt-0.5">{v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Safety banner */}
      {(hasSevereSymptom || hasAdverseEvent || openSos.length > 0) && (
        <div className="border border-red-200 border-l-[3px] border-l-red-500 rounded-xl bg-red-50 px-4 py-3 flex items-center gap-3 flex-wrap">
          <AlertTriangle className="w-4 h-4 text-red-700 flex-shrink-0" />
          <div className="flex-1 min-w-[180px]">
            <p className="text-[13px] font-bold text-red-800">
              {openSos.length > 0 ? "Unacknowledged SOS raised during this session" : hasAdverseEvent ? "Adverse event recorded in this session" : "Severe symptom recorded in this session"}
            </p>
            <p className="text-xs text-red-700 mt-0.5">Consider whether the treatment protocol should be adjusted for upcoming sessions.</p>
          </div>
          {onOpenProtocol && (
            <button onClick={onOpenProtocol} className="h-8 px-3.5 rounded-lg bg-action-orange text-white text-xs font-semibold flex-shrink-0">
              Review Treatment Protocol
            </button>
          )}
        </div>
      )}

      {!started ? (
        <Empty>This session has not been reached yet — nothing has been recorded.</Empty>
      ) : isLoading ? (
        <div className="text-center py-10 text-sm text-neutral-400">Loading session record…</div>
      ) : error || !detail ? (
        <Empty>No device session record found for this appointment yet.</Empty>
      ) : (
        <>
          {/* Treatment delivered */}
          <Sec title="Treatment Delivered" icon={<Zap className="w-3.5 h-3.5" />}>
            <Rows
              items={[
                ["Device", protocol.device_name || "—"],
                ["Montage", protocol.placement_summary || protocol.custom_montage?.montage_name || "—"],
                ["Anode (+)", protocol.placement?.anode_site || "—"],
                ["Cathode (–)", protocol.placement?.cathode_site || (protocol.placement?.return_sites?.join(", ") ?? "—")],
                ["Prescribed Current", protocol.prescribed_current_ma != null ? `${protocol.prescribed_current_ma} mA` : "—"],
                ["Actual Current", detail.actual_intensity_ma != null ? `${detail.actual_intensity_ma} mA${detail.intensity_deviates ? " (deviated)" : ""}` : "—"],
                ["Prescribed Duration", plannedMin != null ? `${plannedMin} min` : "—"],
                ["Actual Duration", actualMin != null ? `${actualMin} min${detail.duration_deviates ? " (deviated)" : ""}` : "—"],
                ["Ramp Up", detail.actual_ramp_up_sec != null ? `${detail.actual_ramp_up_sec}s` : "—"],
                ["Ramp Down", detail.actual_ramp_down_sec != null ? `${detail.actual_ramp_down_sec}s` : "—"],
              ]}
            />
            {(detail.intensity_deviation_reason || detail.duration_deviation_reason) && (
              <div className="mt-3 border border-amber-200 bg-amber-50 rounded-lg px-3 py-2.5 text-xs text-amber-800">
                {detail.intensity_deviation_reason && <p>Current deviation: {detail.intensity_deviation_reason}</p>}
                {detail.duration_deviation_reason && <p className="mt-1">Duration deviation: {detail.duration_deviation_reason}</p>}
              </div>
            )}
          </Sec>

          <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            {/* Execution */}
            <Sec title="Session Execution" icon={<Activity className="w-3.5 h-3.5" />}>
              {detail.session_status === "stopped_early" && (
                <div className="border border-amber-200 bg-amber-50 rounded-lg px-3 py-2.5 mb-3 flex gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800 leading-relaxed">
                    <b>Session stopped early.</b><br />
                    Reason: {humanize(detail.pause_stop_reason)}{detail.pause_stop_reason_detail ? ` — ${detail.pause_stop_reason_detail}` : ""}
                  </div>
                </div>
              )}
              <Rows
                items={[
                  ["Status", <span key="s" className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${SESSION_STATUS_TONE[detail.session_status]}`}>{SESSION_STATUS_LABEL[detail.session_status]}</span>],
                  ["Started", fmtDateTime(detail.started_at)],
                  ["Completed / Stopped", fmtDateTime(detail.completed_at || detail.stopped_at)],
                  ["Completion", pct != null ? `${pct}%` : "—"],
                ]}
              />
              {pct != null && (
                <div className="mt-3 h-1.5 rounded-full bg-neutral-100 overflow-hidden">
                  <div className={`h-full ${pct === 100 ? "bg-green-500" : "bg-amber-500"}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              )}
            </Sec>

            {/* Device & impedance */}
            <Sec title="Device &amp; Impedance" icon={<Cable className="w-3.5 h-3.5" />}>
              <Rows
                items={[
                  ["Device Brand", detail.device_brand || "—"],
                  ["Serial Number", detail.device_serial_number || "—"],
                ]}
              />
              <div className="flex gap-2 flex-wrap mt-3">
                <span className={`text-[11.5px] font-semibold px-2.5 py-1 rounded-full ${impTone}`}>Pre-session impedance: {impLabel}</span>
                {detail.montage_verified && <span className="text-[11.5px] font-semibold px-2.5 py-1 rounded-full bg-green-50 text-green-700">Montage verified</span>}
              </div>
              {Object.keys(detail.device_fit_checklist || {}).length > 0 && (
                <div className="flex flex-col gap-2 mt-3">
                  {Object.entries(detail.device_fit_checklist).map(([k, v]) => (
                    v ? <Ok key={k} label={humanize(k)} /> : (
                      <div key={k} className="flex items-center gap-2 text-xs text-neutral-400">
                        <span className="w-4 h-4 rounded-full border border-neutral-300 flex-shrink-0" />
                        {humanize(k)}
                      </div>
                    )
                  ))}
                </div>
              )}
            </Sec>
          </div>

          <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            {/* Symptoms */}
            <Sec title="Patient Response" icon={<HeartPulse className="w-3.5 h-3.5" />}>
              {detail.symptoms.length ? (
                <div className="flex flex-col gap-2">
                  {detail.symptoms.map((sy) => (
                    <div key={sy.symptom_record_id} className="flex items-center justify-between gap-2.5 border border-neutral-200 rounded-lg px-3 py-2">
                      <div className="min-w-0">
                        <span className="text-xs text-neutral-800">{humanize(sy.symptom)}</span>
                        {sy.note && <p className="text-[11px] text-neutral-400 mt-0.5 truncate">{sy.note}</p>}
                      </div>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${SEVERITY_TONE[sy.severity]}`}>{humanize(sy.severity)}</span>
                    </div>
                  ))}
                </div>
              ) : <Ok label="No symptoms reported" />}
            </Sec>

            {/* Adverse events */}
            <Sec title="Adverse Events" icon={detail.adverse_events.length ? <ShieldAlert className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />} tone={detail.adverse_events.length ? "danger" : undefined}>
              {detail.adverse_events.length ? (
                <div className="flex flex-col gap-2.5">
                  {detail.adverse_events.map((ae) => (
                    <Rows
                      key={ae.ae_record_id}
                      items={[
                        ["Type", humanize(ae.event_type)],
                        ["Severity", <span key="sev" className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${SEVERITY_TONE[ae.severity]}`}>{humanize(ae.severity)}</span>],
                        ["Time", fmtDateTime(ae.recorded_at)],
                        ["Description", ae.description],
                        ["Action Taken", ae.action_taken || "—"],
                      ]}
                    />
                  ))}
                </div>
              ) : <Ok label="No adverse events recorded" />}
            </Sec>
          </div>

          <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            {/* Cognitive activities */}
            <Sec title="Cognitive Activities" icon={<Lightbulb className="w-3.5 h-3.5" />}>
              {detail.activities.length ? (
                <Rows
                  items={[
                    ["Activities", detail.activities.flatMap((a) => a.activities).map(humanize).join(", ") || "—"],
                    ...(detail.activities.some((a) => a.note) ? [["Notes", detail.activities.map((a) => a.note).filter(Boolean).join("; ")] as [string, string]] : []),
                  ]}
                />
              ) : <Empty>No cognitive activities recorded.</Empty>}
            </Sec>

            {/* Feedback */}
            <Sec title="Patient Feedback" icon={<MessageSquare className="w-3.5 h-3.5" />}>
              {detail.feedback ? (
                <>
                  <Rows
                    items={[
                      ["Comfort", humanize(detail.feedback.answers.comfort)],
                      ["Felt After", humanize(detail.feedback.answers.felt_after)],
                      ["Next Intensity", humanize(detail.feedback.answers.next_intensity)],
                    ]}
                  />
                  {detail.feedback.quote && (
                    <div className="mt-3 border border-neutral-200 rounded-lg bg-neutral-50 px-3 py-2.5 text-xs text-neutral-800 italic">
                      &ldquo;{detail.feedback.quote}&rdquo;
                    </div>
                  )}
                </>
              ) : <Empty>No patient feedback recorded.</Empty>}
            </Sec>
          </div>

          {/* Scales */}
          <Sec title="Scales &amp; Assessments" icon={<ClipboardList className="w-3.5 h-3.5" />}>
            {detail.scales.length ? (
              <div className="border border-neutral-200 rounded-lg overflow-hidden">
                {detail.scales.map((sc, i) => (
                  <div key={sc.session_scale_id} className={`flex items-center gap-3 px-3.5 py-2.5 flex-wrap ${i < detail.scales.length - 1 ? "border-b border-neutral-100" : ""}`}>
                    <div className="flex-1 min-w-[140px]">
                      <p className="text-[13px] font-semibold text-neutral-900">{sc.scale_name || sc.scale_code || "Scale"}</p>
                      <p className="text-[11px] text-neutral-400 mt-0.5">{sc.delivery_mode ? humanize(sc.delivery_mode) : "—"}</p>
                    </div>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${sc.status === "completed" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
                      {humanize(sc.status)}
                    </span>
                    {sc.prs_instance_id && (
                      <Link href={`/doctor/patients/${patientId}/results?instance_id=${sc.prs_instance_id}`} className="h-7 px-2.5 rounded-md border border-neutral-200 text-[11px] font-semibold text-neutral-700 hover:bg-neutral-50 flex items-center">
                        View Assessment
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            ) : <Empty>No assessments recorded for this session.</Empty>}
          </Sec>

          {/* Notes */}
          <Sec title="Session Notes" icon={<FileText className="w-3.5 h-3.5" />}>
            {detail.notes.length ? (
              <div className="flex flex-col gap-2.5">
                {detail.notes.map((n) => (
                  <div key={n.note_id} className="border border-neutral-200 border-l-[3px] border-l-sky-400 rounded-lg px-3.5 py-3">
                    <p className="text-[13px] text-neutral-800 leading-relaxed">&ldquo;{n.note_text}&rdquo;</p>
                    <p className="text-[11px] text-neutral-400 mt-2">{fmtDateTime(n.recorded_at)}</p>
                  </div>
                ))}
              </div>
            ) : <Empty>No notes recorded for this session.</Empty>}
          </Sec>

          <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
            {/* Media */}
            <Sec title="Media &amp; Recordings" icon={<ImageIcon className="w-3.5 h-3.5" />}>
              {detail.media.some((m) => m.recording_consent_confirmed) ? (
                detail.media.length ? (
                  <Rows items={[["Consent", "Obtained"], ["Attachments", detail.media.map((m) => humanize(m.media_type)).join(", ")]]} />
                ) : <Rows items={[["Consent", "Obtained"]]} />
              ) : (
                <div className="border border-dashed border-neutral-300 rounded-lg py-4 px-4 text-center">
                  <Lock className="w-4 h-4 text-neutral-400 mx-auto" />
                  <p className="text-xs font-semibold text-neutral-700 mt-2">Media not available</p>
                  <p className="text-[11px] text-neutral-400 mt-1">Recording consent was not obtained for this session.</p>
                </div>
              )}
            </Sec>

            {/* Next session confirmation */}
            <Sec title="Next Session" icon={<Calendar className="w-3.5 h-3.5" />}>
              {detail.next_session_confirmation ? (
                <Rows
                  items={[
                    ["Patient Confirmed", detail.next_session_confirmation.patient_confirmed ? "Yes" : "No"],
                    ["Requested Date", detail.next_session_confirmation.requested_date || "—"],
                    ["Requested Slot", detail.next_session_confirmation.requested_slot || "—"],
                    ["Note", detail.next_session_confirmation.note || "—"],
                  ]}
                />
              ) : <Empty>No next-session confirmation recorded.</Empty>}
            </Sec>
          </div>

          {/* SOS */}
          {detail.sos_events.length > 0 && (
            <Sec title="SOS Alerts" icon={<Siren className="w-3.5 h-3.5" />} tone="danger">
              <div className="flex flex-col gap-2.5">
                {detail.sos_events.map((e) => (
                  <Rows
                    key={e.sos_id}
                    items={[
                      ["Type", humanize(e.sos_type)],
                      ["Raised", fmtDateTime(e.raised_at)],
                      ["Note", e.note || "—"],
                      ["Acknowledged", e.acknowledged_at ? fmtDateTime(e.acknowledged_at) : "Not acknowledged"],
                    ]}
                  />
                ))}
              </div>
            </Sec>
          )}
        </>
      )}
    </div>
  );
}
