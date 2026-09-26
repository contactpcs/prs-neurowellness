"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useDoctorPatient, usePatientScoresSummary, usePatientNote } from "@/lib/hooks";
import { anamnesisService, type AnamnesisQuestion } from "@/lib/api/services/anamnesis.service";
import { eegService } from "@/lib/api/services/eeg.service";
import { treatmentProtocolService } from "@/lib/api/services/treatmentProtocol.service";
import type { AnamnesisRecord } from "@/types/domain.types";
import type { EEGReport } from "@/types/eeg.types";
import type { ProtocolRead } from "@/types/treatmentProtocol.types";

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
const show = (v: unknown) => (v === null || v === undefined || v === "" ? "Not recorded" : String(v));

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-neutral-200 rounded-lg bg-white p-3.5">
      <p className="text-[10px] font-bold text-primary-700 uppercase tracking-wide mb-2">{title}</p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2 text-xs">
      <span className="text-neutral-400 flex-shrink-0">{label}</span>
      <span className="text-neutral-800 text-right">{value}</span>
    </div>
  );
}

/** Patient clinical snapshot for the doctor screens that prescribe treatment
 * (Treatment Protocol wizard, protocol detail) — demographics, anamnesis,
 * history, PRS scores, EEG, doctor's notes, and prior protocols at a glance,
 * so the doctor doesn't have to leave the wizard to check the chart.
 * Collapsible. Fields with no backing data model (vitals — BP/HR/weight/
 * handedness; structured medication list) show "Not tracked" rather than
 * being fabricated. */
export function PatientClinicalSnapshot({ patientId }: { patientId: string }) {
  const { patient } = useDoctorPatient(patientId);
  const { instances: scoreInstances } = usePatientScoresSummary(patientId);
  const { note: doctorNote } = usePatientNote(patientId);
  const [anamnesis, setAnamnesis] = useState<AnamnesisRecord | null>(null);
  const [anamnesisQuestions, setAnamnesisQuestions] = useState<AnamnesisQuestion[]>([]);
  const [eegReports, setEegReports] = useState<EEGReport[]>([]);
  const [protocols, setProtocols] = useState<ProtocolRead[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    // Prefer the "main" (treatment-visit) anamnesis, since that's the one a
    // doctor is about to prescribe against, but fall back to "registration"
    // — a patient who hasn't reached main_clinical yet still has real
    // anamnesis on file, and showing "Not recorded" for them was wrong, not
    // just incomplete: the data exists, this just never looked for it.
    // Load both stages and keep whichever was touched most recently, so the
    // doctor always sees the latest answers on file.
    const stamp = (r: AnamnesisRecord | null) => (r ? r.completed_at ?? r.updated_at ?? r.created_at ?? "" : "");
    Promise.all([
      anamnesisService.getForPatient(patientId, "main").catch(() => null),
      anamnesisService.getForPatient(patientId, "registration").catch(() => null),
    ]).then(([main, reg]) => setAnamnesis(stamp(reg) > stamp(main) ? reg : main ?? reg));
    Promise.all([
      anamnesisService.getQuestions("main").catch(() => [] as AnamnesisQuestion[]),
      anamnesisService.getQuestions("registration").catch(() => [] as AnamnesisQuestion[]),
    ]).then(([m, r]) => setAnamnesisQuestions([...m, ...r]));
    eegService.getPatientReports(patientId).then((r) => setEegReports(r.data)).catch(() => setEegReports([]));
    treatmentProtocolService.listProtocols({ patientId })
      .then((list) => setProtocols(list.slice().sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))))
      .catch(() => setProtocols([]));
  }, [patientId]);

  const activeProtocol = protocols.find((p) => p.status === "active") ?? null;

  // Legacy columns (chief_complaint, …) are always written null — real answers
  // live in anamnesis.responses keyed by question_id, so resolve by the catalog
  // question whose question_code matches. Falls back to the legacy column.
  const answer = (code: string): string | null => {
    if (!anamnesis) return null;
    const ids = new Set(anamnesisQuestions.filter((q) => q.question_code === code).map((q) => q.question_id));
    const r = anamnesis.responses?.find((x) => ids.has(x.question_id));
    const v = r?.response_values?.length ? r.response_values.join("; ") : r?.response_value;
    if (v) return v;
    const legacy = (anamnesis as unknown as Record<string, unknown>)[code];
    return legacy == null || legacy === "" ? null : String(legacy);
  };
  // Yes/no question with a conditional details follow-up: show the details
  // when given, otherwise the bare yes/no answer.
  const yesNoDetail = (flagCode: string, detailCode: string): string | null => {
    const detail = answer(detailCode);
    if (detail) return detail;
    const flag = answer(flagCode);
    if (!flag) return null;
    return /^(yes|true)$/i.test(flag) ? "Yes" : /^(no|false)$/i.test(flag) ? "No" : flag;
  };

  return (
    <div className="border border-neutral-200 rounded-xl bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-neutral-100">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-primary-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
            {(patient?.full_name || "?").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-neutral-900 truncate">{patient?.full_name ?? "Patient"}</p>
            <p className="text-xs text-neutral-500 truncate">
              MRN-{patient?.mrn ?? "—"} · {patient?.age ?? "—"} yrs, {patient?.gender ?? "—"} · {patient?.condition ?? "—"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {activeProtocol && (
            <span className="text-xs font-semibold text-primary-700">Protocol v{protocols.length - protocols.indexOf(activeProtocol)} active</span>
          )}
          <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-xs font-semibold text-neutral-600">
            {open ? "Collapse" : "Expand"} {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="p-4 grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          <Box title="Demographics">
            <Field label="Age / Sex" value={`${patient?.age ?? "—"} · ${patient?.gender ?? "—"}`} />
            <Field label="MRN" value={patient?.mrn ?? "—"} />
            <Field label="Weight" value={patient?.weight_kg != null ? `${patient.weight_kg} kg` : "Not tracked"} />
          </Box>

          <Box title="Anamnesis">
            {anamnesis ? (
              <>
                <Field label="Chief complaint" value={show(answer("chief_complaint"))} />
                <Field label="Duration" value={show(answer("symptoms_start"))} />
              </>
            ) : <p className="text-xs text-neutral-400">Not recorded</p>}
          </Box>

          <Box title="History &amp; Comorbidities">
            {anamnesis ? (
              <>
                <Field label="Neuromodulation" value={show(yesNoDetail("has_neuromodulation", "neuromodulation_details"))} />
                <Field label="Operations" value={show(yesNoDetail("has_operations", "operations_details"))} />
              </>
            ) : <p className="text-xs text-neutral-400">Not recorded</p>}
          </Box>

          <Box title="Medications">
            <p className="text-xs text-neutral-400">No medication-tracking module in this system.</p>
            {answer("current_medications") && (
              <Field label="Per anamnesis" value={answer("current_medications")} />
            )}
          </Box>

          <Box title="PRS Scores">
            {scoreInstances.length ? (
              scoreInstances.slice(0, 4).map((s) => (
                <Field
                  key={s.instance_id}
                  label={s.disease_name ?? "Scale"}
                  value={s.disease_score != null ? `${s.disease_score.toFixed(0)}${s.severity_label ? ` · ${s.severity_label}` : ""}` : "—"}
                />
              ))
            ) : <p className="text-xs text-neutral-400">Not recorded</p>}
          </Box>

          <Box title="EEG Findings">
            {eegReports.length ? (
              <>
                <Field label="Latest report" value={eegReports[0].report_name} />
                <Field label="Date" value={fmtDate(eegReports[0].created_at)} />
                <Field label="Reports on file" value={eegReports.length} />
              </>
            ) : <p className="text-xs text-neutral-400">No reports on file</p>}
          </Box>

          <Box title="Doctor's Notes">
            {doctorNote?.note_text ? (
              <p className="text-xs text-neutral-800 leading-relaxed whitespace-pre-wrap line-clamp-4">{doctorNote.note_text}</p>
            ) : <p className="text-xs text-neutral-400">Not recorded</p>}
          </Box>

          <Box title="Prior Protocols">
            {protocols.length ? (
              protocols.slice(0, 3).map((p, i) => (
                <Field
                  key={p.protocol_id}
                  label={fmtDate(p.created_at)}
                  value={`${p.device_name || p.modality || "Protocol"}${p.prescribed_current_ma != null ? `, ${p.prescribed_current_ma} mA` : ""}${p.prescribed_duration_min != null ? ` × ${p.prescribed_duration_min} min` : ""}`}
                />
              ))
            ) : <p className="text-xs text-neutral-400">No prior protocols</p>}
          </Box>
        </div>
      )}
    </div>
  );
}