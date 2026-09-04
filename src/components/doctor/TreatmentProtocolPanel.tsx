"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Plus } from "lucide-react";
import { treatmentProtocolService } from "@/lib/api/services/treatmentProtocol.service";
import { Card, CardContent, Badge, PageLoader, Button, DetailFieldList } from "@/components/ui";
import { deviceSessionLabel, deviceSessionTone } from "@/lib/utils/deviceSessionStatus";
import { SessionReviewPanel } from "@/components/doctor/SessionReviewPanel";
import type { ProtocolRead, ProtocolDetail, ProtocolSessionRead } from "@/types/treatmentProtocol.types";

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** The wizard writes "Reason: <label> — <note>" into the one free-text
 * `notes` field the real ProtocolCreate schema has — there's no dedicated
 * reason/effective-from column, so this is the only honest place to keep
 * "why this version exists" without fabricating a field the backend
 * doesn't return. */
function splitReason(notes?: string | null): { reason: string; note: string } {
  if (!notes) return { reason: "Initial protocol", note: "" };
  const m = notes.match(/^Reason:\s*([^—]+)—\s*([\s\S]*)$/);
  if (m) return { reason: m[1].trim(), note: m[2].trim() };
  return { reason: "Initial protocol", note: notes };
}

function statusTone(status: string): string {
  switch (status) {
    case "active": return "bg-green-50 text-green-700";
    case "draft": return "bg-amber-50 text-amber-700";
    case "cancelled": return "bg-red-50 text-red-600";
    case "completed": return "bg-neutral-100 text-neutral-600";
    default: return "bg-neutral-100 text-neutral-500";
  }
}

function ElectrodeChips({ detail }: { detail: ProtocolDetail }) {
  const p = detail.placement;
  return (
    <Card>
      <CardContent className="space-y-4">
        <h3 className="text-sm font-semibold text-neutral-900">Electrode Placement</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-center">
            <p className="text-xs font-semibold text-red-600 tracking-wide">ANODE (+)</p>
            <p className="text-2xl font-bold text-red-700 mt-1">{p?.anode_site || "—"}</p>
          </div>
          <div className="rounded-xl bg-blue-50 border border-blue-100 px-4 py-3 text-center">
            <p className="text-xs font-semibold text-blue-600 tracking-wide">CATHODE (–)</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">{p?.cathode_site || (p?.return_sites?.join(", ") || "—")}</p>
          </div>
        </div>
        <div className="space-y-2 text-sm pt-1">
          <div className="flex justify-between">
            <span className="text-neutral-500">Current</span>
            <span className="font-semibold text-neutral-900">
              {detail.dosing?.current_ma_min != null
                ? `${detail.dosing.current_ma_min} mA`
                : detail.dosing?.total_current_ma != null
                  ? `${detail.dosing.total_current_ma} mA`
                  : "—"}
            </span>
          </div>
          {(detail.modality === "tDCS" || detail.modality === "HD-tDCS") && (
            <div className="flex justify-between">
              <span className="text-neutral-500">Placement System</span>
              <span className="font-semibold text-neutral-900">10-20 System</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-neutral-500">Governs</span>
            <span className="font-semibold text-neutral-900">Sessions 1–{detail.session_count}</span>
          </div>
        </div>
        <p className="text-xs text-neutral-400 pt-1 border-t border-neutral-100">
          Changing these values creates a new protocol version. Sessions already performed keep the parameters used at the time.
        </p>
      </CardContent>
    </Card>
  );
}

/** Device sessions (and follow-up appointments) generated from the active
 * protocol — click a row to expand its full detail inline. Follow-ups are
 * shown separately since they're a different appointment_type ("protocol_
 * followup") from device sessions, booked either directly by the patient
 * or auto-scheduled by the protocol's follow-up cadence. */
function SessionsList({ detail, onOpenSession }: { detail: ProtocolDetail; onOpenSession?: (appointmentId: string) => void }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const sessions = detail.sessions.slice().sort((a, b) => (a.session_number ?? 0) - (b.session_number ?? 0));
  const followUps = detail.follow_ups.slice().sort((a, b) => (a.appointment_date || "").localeCompare(b.appointment_date || ""));

  const Row = ({ s, label, openable }: { s: ProtocolSessionRead; label: string; openable?: boolean }) => {
    const open = openId === s.appointment_id;
    return (
      <div key={s.appointment_id} className="border-b border-neutral-100 last:border-0">
        <button
          onClick={() => (openable && onOpenSession ? onOpenSession(s.appointment_id) : setOpenId(open ? null : s.appointment_id))}
          className="w-full grid grid-cols-[70px_1fr_1fr_1fr_140px] gap-3 items-center px-4 py-3 text-left hover:bg-neutral-50 transition-colors"
        >
          <span className="text-sm font-bold text-neutral-900">{label}</span>
          <span className="text-sm text-neutral-700">{fmtDate(s.appointment_date)}</span>
          <span className="text-sm text-neutral-600">{s.start_time || "—"}</span>
          <span className="text-sm text-neutral-600">{s.ca_id ? "Assigned" : "—"}</span>
          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium w-fit ${deviceSessionTone(s.status)}`}>
            {deviceSessionLabel(s.status)}
          </span>
        </button>
        {open && (
          <div className="px-4 pb-3">
            <DetailFieldList
              data={{
                appointment_id: s.appointment_id,
                appointment_type: s.appointment_type,
                session_number: s.session_number,
                date: s.appointment_date,
                start_time: s.start_time,
                end_time: s.end_time,
                status: deviceSessionLabel(s.status),
              }}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-neutral-100">
            <h3 className="text-sm font-semibold text-neutral-900">Device Sessions ({sessions.length})</h3>
            <p className="text-xs text-neutral-400 mt-0.5">Generated from this protocol. Click a row for details.</p>
          </div>
          {sessions.length === 0 ? (
            <p className="text-sm text-neutral-400 px-4 py-8 text-center">No device sessions scheduled yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-[70px_1fr_1fr_1fr_140px] gap-3 px-4 py-2 bg-neutral-50 text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">
                <span>Session</span><span>Date</span><span>Time</span><span>Assistant</span><span>Status</span>
              </div>
              {sessions.map((s) => <Row key={s.appointment_id} s={s} label={s.session_number != null ? `#${s.session_number}` : "—"} openable />)}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-neutral-100">
            <h3 className="text-sm font-semibold text-neutral-900">Follow-up Appointments ({followUps.length})</h3>
            <p className="text-xs text-neutral-400 mt-0.5">Protocol follow-ups — booked by the patient or scheduled by the protocol&apos;s follow-up cadence.</p>
          </div>
          {followUps.length === 0 ? (
            <p className="text-sm text-neutral-400 px-4 py-8 text-center">No follow-up appointments booked yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-[70px_1fr_1fr_1fr_140px] gap-3 px-4 py-2 bg-neutral-50 text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">
                <span>Follow-up</span><span>Date</span><span>Time</span><span>Assistant</span><span>Status</span>
              </div>
              {followUps.map((s, i) => <Row key={s.appointment_id} s={s} label={`#${i + 1}`} />)}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProtocolFacts({ detail, title }: { detail: ProtocolDetail; title: string }) {
  const first = detail.sessions[0]?.appointment_date;
  const last = detail.sessions[detail.sessions.length - 1]?.appointment_date;
  const rows: [string, string][] = [
    ["Device / Modality", detail.device_name ? `${detail.device_name} · ${detail.modality}` : detail.modality || "—"],
    ["Session Duration", detail.dosing?.session_duration_min != null ? `${detail.dosing.session_duration_min} min` : "—"],
    ["Sessions Per Day", detail.dosing?.sessions_per_day != null ? `${detail.dosing.sessions_per_day} session / day` : "—"],
    ["Treatment Period", first && last ? `${fmtDate(first)} – ${fmtDate(last)}` : "—"],
    ["Total Planned Sessions", String(detail.session_count)],
    ["Follow-ups", detail.follow_up_every_n ? `Every ${detail.follow_up_every_n} sessions` : "None scheduled"],
  ];
  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">{title}</h3>
          <Badge className={statusTone(detail.status)}>{detail.status}</Badge>
        </div>
        <div className="divide-y divide-neutral-100">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between py-2 text-sm">
              <span className="text-neutral-500">{k}</span>
              <span className="font-semibold text-neutral-900 text-right">{v}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/** Treatment Protocol summary — embedded directly in the patient workspace's
 * "Treatment Protocol" clinical-journey section, and reused as-is by the
 * dedicated /treatment-protocol page (which just adds a back button and a
 * page title around it). One component, one data-fetch, two call sites. */
export function TreatmentProtocolPanel({ patientId, showHeader = true }: { patientId: string; showHeader?: boolean }) {
  const router = useRouter();

  const [protocols, setProtocols] = useState<ProtocolRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<"active" | "sessions" | "history">("active");
  const [historyDetailId, setHistoryDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProtocolDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    treatmentProtocolService.listProtocols({ patientId })
      .then((list) => setProtocols(list.slice().sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))))
      .catch(() => setProtocols([]))
      .finally(() => setIsLoading(false));
  }, [patientId]);

  const active = protocols.find((p) => p.status === "active") ?? protocols[protocols.length - 1] ?? null;
  const shownId = tab === "history" && historyDetailId ? historyDetailId : active?.protocol_id;

  useEffect(() => {
    if (!shownId) { setDetail(null); setDetailError(null); return; }
    setDetailLoading(true);
    setDetailError(null);
    treatmentProtocolService.getProtocolDetail(shownId)
      .then((d) => setDetail(d))
      .catch((err) => { setDetail(null); setDetailError(err instanceof Error ? err.message : "Failed to load protocol detail"); })
      .finally(() => setDetailLoading(false));
  }, [shownId]);

  const DetailPending = () => (
    detailLoading ? (
      <p className="text-sm text-neutral-400 px-2">Loading…</p>
    ) : (
      <div className="border border-danger-100 bg-danger-50 rounded-lg px-4 py-3 text-sm text-danger-700">
        {detailError || "Couldn't load protocol detail."}
      </div>
    )
  );

  if (isLoading) return <PageLoader />;

  const versionNumber = (p: ProtocolRead) => protocols.findIndex((x) => x.protocol_id === p.protocol_id) + 1;

  return (
    <div className="space-y-5">
      {showHeader && (
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Treatment Protocol</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Neuromodulation protocol and electrode montage{active?.patient_name ? ` for ${active.patient_name}` : ""}.
          </p>
        </div>
      )}

      {protocols.length === 0 ? (
        <Card>
          <CardContent className="space-y-4">
            <div className="border border-dashed border-neutral-200 rounded-xl py-14 text-center">
              <p className="text-sm font-bold text-neutral-900">No treatment protocol yet</p>
              <p className="text-sm text-neutral-400 mt-1.5 max-w-md mx-auto">
                {active?.patient_name || "This patient"} has no treatment protocol assigned. Assign a protocol once the assessment stage is complete.
              </p>
            </div>
            <button
              onClick={() => router.push(`/doctor/patients/${patientId}/treatment-protocol/wizard?mode=new`)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition-colors"
            >
              <Plus className="h-4 w-4" />Start New Treatment Protocol
            </button>
          </CardContent>
        </Card>
      ) : (
        <>
          {active && (
            <Card className="border-blue-100 bg-blue-50/40">
              <CardContent className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <p className="text-xs font-semibold text-blue-600 tracking-wide uppercase">
                    {active.status === "active" ? "Active Treatment Protocol" : "Most Recent Protocol"}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <h2 className="text-xl font-bold text-neutral-900">{active.device_name || active.modality || "Protocol"}</h2>
                    <Badge className="bg-blue-600 text-white">Version {versionNumber(active)}</Badge>
                  </div>
                  <div className="flex items-center gap-6 mt-2 text-xs">
                    <div>
                      <p className="text-neutral-400 uppercase tracking-wide">Effective From</p>
                      <p className="font-medium text-neutral-800">{fmtDate(active.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-neutral-400 uppercase tracking-wide">Reason For Change</p>
                      <p className="font-medium text-neutral-800">{splitReason(active.notes).reason}</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <Button variant="outline" onClick={() => { setTab("history"); setHistoryDetailId(null); }}>
                    View Protocol History
                  </Button>
                  {active.status === "active" && (
                    <Button
                      className="bg-orange-500 hover:bg-orange-600"
                      onClick={() => router.push(`/doctor/patients/${patientId}/treatment-protocol/wizard?mode=modify&protocolId=${active.protocol_id}`)}
                    >
                      Modify Protocol
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          <div className="flex gap-2 bg-neutral-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => setTab("active")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "active" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}
            >
              Active Protocol
            </button>
            <button
              onClick={() => setTab("sessions")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "sessions" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}
            >
              Sessions{detail && tab !== "history" ? ` (${detail.sessions.length})` : ""}
            </button>
            <button
              onClick={() => { setTab("history"); setHistoryDetailId(null); }}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === "history" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}
            >
              Protocol History ({protocols.length})
            </button>
          </div>

          {tab === "active" && (
            !detail ? (
              <DetailPending />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ProtocolFacts detail={detail} title={`Protocol v${versionNumber(active!)}`} />
                <ElectrodeChips detail={detail} />
              </div>
            )
          )}

          {tab === "sessions" && (
            !detail ? (
              <DetailPending />
            ) : openSessionId && detail.sessions.some((s) => s.appointment_id === openSessionId) ? (
              <SessionReviewPanel
                patientId={patientId}
                patientName={active?.patient_name}
                protocol={detail}
                session={detail.sessions.find((s) => s.appointment_id === openSessionId)!}
                sessions={detail.sessions}
                onBack={() => setOpenSessionId(null)}
                onSelectSession={setOpenSessionId}
                onOpenProtocol={() => { setOpenSessionId(null); setTab("active"); }}
              />
            ) : (
              <SessionsList detail={detail} onOpenSession={setOpenSessionId} />
            )
          )}

          {tab === "history" && !historyDetailId && (
            <div className="space-y-2">
              {protocols.slice().reverse().map((p) => {
                const v = versionNumber(p);
                return (
                  <button
                    key={p.protocol_id}
                    onClick={() => setHistoryDetailId(p.protocol_id)}
                    className="w-full text-left"
                  >
                    <Card className={p.status === "active" ? "border-blue-200" : ""}>
                      <CardContent className="flex items-center gap-4 py-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-neutral-900">v{v}</span>
                            <Badge className={statusTone(p.status)}>{p.status}</Badge>
                          </div>
                          <p className="text-xs text-neutral-400 mt-1">
                            Created: {fmtDate(p.created_at)}
                            {p.status === "active" && <> · Effective from {fmtDate(p.activated_at || p.created_at)}</>}
                          </p>
                        </div>
                        <div className="text-xs text-neutral-500 hidden sm:block">
                          {p.placement_summary || "—"}
                        </div>
                        <ChevronRight className="h-4 w-4 text-neutral-300" />
                      </CardContent>
                    </Card>
                  </button>
                );
              })}
            </div>
          )}

          {tab === "history" && historyDetailId && (
            !detail ? (
              <DetailPending />
            ) : (
              <div className="space-y-4">
                <button
                  onClick={() => setHistoryDetailId(null)}
                  className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to history
                </button>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-neutral-900">Protocol v{versionNumber(protocols.find((p) => p.protocol_id === historyDetailId)!)}</h2>
                  <Badge className={statusTone(detail.status)}>{detail.status}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="space-y-2 text-sm">
                      {([
                        ["Used for", `Sessions 1–${detail.session_count}`],
                        ["Created", fmtDate(detail.created_at)],
                        ["Device / Modality", detail.device_name ? `${detail.device_name} · ${detail.modality}` : detail.modality || "—"],
                        ["Placement", detail.placement_summary || "—"],
                        ["Current", detail.dosing?.current_ma_min != null ? `${detail.dosing.current_ma_min} mA` : detail.dosing?.total_current_ma != null ? `${detail.dosing.total_current_ma} mA` : "—"],
                        ["Duration", detail.dosing?.session_duration_min != null ? `${detail.dosing.session_duration_min} min` : "—"],
                      ] as [string, string][]).map(([k, v]) => (
                        <div key={k} className="flex justify-between py-1.5 border-b border-neutral-50 last:border-0">
                          <span className="text-neutral-500">{k}</span>
                          <span className="font-medium text-neutral-900">{v}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="space-y-3 text-sm">
                      <div>
                        <p className="text-xs text-neutral-400 uppercase tracking-wide">Modified Because</p>
                        <p className="font-medium text-neutral-800 mt-0.5">{splitReason(detail.notes).reason}</p>
                      </div>
                      <div>
                        <p className="text-xs text-neutral-400 uppercase tracking-wide">Doctor&apos;s Note</p>
                        <p className="font-medium text-neutral-800 mt-0.5">{splitReason(detail.notes).note || "—"}</p>
                      </div>
                      {detail.status === "cancelled" && (
                        <div>
                          <p className="text-xs text-neutral-400 uppercase tracking-wide">Cancelled</p>
                          <p className="font-medium text-neutral-800 mt-0.5">This version was superseded by a later protocol.</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

/** Standalone "Sessions" journey section — sits between Treatment Protocol
 * and Treatment Plan in the patient workspace. Two levels: a parent list of
 * "Treatment Session N" rows (one per treatment protocol, oldest first —
 * same numbering as the Treatment Protocol panel's version list), and, once
 * a parent is clicked, the child Device Sessions / follow-up list for that
 * protocol. SessionsList is reused so the child table stays identical to the
 * one embedded in the Treatment Protocol panel's own Sessions tab. */
export function DeviceSessionsPanel({ patientId }: { patientId: string }) {
  const router = useRouter();
  const [protocols, setProtocols] = useState<ProtocolRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openProtocolId, setOpenProtocolId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProtocolDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    treatmentProtocolService.listProtocols({ patientId })
      .then((list) => setProtocols(list.slice().sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? ""))))
      .catch(() => setProtocols([]))
      .finally(() => setIsLoading(false));
  }, [patientId]);

  const patientName = protocols[0]?.patient_name ?? null;
  const openProtocol = protocols.find((p) => p.protocol_id === openProtocolId) ?? null;
  const treatmentSessionNumber = openProtocol ? protocols.findIndex((p) => p.protocol_id === openProtocol.protocol_id) + 1 : null;

  useEffect(() => {
    if (!openProtocolId) { setDetail(null); setDetailError(null); setOpenSessionId(null); return; }
    setDetailLoading(true);
    setDetailError(null);
    treatmentProtocolService.getProtocolDetail(openProtocolId)
      .then((d) => setDetail(d))
      .catch((err) => { setDetail(null); setDetailError(err instanceof Error ? err.message : "Failed to load protocol detail"); })
      .finally(() => setDetailLoading(false));
  }, [openProtocolId]);

  if (isLoading) return <PageLoader />;

  if (detail && openSessionId && detail.sessions.some((s) => s.appointment_id === openSessionId)) {
    return (
      <SessionReviewPanel
        patientId={patientId}
        patientName={openProtocol?.patient_name}
        protocol={detail}
        session={detail.sessions.find((s) => s.appointment_id === openSessionId)!}
        sessions={detail.sessions}
        onBack={() => setOpenSessionId(null)}
        onSelectSession={setOpenSessionId}
      />
    );
  }

  // ─── Child level — device sessions for the picked Treatment Session ───
  if (openProtocolId) {
    return (
      <div className="space-y-5">
        <button
          onClick={() => setOpenProtocolId(null)}
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to treatment sessions
        </button>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-neutral-900">Treatment Session {treatmentSessionNumber}</h1>
          {openProtocol && <Badge className={statusTone(openProtocol.status)}>{openProtocol.status}</Badge>}
        </div>
        {detailLoading ? (
          <p className="text-sm text-neutral-400 px-2">Loading…</p>
        ) : !detail ? (
          <div className="border border-danger-100 bg-danger-50 rounded-lg px-4 py-3 text-sm text-danger-700">
            {detailError || "Couldn't load session detail."}
          </div>
        ) : (
          <SessionsList detail={detail} onOpenSession={setOpenSessionId} />
        )}
      </div>
    );
  }

  // ─── Parent level — one row per Treatment Session ───
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Sessions</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          {patientName ? `${patientName}'s` : "This patient's"} treatment sessions. Open one to see its device sessions and follow-up appointments.
        </p>
      </div>

      {protocols.length === 0 ? (
        <Card>
          <CardContent className="space-y-4">
            <div className="border border-dashed border-neutral-200 rounded-xl py-14 text-center">
              <p className="text-sm font-bold text-neutral-900">No treatment protocol yet</p>
              <p className="text-sm text-neutral-400 mt-1.5 max-w-md mx-auto">
                Sessions are generated from a treatment protocol — assign one first.
              </p>
            </div>
            <button
              onClick={() => router.push(`/doctor/patients/${patientId}/treatment-protocol/wizard?mode=new`)}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-orange-500 text-white font-semibold text-sm hover:bg-orange-600 transition-colors"
            >
              <Plus className="h-4 w-4" />Start New Treatment Protocol
            </button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {protocols.map((p, i) => (
            <button key={p.protocol_id} onClick={() => setOpenProtocolId(p.protocol_id)} className="w-full text-left">
              <Card className={p.status === "active" ? "border-blue-200" : ""}>
                <CardContent className="flex items-center gap-4 py-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-neutral-900">Treatment Session {i + 1}</span>
                      <Badge className={statusTone(p.status)}>{p.status}</Badge>
                    </div>
                    <p className="text-xs text-neutral-400 mt-1">
                      {p.device_name ? `${p.device_name} · ${p.modality}` : p.modality || "Protocol"}
                      {" · "}{p.session_count} session{p.session_count === 1 ? "" : "s"}
                      {" · "}Started {fmtDate(p.activated_at || p.created_at)}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-neutral-300" />
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
