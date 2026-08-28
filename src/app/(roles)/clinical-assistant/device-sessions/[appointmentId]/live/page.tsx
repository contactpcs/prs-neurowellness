"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Gauge, AlertTriangle, FileText, Dumbbell, ClipboardList, MessageSquare,
  Camera, CalendarCheck, Pause, Square, CheckCircle2, Info,
} from "lucide-react";
import { useDeviceSession } from "@/lib/hooks";
import { appointmentsService } from "@/lib/api/services";
import { treatmentProtocolService } from "@/lib/api/services/treatmentProtocol.service";
import { Button, Card, CardContent, Input, PageLoader } from "@/components/ui";
import { CountdownTimer } from "@/components/deviceSession/CountdownTimer";
import { SymptomChipSelector } from "@/components/deviceSession/SymptomChipSelector";
import { AdverseEventForm } from "@/components/deviceSession/AdverseEventForm";
import { PauseStopDialog } from "@/components/deviceSession/PauseStopDialog";
import type { Appointment } from "@/types/domain.types";
import type { ProtocolDetail } from "@/types/treatmentProtocol.types";
import type { CognitiveActivity, ScaleDeliveryMode } from "@/types/deviceSession.types";

const DEVICE_FIT_ITEMS = [
  { code: "sponges_soaked", label: "Sponges saline-soaked" },
  { code: "placement_measured", label: "Anode/cathode placement measured against map" },
  { code: "headstrap_hair", label: "Headstrap secured, hair clear" },
  { code: "cable_routing", label: "Cable routing checked" },
  { code: "impedance_checked", label: "Impedance checked pre-ramp" },
  { code: "patient_briefed", label: "Patient briefed to report pain" },
];

const ACTIVITY_OPTIONS: { value: CognitiveActivity; label: string }[] = [
  { value: "sudoku", label: "Sudoku" },
  { value: "memory_game", label: "Memory card game" },
  { value: "word_recall", label: "Word recall" },
  { value: "reading_aloud", label: "Reading aloud" },
  { value: "breathing", label: "Breathing exercise" },
  { value: "sit_to_stand", label: "Sit-to-stand" },
  { value: "drawing", label: "Drawing" },
];

const RESCHEDULE_SLOTS = ["09:00", "09:45", "10:30", "11:15", "12:00", "14:30", "15:15"];

type SectionKey = "device-fit" | "symptoms" | "notes" | "adverse-events" | "activities" | "scales" | "feedback" | "media" | "next-session";

const SECTIONS: { key: SectionKey; label: string; icon: typeof Gauge }[] = [
  { key: "device-fit", label: "Device Fit & Impedance", icon: Gauge },
  { key: "symptoms", label: "Symptoms Observed", icon: Info },
  { key: "notes", label: "Clinical Notes", icon: FileText },
  { key: "adverse-events", label: "Adverse Events", icon: AlertTriangle },
  { key: "activities", label: "Cognitive Activities", icon: Dumbbell },
  { key: "scales", label: "Scales & Assessments", icon: ClipboardList },
  { key: "feedback", label: "Patient Feedback", icon: MessageSquare },
  { key: "media", label: "Media & Recordings", icon: Camera },
  { key: "next-session", label: "Next Session", icon: CalendarCheck },
];

export default function DeviceSessionLivePage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const router = useRouter();
  const { session, isLoading, reload, pause, resume, stop, complete, setDeviceFit, recordSymptom, recordAdverseEvent, addNote, recordActivity, setScaleDelivery, recordFeedback, confirmNextSession } =
    useDeviceSession(appointmentId);

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [protocol, setProtocol] = useState<ProtocolDetail | null>(null);
  const [activeSection, setActiveSection] = useState<SectionKey>("device-fit");
  const [pauseOpen, setPauseOpen] = useState(false);
  const [stopOpen, setStopOpen] = useState(false);
  const [showAeForm, setShowAeForm] = useState(false);

  // Section-local drafts
  const [deviceFitChecklist, setDeviceFitChecklist] = useState<Record<string, boolean>>({});
  const [impedance, setImpedance] = useState("");
  const [noteText, setNoteText] = useState("");
  const [activitySelection, setActivitySelection] = useState<CognitiveActivity[]>([]);
  const [activityFreeText, setActivityFreeText] = useState("");
  const [feedbackComfort, setFeedbackComfort] = useState<"comfortable" | "tolerable" | "uncomfortable" | null>(null);
  const [feedbackFeltAfter, setFeedbackFeltAfter] = useState<"better" | "no_change" | "worse" | null>(null);
  const [feedbackNextIntensity, setFeedbackNextIntensity] = useState<"decrease" | "keep_same" | "increase" | null>(null);
  const [feedbackQuote, setFeedbackQuote] = useState("");
  const [nextConfirmed, setNextConfirmed] = useState<boolean | null>(null);
  const [reschedOpen, setReschedOpen] = useState(false);
  const [reschedDate, setReschedDate] = useState("");
  const [reschedSlot, setReschedSlot] = useState("");
  const [reschedNote, setReschedNote] = useState("");

  useEffect(() => {
    if (!appointmentId) return;
    appointmentsService.getById(appointmentId).then(async (appt) => {
      setAppointment(appt);
      const protocolId = appt.protocol_id;
      if (protocolId) setProtocol(await treatmentProtocolService.getProtocolDetail(protocolId));
    });
  }, [appointmentId]);

  useEffect(() => {
    if (session?.device_fit_checklist) setDeviceFitChecklist(session.device_fit_checklist);
    if (session?.impedance_kohm != null) setImpedance(String(session.impedance_kohm));
  }, [session]);

  const prescribedDuration = protocol?.prescribed_duration_min ?? session?.actual_duration_min ?? 0;
  const rampSec = protocol?.ramp_seconds ?? 0;
  const totalSeconds = prescribedDuration * 60 + rampSec * 2;

  // Ticks once a second so `remaining` (and therefore canComplete's
  // timerDone gate below) actually reaches 0 in real time — CountdownTimer
  // has its own internal tick for the DISPLAY, but that's a separate
  // component's local state; this page's own `remaining` was a useMemo
  // that only recomputed on session/totalSeconds changes, so it stayed
  // frozen at whatever it was right after the last reload and "Mark as
  // Completed" could stay disabled forever even once the visible timer hit
  // 00:00.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (session?.session_status !== "in_progress") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [session?.session_status]);

  const remaining = useMemo(() => {
    if (!session) return totalSeconds;
    if (!session.started_at) return totalSeconds;
    if (session.session_status === "paused" && session.paused_at) {
      const elapsedMs = new Date(session.paused_at).getTime() - new Date(session.started_at).getTime();
      return Math.max(0, Math.round(totalSeconds - elapsedMs / 1000));
    }
    const elapsedMs = Date.now() - new Date(session.started_at).getTime();
    return Math.max(0, Math.round(totalSeconds - elapsedMs / 1000));
    // tick is a deliberate dependency, not read in the body — it forces
    // this memo to recompute every second while in_progress instead of
    // staying frozen at the value from the last session reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, totalSeconds, tick]);

  if (!appointment || isLoading || !session) return <PageLoader />;

  const impedanceTone = (() => {
    const v = Number(impedance);
    if (!impedance || isNaN(v)) return null;
    if (v < 5) return { label: "Good", tone: "text-success-600 bg-success-50 border-success-200" };
    if (v <= 10) return { label: "Acceptable", tone: "text-amber-700 bg-amber-50 border-amber-200" };
    return { label: "Too high — re-wet sponges or adjust strap", tone: "text-danger-700 bg-danger-50 border-danger-200" };
  })();

  const deviceFitDone = DEVICE_FIT_ITEMS.every((i) => deviceFitChecklist[i.code]);
  const scalesResolved = session.scales.every((s) => s.status !== "pending");
  const feedbackDone = !!session.feedback;
  const nextSessionDone = !!session.next_session_confirmation;
  const timerDone = remaining <= 0;
  // The backend FSM only allows completed from in_progress (not from
  // paused — see device_sessions/service.py _TRANSITIONS) — resume first
  // or the complete call 400s.
  const notPausedForComplete = session.session_status !== "paused";
  const canComplete = notPausedForComplete && timerDone && deviceFitDone && scalesResolved && feedbackDone && nextSessionDone;
  const missingGates = [
    !notPausedForComplete && "session is paused — resume before completing",
    !timerDone && "timer hasn't reached 0",
    !deviceFitDone && "device-fit checklist incomplete",
    !scalesResolved && "scales not yet resolved",
    !feedbackDone && "patient feedback not recorded",
    !nextSessionDone && "next session not confirmed",
  ].filter(Boolean) as string[];

  const handleSaveFeedback = async () => {
    if (!feedbackComfort || !feedbackFeltAfter || !feedbackNextIntensity) return;
    await recordFeedback({ comfort: feedbackComfort, felt_after: feedbackFeltAfter, next_intensity: feedbackNextIntensity }, feedbackQuote || undefined);
  };

  const nonMildAe = session.adverse_events.some((ae) => ae.severity !== "mild");

  return (
    <div className="flex h-[calc(100vh-4rem)] -mx-6 -mb-6">
      {/* Left rail */}
      <div className="w-64 flex-none border-r border-neutral-100 bg-white overflow-y-auto py-3">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const count =
            s.key === "symptoms" ? session.symptoms.length :
            s.key === "adverse-events" ? session.adverse_events.length :
            s.key === "notes" ? session.notes.length :
            s.key === "activities" ? session.activities.length :
            s.key === "scales" ? session.scales.filter((sc) => sc.status !== "pending").length :
            s.key === "media" ? session.media.length :
            undefined;
          return (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left transition-colors ${
                activeSection === s.key ? "bg-primary-50 text-primary-800 border-r-2 border-primary-500" : "text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1">{s.label}</span>
              {count !== undefined && count > 0 && <span className="text-xs text-neutral-400">{count}</span>}
            </button>
          );
        })}
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Sticky timer header */}
        <div className="bg-white border-b border-neutral-100 px-6 py-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-danger-500 animate-pulse" />
              <div>
                <p className="text-sm font-semibold text-neutral-900">{appointment.patient_name ?? "Patient"}</p>
                <p className="text-xs text-neutral-400">
                  {appointment.session_number ? `Session ${appointment.session_number}` : "Session"}
                  {protocol?.session_count ? ` of ${protocol.session_count}` : ""} · {protocol?.modality} · {protocol?.device_name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {session.session_status === "paused" ? (
                <Button variant="outline" size="sm" onClick={() => resume()}>Resume</Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setPauseOpen(true)}>
                  <Pause className="h-3.5 w-3.5" /> Pause
                </Button>
              )}
              <Button variant="danger" size="sm" onClick={() => setStopOpen(true)}>
                <Square className="h-3.5 w-3.5" /> Stop Session
              </Button>
              <Button
                size="sm"
                onClick={async () => {
                  if (!canComplete) return;
                  try {
                    await complete();
                    router.push(`/clinical-assistant/device-sessions/${appointmentId}/summary`);
                  } catch {
                    // Backend FSM rejected the transition (e.g. session was
                    // paused/stopped by a stale reload race) — reload picks
                    // up the real status instead of leaving a dead click.
                    await reload();
                  }
                }}
                disabled={!canComplete}
                title={missingGates.length ? `Still needed: ${missingGates.join(", ")}` : undefined}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Mark Session as Completed
              </Button>
            </div>
          </div>

          <CountdownTimer remainingSeconds={remaining} totalSeconds={totalSeconds} sessionStatus={session.session_status} />
          {missingGates.length > 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
              Still needed before completing: {missingGates.join(", ")}.
            </p>
          )}

          {session.session_status === "paused" && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
              Session paused — {session.pause_stop_reason?.replace(/_/g, " ")} · Timer is held.
            </div>
          )}
          {nonMildAe && (
            <div className="rounded-lg bg-danger-50 border border-danger-200 px-3 py-2 text-xs text-danger-800 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Non-mild adverse event recorded — consider pausing or stopping and notify the doctor.
            </div>
          )}
          <p className="text-xs text-neutral-400">This screen does not lock — the session keeps running if you leave.</p>
        </div>

        {/* Section content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto">
            {activeSection === "device-fit" && (
              <Card><CardContent className="space-y-3 pt-4">
                {DEVICE_FIT_ITEMS.map((item) => (
                  <label key={item.code} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!deviceFitChecklist[item.code]}
                      onChange={(e) => setDeviceFitChecklist((prev) => ({ ...prev, [item.code]: e.target.checked }))}
                      className="mt-0.5"
                    />
                    {item.label}
                  </label>
                ))}
                <Input label="Impedance reading (kΩ)" type="number" value={impedance} onChange={(e) => setImpedance(e.target.value)} />
                {impedanceTone && <span className={`inline-block text-xs px-2 py-1 rounded-full border ${impedanceTone.tone}`}>{impedanceTone.label}</span>}
                <Button size="sm" onClick={() => setDeviceFit(deviceFitChecklist, impedance ? Number(impedance) : undefined)}>Save</Button>
              </CardContent></Card>
            )}

            {activeSection === "symptoms" && (
              <div className="space-y-4">
                <Card><CardContent className="pt-4"><SymptomChipSelector onRecord={recordSymptom} /></CardContent></Card>
                {session.symptoms.length > 0 && (
                  <div className="space-y-2">
                    {session.symptoms.map((s) => (
                      <div key={s.symptom_record_id} className="text-sm border-b border-neutral-100 pb-2">
                        <span className="font-medium capitalize">{s.symptom.replace(/_/g, " ")}</span> — {s.severity}
                        {s.note && <span className="text-neutral-400"> · {s.note}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeSection === "notes" && (
              <div className="space-y-4">
                <Card><CardContent className="space-y-2 pt-4">
                  <Input placeholder="Add a note" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                  <Button size="sm" disabled={!noteText.trim()} onClick={async () => { await addNote(noteText.trim()); setNoteText(""); }}>Add note</Button>
                </CardContent></Card>
                {session.notes.map((n) => (
                  <div key={n.note_id} className="text-sm border-b border-neutral-100 pb-2">
                    <p className="text-neutral-800">{n.note_text}</p>
                    <p className="text-xs text-neutral-400">{new Date(n.recorded_at).toLocaleTimeString()}</p>
                  </div>
                ))}
              </div>
            )}

            {activeSection === "adverse-events" && (
              <div className="space-y-4">
                {showAeForm ? (
                  <AdverseEventForm onRecord={async (body) => { await recordAdverseEvent(body); setShowAeForm(false); }} onCancel={() => setShowAeForm(false)} />
                ) : (
                  <Button variant="danger" onClick={() => setShowAeForm(true)}>Record Adverse Event</Button>
                )}
                {session.adverse_events.map((ae) => (
                  <div key={ae.ae_record_id} className="text-sm border-b border-neutral-100 pb-2">
                    <span className="font-medium capitalize">{ae.event_type.replace(/_/g, " ")}</span> — {ae.severity}
                    <p className="text-neutral-500">{ae.description}</p>
                  </div>
                ))}
              </div>
            )}

            {activeSection === "activities" && (
              <Card><CardContent className="space-y-3 pt-4">
                <div className="flex flex-wrap gap-2">
                  {ACTIVITY_OPTIONS.map((a) => (
                    <button
                      key={a.value}
                      onClick={() => setActivitySelection((prev) => prev.includes(a.value) ? prev.filter((v) => v !== a.value) : [...prev, a.value])}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        activitySelection.includes(a.value) ? "bg-primary-100 border-primary-400 text-primary-800" : "bg-white border-neutral-200 text-neutral-600"
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
                <Input placeholder="Other activity (free text)" value={activityFreeText} onChange={(e) => setActivityFreeText(e.target.value)} />
                <Button
                  size="sm"
                  disabled={activitySelection.length === 0 && !activityFreeText}
                  onClick={async () => { await recordActivity(activitySelection, activityFreeText || undefined); setActivitySelection([]); setActivityFreeText(""); }}
                >
                  Log activities
                </Button>
              </CardContent></Card>
            )}

            {activeSection === "scales" && (
              <div className="space-y-3">
                {session.scales.length === 0 && <p className="text-sm text-neutral-400">No scales due this session.</p>}
                {session.scales.map((sc) => (
                  <Card key={sc.session_scale_id}><CardContent className="flex items-center justify-between pt-4">
                    <div>
                      <p className="text-sm font-medium">{sc.scale_name ?? sc.scale_code ?? sc.protocol_scale_id}</p>
                      <p className="text-xs text-neutral-400 capitalize">{sc.status.replace(/_/g, " ")}</p>
                    </div>
                    {sc.status === "pending" ? (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setScaleDelivery(sc.protocol_scale_id, "ca_administered" as ScaleDeliveryMode)}>Administer here</Button>
                        <Button size="sm" variant="outline" onClick={() => setScaleDelivery(sc.protocol_scale_id, "patient_app" as ScaleDeliveryMode)}>Send to patient app</Button>
                      </div>
                    ) : (
                      <span className="text-xs text-success-600">{sc.delivery_mode === "ca_administered" ? "Administered by CA" : "Sent to patient"}</span>
                    )}
                  </CardContent></Card>
                ))}
              </div>
            )}

            {activeSection === "feedback" && (
              <Card><CardContent className="space-y-4 pt-4">
                {session.feedback ? (
                  <p className="text-sm text-success-600">Feedback recorded.</p>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-neutral-500">Comfort with today&apos;s intensity</p>
                      <div className="flex gap-2">
                        {(["comfortable", "tolerable", "uncomfortable"] as const).map((v) => (
                          <button key={v} onClick={() => setFeedbackComfort(v)} className={`px-3 py-1.5 rounded-md text-xs border ${feedbackComfort === v ? "bg-primary-100 border-primary-400" : "border-neutral-200"}`}>{v}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-neutral-500">How does the patient feel after</p>
                      <div className="flex gap-2">
                        {(["better", "no_change", "worse"] as const).map((v) => (
                          <button key={v} onClick={() => setFeedbackFeltAfter(v)} className={`px-3 py-1.5 rounded-md text-xs border ${feedbackFeltAfter === v ? "bg-primary-100 border-primary-400" : "border-neutral-200"}`}>{v.replace("_", " ")}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-neutral-500">Intensity preference for next session</p>
                      <div className="flex gap-2">
                        {(["decrease", "keep_same", "increase"] as const).map((v) => (
                          <button key={v} onClick={() => setFeedbackNextIntensity(v)} className={`px-3 py-1.5 rounded-md text-xs border ${feedbackNextIntensity === v ? "bg-primary-100 border-primary-400" : "border-neutral-200"}`}>{v.replace("_", " ")}</button>
                        ))}
                      </div>
                    </div>
                    <Input placeholder="Patient's own words (optional)" value={feedbackQuote} onChange={(e) => setFeedbackQuote(e.target.value)} />
                    <Button size="sm" onClick={handleSaveFeedback} disabled={!feedbackComfort || !feedbackFeltAfter || !feedbackNextIntensity}>Save feedback</Button>
                  </>
                )}
              </CardContent></Card>
            )}

            {activeSection === "media" && (
              <Card><CardContent className="pt-4">
                <p className="text-sm text-neutral-500">Media capture requires recording consent, then attaching via the files module. Not yet wired to a live camera/upload — placeholder pending backend media storage.</p>
              </CardContent></Card>
            )}

            {activeSection === "next-session" && (
              <Card><CardContent className="space-y-3 pt-4">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900">Next Session — Soft Confirmation</h3>
                  <p className="text-xs text-neutral-400 mt-0.5">From the treatment protocol schedule. Confirm with the patient before they leave; changes go to the receptionist for final confirmation.</p>
                </div>
                {session.next_session_confirmation ? (
                  <p className="text-sm text-success-600">
                    {session.next_session_confirmation.patient_confirmed
                      ? "Next session confirmed by patient."
                      : `Change proposed: ${session.next_session_confirmation.requested_date ?? ""} ${session.next_session_confirmation.requested_slot ?? ""} — sent to receptionist for confirmation.${session.next_session_confirmation.note ? ` Note: ${session.next_session_confirmation.note}` : ""}`}
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-neutral-600">Ask the patient to confirm their next session slot.</p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={nextConfirmed === true ? "primary" : "outline"}
                        onClick={() => { setNextConfirmed(true); setReschedOpen(false); }}
                      >
                        Patient confirmed
                      </Button>
                      <Button
                        size="sm"
                        variant={nextConfirmed === false ? "primary" : "outline"}
                        onClick={() => { setNextConfirmed(false); setReschedOpen(true); }}
                      >
                        Needs change
                      </Button>
                    </div>

                    {nextConfirmed === true && (
                      <Button size="sm" onClick={() => confirmNextSession({ patient_confirmed: true })}>Save</Button>
                    )}

                    {reschedOpen && (
                      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3.5 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <Input label="Proposed date" type="date" value={reschedDate} onChange={(e) => setReschedDate(e.target.value)} />
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400 mb-1.5">Available slots (CA availability shown)</p>
                            <div className="flex flex-wrap gap-2">
                              {RESCHEDULE_SLOTS.map((slot) => (
                                <button
                                  key={slot}
                                  onClick={() => setReschedSlot(slot)}
                                  className={`px-3 py-1 rounded-full text-xs font-medium border tabular-nums transition-colors ${
                                    reschedSlot === slot ? "bg-primary-100 border-primary-400 text-primary-800" : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300"
                                  }`}
                                >
                                  {slot}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <Input
                          placeholder="Note for receptionist — e.g. patient travelling Tue, prefers Wed morning"
                          value={reschedNote}
                          onChange={(e) => setReschedNote(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={!reschedDate}
                            onClick={async () => {
                              await confirmNextSession({
                                patient_confirmed: false,
                                requested_date: reschedDate,
                                requested_slot: reschedSlot || undefined,
                                note: reschedNote || undefined,
                              });
                              setReschedOpen(false);
                            }}
                          >
                            Propose Change
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setReschedOpen(false); setNextConfirmed(null); }}>Cancel</Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent></Card>
            )}
          </div>
        </div>
      </div>

      <PauseStopDialog mode="pause" isOpen={pauseOpen} onClose={() => setPauseOpen(false)} onConfirm={async (r, d) => { await pause(r, d); setPauseOpen(false); }} />
      <PauseStopDialog
        mode="stop"
        isOpen={stopOpen}
        onClose={() => setStopOpen(false)}
        onConfirm={async (r, d) => { await stop(r, d); setStopOpen(false); router.push(`/clinical-assistant/device-sessions/${appointmentId}/summary`); }}
      />
    </div>
  );
}
