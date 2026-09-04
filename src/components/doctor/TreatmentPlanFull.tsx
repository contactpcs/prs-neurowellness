"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, Circle, AlertTriangle, ChevronDown, Pencil, FileText,
} from "lucide-react";
import { treatmentProtocolService } from "@/lib/api/services/treatmentProtocol.service";
import { doctorsService } from "@/lib/api/services/doctors.service";
import { eegService } from "@/lib/api/services/eeg.service";
import { appointmentsService } from "@/lib/api/services/appointments.service";
import { deviceSessionService } from "@/lib/api/services/deviceSession.service";
import type { ClinicalSessionTab } from "@/lib/hooks/usePatientClinicalSessions";
import type { ProtocolRead, ProtocolDetail } from "@/types/treatmentProtocol.types";
import type { AnamnesisRecord, Appointment, AssessmentInstance, PatientDetail } from "@/types/domain.types";
import type { DeviceSessionDetail } from "@/types/deviceSession.types";
import { loadTreatmentPlan, saveTreatmentPlan, type TreatmentPlanData } from "@/lib/utils/treatmentPlanStore";
import { deviceSessionLabel } from "@/lib/utils/deviceSessionStatus";

const DOCTOR_FALLBACK = "Treating doctor";

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
const show = (v: unknown) => (v === null || v === undefined || v === "" ? "Not recorded" : String(v));

// ─── small building blocks ──────────────────────────────────────────────────

function Card({ title, sub, right, children }: { title: string; sub?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border border-neutral-200 rounded-xl bg-white">
      <div className="flex items-start justify-between gap-3 flex-wrap px-4 py-3.5 border-b border-neutral-100">
        <div>
          <h3 className="text-sm font-bold text-neutral-900">{title}</h3>
          {sub && <p className="text-xs text-neutral-500 mt-0.5">{sub}</p>}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: React.ReactNode; strong?: boolean; tone?: string }) {
  return (
    <div className="flex justify-between gap-3 py-2 border-b border-neutral-100 last:border-0">
      <span className="text-xs text-neutral-500">{label}</span>
      <span className={`text-[12.5px] text-right ${strong ? "font-bold" : "font-semibold"}`} style={tone ? { color: tone } : undefined}>{value}</span>
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide mb-1.5">{children}</p>;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="text-xs font-semibold text-neutral-700 block mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-neutral-400 mt-1">{hint}</p>}
    </div>
  );
}

const inputCls = "w-full h-9 border border-neutral-200 rounded-md px-2.5 text-sm bg-white outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-100";
const textareaCls = "w-full border border-neutral-200 rounded-md p-2.5 text-sm bg-white outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-100 resize-y";

function Pill({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${className}`}>{children}</span>;
}

function Fold({ title, summary, children, defaultOpen }: { title: string; summary: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="border border-neutral-200 rounded-lg bg-white">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
        <div className="min-w-0">
          <span className="text-[13px] font-bold text-neutral-900">{title}</span>
          <p className="text-[11.5px] text-neutral-500 mt-0.5 truncate">{summary}</p>
        </div>
        <ChevronDown className={`w-4 h-4 text-neutral-400 flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

function KV({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <div className="grid gap-x-4" style={{ gridTemplateColumns: "minmax(140px,190px) 1fr" }}>
      {rows.map(([k, v], i) => (
        <div key={k + i} className="contents">
          <span className={`text-xs text-neutral-500 py-2 ${i ? "border-t border-neutral-100" : ""}`}>{k}</span>
          <span className={`text-[12.5px] text-neutral-800 py-2 leading-relaxed ${i ? "border-t border-neutral-100" : ""}`}>{v}</span>
        </div>
      ))}
    </div>
  );
}

function Table({ cols, rows, empty }: { cols: string[]; rows: React.ReactNode[][]; empty: string }) {
  if (!rows.length) return <p className="text-[12.5px] text-neutral-400 py-4 text-center">{empty}</p>;
  return (
    <div className="border border-neutral-200 rounded-lg overflow-x-auto">
      <div style={{ minWidth: cols.length * 105 }}>
        <div className="grid gap-2.5 px-3.5 py-2 bg-neutral-50 border-b border-neutral-200" style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)` }}>
          {cols.map((c) => <span key={c} className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">{c}</span>)}
        </div>
        {rows.map((r, i) => (
          <div key={i} className={`grid gap-2.5 items-center px-3.5 py-2.5 ${i < rows.length - 1 ? "border-b border-neutral-100" : ""}`} style={{ gridTemplateColumns: `repeat(${cols.length}, 1fr)` }}>
            {r.map((c, j) => <span key={j} className={`text-xs ${j ? "text-neutral-700" : "text-neutral-900 font-semibold"}`}>{c}</span>)}
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className={`rounded-lg border border-neutral-100 px-3.5 py-3 ${tone ?? "bg-neutral-50"}`}>
      <p className="text-[10.5px] font-semibold text-neutral-500 uppercase tracking-wide">{label}</p>
      <p className="text-[15px] font-bold text-neutral-900 mt-1 leading-tight">{value}</p>
      {sub && <p className="text-[11px] text-neutral-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function defaultPlan(active: ProtocolRead | null): TreatmentPlanData {
  return {
    status: "draft",
    setBy: null,
    setAt: null,
    goal: "",
    totalSessions: active?.session_count ?? 20,
    perWeek: active?.sessions_per_week ?? 5,
    reviewEvery: 4,
    nextReview: "—",
    medicationPlan: "",
    caInstructions: "",
    notes: "",
    log: [],
  };
}

// ─── main ────────────────────────────────────────────────────────────────

export function TreatmentPlanFull({
  patientId, patient, doctorName, clinicalSessions, sessionLocked, doctorNoteText, onNavigateSection, onGenerateFinalReport,
}: {
  patientId: string;
  patient: PatientDetail | null;
  doctorName?: string | null;
  clinicalSessions: ClinicalSessionTab[];
  sessionLocked: boolean;
  doctorNoteText: string | null;
  onNavigateSection: (id: string) => void;
  onGenerateFinalReport: () => void;
}) {
  const doctor = doctorName || DOCTOR_FALLBACK;
  const [isLoading, setIsLoading] = useState(true);
  const [protocols, setProtocols] = useState<ProtocolRead[]>([]);
  const [activeDetail, setActiveDetail] = useState<ProtocolDetail | null>(null);
  const [anamnesis, setAnamnesis] = useState<AnamnesisRecord | null>(null);
  const [prsByVisit, setPrsByVisit] = useState<Record<string, AssessmentInstance[]>>({});
  const [eegReports, setEegReports] = useState<{ id: string; report_name: string; created_at: string }[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [deviceSessionsById, setDeviceSessionsById] = useState<Record<string, DeviceSessionDetail>>({});
  const [edit, setEdit] = useState(false);

  const active = protocols.find((p) => p.status === "active") ?? protocols[protocols.length - 1] ?? null;
  const [plan, setPlan] = useState<TreatmentPlanData>(() => defaultPlan(null));
  const [form, setForm] = useState<TreatmentPlanData>(plan);
  useEffect(() => setForm(plan), [plan]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      const list = await treatmentProtocolService.listProtocols({ patientId }).catch(() => [] as ProtocolRead[]);
      if (cancelled) return;
      setProtocols(list.slice().sort((a, b) => (a.created_at ?? "").localeCompare(b.created_at ?? "")));
      const act = list.find((p) => p.status === "active") ?? list[list.length - 1] ?? null;

      const [detail, latestAnamnesis, eeg, apptRes] = await Promise.all([
        act ? treatmentProtocolService.getProtocolDetail(act.protocol_id).catch(() => null) : Promise.resolve(null),
        doctorsService.getVisitSummary(patientId, clinicalSessions[clinicalSessions.length - 1]?.appointment.appointment_id ?? "").then((s) => s.anamnesis).catch(() => null),
        eegService.getPatientReports(patientId).catch(() => ({ data: [] as { id: string; report_name: string; created_at: string }[] })),
        appointmentsService.list({ limit: 200 }).catch(() => ({ appointments: [] as Appointment[], total: 0 })),
      ]);
      if (cancelled) return;
      setActiveDetail(detail);
      setAnamnesis(latestAnamnesis ?? null);
      setEegReports(eeg.data ?? []);
      setAppointments(apptRes.appointments.filter((a) => (a.patient_public_id ?? a.patient_id) === patientId));
      setPlan(act ? loadTreatmentPlan(act.protocol_id, defaultPlan(act)) : defaultPlan(null));

      // Per-visit PRS instances, from the real visit-summary endpoint — one
      // request per clinical session (Consultation/Follow-up/Protocol
      // Follow-up only; small, bounded list).
      const prsEntries = await Promise.all(
        clinicalSessions.map(async (s) => {
          try {
            const summary = await doctorsService.getVisitSummary(patientId, s.appointment.appointment_id);
            return [s.appointment.appointment_id, (summary.prs_instances ?? []) as unknown as AssessmentInstance[]] as const;
          } catch {
            return [s.appointment.appointment_id, [] as AssessmentInstance[]] as const;
          }
        }),
      );
      if (cancelled) return;
      setPrsByVisit(Object.fromEntries(prsEntries));

      // Tolerance/adverse-event tally from real device session records —
      // only for sessions that actually ran.
      const deviceApptIds = (detail?.sessions ?? [])
        .filter((s) => ["completed", "in_progress"].includes(s.status))
        .map((s) => s.appointment_id);
      const deviceEntries = await Promise.all(
        deviceApptIds.map(async (id) => {
          try { return [id, await deviceSessionService.get(id)] as const; } catch { return null; }
        }),
      );
      if (cancelled) return;
      setDeviceSessionsById(Object.fromEntries(deviceEntries.filter((e): e is [string, DeviceSessionDetail] => e !== null)));

      setIsLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId]);

  const versionNumber = (p: ProtocolRead) => protocols.findIndex((x) => x.protocol_id === p.protocol_id) + 1;

  // ── PRS scale grid: one row per scale name, one column per clinical session ──
  const scaleGrid = useMemo(() => {
    const names: string[] = [];
    Object.values(prsByVisit).forEach((instances) =>
      instances.forEach((inst) => (inst.scale_summaries ?? []).forEach((sc) => {
        const n = sc.scale_name ?? sc.scale_code ?? "Scale";
        if (!names.includes(n)) names.push(n);
      })),
    );
    return names.map((name) => {
      const points = clinicalSessions.map((s) => {
        const instances = prsByVisit[s.appointment.appointment_id] ?? [];
        let hit: { calculated_value?: number; max_possible?: number; severity_label?: string } | undefined;
        instances.forEach((inst) => (inst.scale_summaries ?? []).forEach((sc) => { if ((sc.scale_name ?? sc.scale_code) === name) hit = sc; }));
        return { session: s, value: hit?.calculated_value ?? null, max: hit?.max_possible ?? null, severity: hit?.severity_label ?? null };
      });
      const recorded = points.filter((p) => p.value != null);
      const first = recorded[0] ?? null;
      const last = recorded[recorded.length - 1] ?? null;
      const delta = first && last && recorded.length > 1 ? Math.round(((last.value as number) - (first.value as number)) * 10) / 10 : null;
      return { name, points, first, last, delta };
    });
  }, [prsByVisit, clinicalSessions]);

  const protocolSessions = activeDetail?.sessions ?? [];
  const completedSessions = protocolSessions.filter((s) => s.status === "completed");
  const missedSessions = protocolSessions.filter((s) => s.status === "no_show");
  const completed = completedSessions.length;
  const planned = Number(plan.totalSessions) || active?.session_count || 0;
  const remaining = Math.max(0, planned - completed);
  const pct = planned ? Math.round((completed / planned) * 100) : 0;

  const deviceRecords = Object.values(deviceSessionsById);
  const tolerated = deviceRecords.filter((d) => d.feedback?.answers.comfort === "comfortable" || d.feedback?.answers.felt_after === "better").length;
  const withAdverseEvent = deviceRecords.filter((d) => d.adverse_events.length > 0).length;
  const stoppedEarly = deviceRecords.filter((d) => d.session_status === "stopped_early").length;

  const latestScoreRow = scaleGrid[0]?.last ?? null;

  const checks = useMemo(() => ([
    { key: "Anamnesis recorded", ok: !!anamnesis, detail: anamnesis ? `Recorded ${fmtDate(anamnesis.completed_at)}` : "Not recorded", go: "anamnesis" },
    { key: "Baseline PRS on file", ok: scaleGrid.some((s) => s.first), detail: scaleGrid.length ? scaleGrid.map((s) => s.first ? `${s.name} ${s.first.value}/${s.first.max}` : null).filter(Boolean).join(" · ") || "No baseline scores" : "No baseline scores", go: "prs" },
    { key: "Brain mapping reviewed", ok: eegReports.length > 0, detail: eegReports.length ? `${eegReports.length} report${eegReports.length === 1 ? "" : "s"} on file` : "No EEG report", go: "brain-mapping" },
    { key: "Active protocol assigned", ok: !!active, detail: active ? `${active.device_name || active.modality || "Protocol"} v${versionNumber(active)}` : "No protocol assigned", go: "treatment-protocol" },
  ]), [anamnesis, scaleGrid, eegReports, active]); // eslint-disable-line react-hooks/exhaustive-deps
  const blocking = checks.filter((c) => !c.ok);
  const isSet = plan.status === "set";

  const set = <K extends keyof TreatmentPlanData>(k: K, v: TreatmentPlanData[K]) => setForm((f) => ({ ...f, [k]: v }));

  const persist = (next: TreatmentPlanData) => {
    setPlan(next);
    if (active) saveTreatmentPlan(active.protocol_id, next);
  };
  const saveDraft = () => { persist({ ...plan, ...form }); setEdit(false); };
  const finalise = () => {
    const n = (plan.log?.length ?? 0) + 1;
    const nowIso = new Date().toISOString();
    const entry = {
      n, status: "In effect" as const, at: fmtDateTime(nowIso), by: doctor,
      assessmentLabel: clinicalSessions[clinicalSessions.length - 1]?.label ?? "—",
      lines: [
        active ? `${active.device_name || active.modality || "Protocol"} v${versionNumber(active)} · ${active.prescribed_current_ma ?? "—"} mA · ${active.prescribed_duration_min ?? "—"} min` : "",
        `${form.totalSessions} sessions · ${form.perWeek}/week · review every ${form.reviewEvery} sessions`,
        form.goal,
      ].filter(Boolean),
    };
    persist({
      ...plan, ...form, status: "set", setBy: doctor, setAt: fmtDateTime(nowIso),
      log: [entry, ...(plan.log ?? []).map((e) => ({ ...e, status: "Superseded" as const }))],
    });
    setEdit(false);
  };
  const reopen = () => persist({ ...plan, status: "draft", setBy: null, setAt: null });

  if (isLoading) return <p className="text-sm text-neutral-400 px-2">Loading…</p>;

  if (!active) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900">Treatment Plan</h2>
          <p className="text-sm text-neutral-500 mt-1">Forward course of treatment for {patient?.full_name ?? "this patient"}.</p>
        </div>
        <div className="border border-dashed border-neutral-300 rounded-xl px-6 py-14 text-center">
          <p className="text-sm font-semibold text-neutral-700">No treatment plan yet</p>
          <p className="text-xs text-neutral-400 mt-1.5 max-w-md mx-auto">
            A plan is built on an active treatment protocol. Assign one first — the plan then pulls its device, montage, dosing and schedule from it.
          </p>
          <button onClick={() => onNavigateSection("treatment-protocol")} className="mt-4 h-9 px-4 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-700 hover:bg-neutral-50">
            Go to Treatment Protocol
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sessionLocked && (
        <div className="flex items-center gap-2 bg-neutral-100 border border-neutral-200 rounded-lg px-4 py-2.5 text-xs text-neutral-600">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 text-neutral-400" />
          Viewing a frozen session — the Treatment Plan below is read-only from here.
        </div>
      )}

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-bold text-neutral-900">Treatment Plan</h2>
            {isSet ? <Pill className="bg-green-50 text-green-700">Plan set</Pill> : <Pill className="bg-amber-50 text-amber-700">Draft — not finalised</Pill>}
          </div>
          <p className="text-sm text-neutral-600 mt-1 max-w-2xl">
            Forward course prescribed for {patient?.full_name ?? "this patient"}. {isSet ? `Set by ${plan.setBy} on ${plan.setAt}.` : "Review the plan below, edit where needed, then finalise."}
          </p>
        </div>
        {!sessionLocked && (
          <div className="flex gap-2 flex-wrap">
            {edit ? (
              <>
                <button onClick={saveDraft} className="h-9 px-4 rounded-lg bg-brand-gradient text-white text-xs font-semibold">Save Changes</button>
                <button onClick={() => { setForm(plan); setEdit(false); }} className="h-9 px-3.5 rounded-lg border border-neutral-300 bg-white text-xs font-medium text-neutral-600">Cancel</button>
              </>
            ) : isSet ? (
              <>
                <button onClick={reopen} className="h-9 px-3.5 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-700">Reopen for Edit</button>
                <button onClick={onGenerateFinalReport} className="h-9 px-4 rounded-lg bg-action-orange text-white text-xs font-semibold">Convert to Final Report</button>
              </>
            ) : (
              <>
                <button onClick={() => setEdit(true)} className="h-9 px-3.5 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-700">Edit Plan</button>
                <button
                  disabled={blocking.length > 0}
                  onClick={finalise}
                  className={`h-9 px-4 rounded-lg text-xs font-semibold ${blocking.length ? "bg-neutral-200 text-neutral-400 cursor-not-allowed" : "bg-brand-gradient text-white"}`}
                >
                  Finalise Treatment Plan
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(168px, 1fr))" }}>
        <Stat label="Diagnosis" value={active.notes ? active.notes.split("—")[0].replace(/^Reason:\s*/, "").trim() || "—" : "—"} />
        <Stat label="Prescribed protocol" value={`${active.modality || "Protocol"} · v${versionNumber(active)}`} sub={active.device_name ?? undefined} />
        <Stat label="Progress" value={`${completed} / ${planned}`} sub={`${pct}% · ${remaining} remaining`} tone="bg-primary-50" />
        <Stat label="Next review" value={String(plan.nextReview || "—")} sub={`Every ${plan.reviewEvery} sessions`} />
        <Stat
          label="Latest PRS"
          value={latestScoreRow ? `${scaleGrid[0].name} ${latestScoreRow.value}/${latestScoreRow.max}` : "Not recorded"}
          sub={latestScoreRow ? show(latestScoreRow.severity) : "No scale scores"}
          tone={scaleGrid[0]?.delta != null && scaleGrid[0].delta < 0 ? "bg-green-50" : undefined}
        />
      </div>

      {!isSet && (
        <div className={`border rounded-lg px-4 py-3.5 ${blocking.length ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"}`}>
          <div className="flex gap-2.5 items-start">
            {blocking.length ? <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" /> : <CheckCircle2 className="w-4 h-4 text-green-700 flex-shrink-0 mt-0.5" />}
            <div className="min-w-0 flex-1">
              <p className={`text-[12.5px] font-bold ${blocking.length ? "text-amber-800" : "text-green-700"}`}>
                {blocking.length ? `${blocking.length} item${blocking.length === 1 ? "" : "s"} still to record before this plan can be finalised` : "All clinical inputs recorded — plan is ready to finalise"}
              </p>
              <div className="flex gap-x-3.5 gap-y-1.5 flex-wrap mt-2">
                {checks.map((c) => (
                  <button key={c.key} onClick={() => onNavigateSection(c.go)} className="flex items-center gap-1.5 text-left">
                    {c.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-green-700 flex-shrink-0" /> : <Circle className="w-3.5 h-3.5 text-amber-700 flex-shrink-0" />}
                    <span className="text-[11.5px] text-neutral-700">{c.key} — <span className="text-neutral-500">{c.detail}</span></span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <Card
        title="Prescribed plan"
        sub="What the clinical assistants deliver from here. Device, montage and dosing are governed by the active protocol."
        right={
          <div className="flex items-center gap-2 flex-wrap">
            <Pill className="bg-primary-100 text-primary-700">{active.modality || "Protocol"} v{versionNumber(active)}</Pill>
            <button onClick={() => onNavigateSection("treatment-protocol")} className="h-8 px-3 rounded-lg border border-neutral-300 bg-white text-[11.5px] font-semibold text-neutral-700">Modify protocol</button>
          </div>
        }
      >
        <div className="grid gap-x-6 gap-y-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          <div>
            <GroupLabel>Device &amp; stimulation</GroupLabel>
            <Row label="Device / modality" value={active.device_name || active.modality || "—"} />
            <Row label="Placement" value={active.placement_summary || "—"} />
            <Row label="Current intensity" value={active.prescribed_current_ma != null ? `${active.prescribed_current_ma} mA` : "—"} strong />
            <Row label="Session duration" value={active.prescribed_duration_min != null ? `${active.prescribed_duration_min} min` : "—"} />
            <Row label="Ramp up / down" value={active.ramp_seconds != null ? `${active.ramp_seconds} sec` : "—"} />
          </div>
          <div>
            <GroupLabel>Schedule &amp; sessions</GroupLabel>
            <Row label="Sessions per week" value={`${plan.perWeek} / week`} />
            <Row label="Total planned sessions" value={planned} />
            <Row label="Completed" value={`${completed} (${pct}%)`} tone="#15803d" />
            <Row label="Remaining" value={remaining} />
            <Row label="Missed to date" value={missedSessions.length} tone={missedSessions.length ? "#b91c1c" : undefined} />
            <Row label="Follow-ups" value={active.follow_up_every_n ? `Every ${active.follow_up_every_n} sessions` : "None scheduled"} />
          </div>
          <div>
            <GroupLabel>Review &amp; assessment</GroupLabel>
            <Row label="Reassess every" value={`${plan.reviewEvery} sessions`} />
            <Row label="Next review" value={String(plan.nextReview || "—")} />
            <Row label="Protocol versions" value={`${protocols.length} (${Math.max(0, protocols.length - 1)} change${protocols.length - 1 === 1 ? "" : "s"})`} />
            <Row label="Clinic" value={patient?.clinic_name || "—"} />
            <Row label="Treating doctor" value={doctor} />
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-neutral-100">
          {edit ? (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <Field label="Treatment goal"><input value={form.goal} onChange={(e) => set("goal", e.target.value)} className={inputCls} /></Field>
              <Field label="Total planned sessions" hint="Changing dosing or montage requires a protocol version — use Modify protocol.">
                <input type="number" min={1} value={form.totalSessions} onChange={(e) => set("totalSessions", e.target.value)} className={inputCls} />
              </Field>
              <Field label="Sessions per week"><input type="number" min={1} max={7} value={form.perWeek} onChange={(e) => set("perWeek", e.target.value)} className={inputCls} /></Field>
              <Field label="Reassess every (sessions)"><input type="number" min={1} value={form.reviewEvery} onChange={(e) => set("reviewEvery", e.target.value)} className={inputCls} /></Field>
              <Field label="Next review point"><input value={form.nextReview} onChange={(e) => set("nextReview", e.target.value)} className={inputCls} /></Field>
              <div className="col-span-full"><Field label="Medication plan" hint="No medication-tracking module exists yet — this is a free-text note only."><textarea value={form.medicationPlan} onChange={(e) => set("medicationPlan", e.target.value)} rows={2} className={textareaCls} /></Field></div>
              <div className="col-span-full"><Field label="Instructions for clinical assistants"><textarea value={form.caInstructions} onChange={(e) => set("caInstructions", e.target.value)} rows={3} className={textareaCls} /></Field></div>
              <div className="col-span-full"><Field label="Plan notes (optional)"><textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="Anything else the team should know…" className={textareaCls} /></Field></div>
            </div>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
              <div><GroupLabel>Treatment goal</GroupLabel><p className="text-[13px] text-neutral-800 leading-relaxed">{show(plan.goal)}</p></div>
              <div><GroupLabel>Medication plan</GroupLabel><p className="text-[13px] text-neutral-800 leading-relaxed">{show(plan.medicationPlan)}</p></div>
              <div className="col-span-full"><GroupLabel>Instructions for clinical assistants</GroupLabel><p className="text-[13px] text-neutral-800 leading-relaxed">{show(plan.caInstructions)}</p></div>
              {plan.notes && <div className="col-span-full"><GroupLabel>Plan notes</GroupLabel><p className="text-[13px] text-neutral-800 leading-relaxed">{plan.notes}</p></div>}
            </div>
          )}
        </div>
      </Card>

      <Card title="Improvement to date" sub="Evidence the plan is working — patient-reported scales across assessments and tolerance across delivered sessions.">
        <GroupLabel>PRS scale scores by session</GroupLabel>
        {scaleGrid.length ? (
          <div className="border border-neutral-200 rounded-lg overflow-x-auto mb-5">
            <div style={{ minWidth: 150 + clinicalSessions.length * 130 }}>
              <div className="grid gap-2.5 px-3.5 py-2 bg-neutral-50 border-b border-neutral-200" style={{ gridTemplateColumns: `150px repeat(${clinicalSessions.length}, 1fr) 110px` }}>
                {["Scale", ...clinicalSessions.map((s) => s.label), "Change"].map((c, i) => <span key={c + i} className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">{c}</span>)}
              </div>
              {scaleGrid.map((s, i) => (
                <div key={s.name} className={`grid gap-2.5 px-3.5 py-2.5 items-start ${i < scaleGrid.length - 1 ? "border-b border-neutral-100" : ""}`} style={{ gridTemplateColumns: `150px repeat(${clinicalSessions.length}, 1fr) 110px` }}>
                  <p className="text-xs font-bold text-neutral-900">{s.name}</p>
                  {s.points.map((pt, j) => (
                    <div key={j}>
                      {pt.value == null ? (
                        <p className="text-xs text-neutral-400">Not recorded</p>
                      ) : (
                        <>
                          <p className="text-[13px] font-bold text-neutral-900">{pt.value}<span className="text-[11px] font-normal text-neutral-400"> / {pt.max}</span></p>
                          <p className="text-[10.5px] text-neutral-500 mt-0.5">{show(pt.severity)}</p>
                        </>
                      )}
                    </div>
                  ))}
                  <div>
                    {s.delta == null ? (
                      <p className="text-xs text-neutral-400">Not comparable</p>
                    ) : (
                      <p className={`text-[12.5px] font-bold ${s.delta < 0 ? "text-green-700" : s.delta > 0 ? "text-red-700" : "text-neutral-600"}`}>
                        {s.delta > 0 ? "+" : ""}{s.delta} pts
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-[12.5px] text-neutral-400 mb-5">No PRS scale scores recorded yet — scores appear here once an assessment records them.</p>
        )}

        <GroupLabel>Tolerance across delivered device sessions</GroupLabel>
        <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
          <Row label="Sessions delivered" value={completed} />
          <Row label="Reported well tolerated" value={deviceRecords.length ? `${tolerated} of ${deviceRecords.length}` : "Not recorded"} />
          <Row label="Sessions with an adverse event" value={withAdverseEvent} tone={withAdverseEvent ? "#b45309" : undefined} />
          <Row label="Stopped early" value={stoppedEarly} />
          <Row label="Missed" value={missedSessions.length} tone={missedSessions.length ? "#b91c1c" : undefined} />
        </div>
        <button onClick={() => onNavigateSection("sessions")} className="mt-3 h-8 px-3 rounded-lg border border-neutral-300 bg-white text-[11.5px] font-semibold text-neutral-700">Open session log</button>
      </Card>

      <div>
        <h3 className="text-sm font-bold text-neutral-900 mb-1">Clinical basis</h3>
        <p className="text-xs text-neutral-500 mb-3">Everything the plan rests on, pulled from the patient&apos;s own record. Open only what you need.</p>
        <div className="flex flex-col gap-2">
          <Fold title="Patient profile &amp; diagnosis" summary={`${patient?.full_name ?? "—"} · ${patient?.mrn ?? "—"} · ${patient?.age ?? "—"} yrs, ${patient?.gender ?? "—"}`}>
            <KV rows={[
              ["Patient", `${patient?.full_name ?? "—"} · ${patient?.mrn ?? "—"}`],
              ["Age / gender", `${patient?.age ?? "—"} yrs · ${patient?.gender ?? "—"}`],
              ["Clinic", patient?.clinic_name || "—"],
              ["Status", patient?.status || "—"],
            ]} />
          </Fold>

          <Fold title="Anamnesis" summary={anamnesis ? `Recorded ${fmtDate(anamnesis.completed_at)}` : "Not recorded"}>
            {anamnesis ? (
              <KV rows={[
                ["Chief complaint", show(anamnesis.chief_complaint)],
                ["Main symptoms", show(anamnesis.main_symptoms)],
                ["Symptom duration", show(anamnesis.symptoms_duration)],
                ["Previous treatments", show(anamnesis.previous_treatments)],
                ["Current medications", show(anamnesis.current_medications)],
              ]} />
            ) : <p className="text-[12.5px] text-neutral-400">No anamnesis recorded.</p>}
          </Fold>

          <Fold title="Medication" summary="No medication-tracking module in this system yet">
            <p className="text-[12.5px] text-neutral-400">Structured medication history isn&apos;t tracked by this system — see the free-text Medication Plan above.</p>
          </Fold>

          <Fold title="Brain mapping &amp; EEG" summary={eegReports.length ? `${eegReports.length} report${eegReports.length === 1 ? "" : "s"} on file` : "No reports on file"}>
            <Table cols={["Report", "Date"]} rows={eegReports.map((r) => [r.report_name, fmtDate(r.created_at)])} empty="No EEG or connectivity reports on file." />
          </Fold>

          <Fold title="Protocols undergone" summary={protocols.length === 1 ? "1 version" : `${protocols.length} versions · ${protocols.length - 1} change${protocols.length - 1 === 1 ? "" : "s"}`}>
            <Table
              cols={["Version", "Status", "Current", "Duration", "Created"]}
              rows={protocols.map((p) => [`v${versionNumber(p)}`, p.status, p.prescribed_current_ma != null ? `${p.prescribed_current_ma} mA` : "—", p.prescribed_duration_min != null ? `${p.prescribed_duration_min} min` : "—", fmtDate(p.created_at)])}
              empty="No protocol history."
            />
            <p className="text-[11.5px] text-neutral-400 mt-3 leading-relaxed">Completed sessions keep the parameters delivered at the time — a newer version never rewrites them.</p>
          </Fold>

          <Fold title="Device session history" summary={`${completed} delivered · ${missedSessions.length} missed · ${remaining} upcoming`}>
            <Table
              cols={["#", "Date", "Status"]}
              rows={protocolSessions.map((s) => [s.session_number != null ? `#${s.session_number}` : "—", fmtDate(s.appointment_date), deviceSessionLabel(s.status)])}
              empty="No sessions scheduled."
            />
          </Fold>

          <Fold title="Appointment history" summary={appointments.length ? `${appointments.length} appointment${appointments.length === 1 ? "" : "s"} on record` : "No appointments on record"}>
            <Table
              cols={["Date", "Time", "Type", "Status"]}
              rows={appointments
                .slice()
                .sort((a, b) => (b.appointment_date + b.start_time).localeCompare(a.appointment_date + a.start_time))
                .map((a) => [fmtDate(a.appointment_date), a.start_time?.slice(0, 5) || "—", a.appointment_type.replace(/_/g, " "), a.status.replace(/_/g, " ")])}
              empty="No appointments recorded for this patient."
            />
          </Fold>

          <Fold title="Doctor's notes" summary={doctorNoteText ? "Recorded" : "Not recorded"}>
            {doctorNoteText ? <p className="text-[12.5px] text-neutral-800 leading-relaxed whitespace-pre-wrap">{doctorNoteText}</p> : <p className="text-[12.5px] text-neutral-400">No doctor&apos;s notes recorded.</p>}
          </Fold>
        </div>
      </div>

      <Card title="Plan log" sub="Every plan set against this patient, newest first. Setting a new plan supersedes the previous one — it is never overwritten.">
        {plan.log?.length ? (
          <div className="flex flex-col gap-2.5">
            {plan.log.map((e) => (
              <div key={e.n} className={`border border-neutral-200 rounded-lg px-4 py-3 ${e.status === "In effect" ? "border-l-[3px] border-l-primary-500" : "border-l-[3px] border-l-neutral-300"}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-bold text-neutral-900">Plan {e.n}</span>
                  <Pill className={e.status === "In effect" ? "bg-green-50 text-green-700" : "bg-neutral-100 text-neutral-600"}>{e.status}</Pill>
                  <span className="text-[11.5px] text-neutral-500">Set at {e.assessmentLabel} · {e.at} · {e.by}</span>
                </div>
                <div className="mt-1.5 flex flex-col gap-0.5">
                  {e.lines.map((l, i) => <p key={i} className="text-[12.5px] text-neutral-700">{l}</p>)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[12.5px] text-neutral-400">No plan has been finalised yet. Finalising the plan above records the first entry here.</p>
        )}
        <div className="mt-4 pt-3.5 border-t border-neutral-100 flex justify-between gap-3 flex-wrap items-center">
          <p className="text-xs text-neutral-500 max-w-lg leading-relaxed">Once the course completes, the set plan converts into the Final Report.</p>
          <button onClick={onGenerateFinalReport} className="h-8 px-3 rounded-lg border border-neutral-300 bg-white text-[11.5px] font-semibold text-neutral-700 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Go to Final Report
          </button>
        </div>
      </Card>

      <p className="text-[11px] text-neutral-400 flex items-center gap-1.5">
        <Pencil className="w-3 h-3" /> The plan fields and log above are saved to this browser only — there is no backend record for a Treatment Plan yet. See CLINICAL_SESSION_BACKEND_CHANGES.md.
      </p>
    </div>
  );
}
