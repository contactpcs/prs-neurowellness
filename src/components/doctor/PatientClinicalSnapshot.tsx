"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useDoctorPatient, usePatientScoresSummary, usePatientNote } from "@/lib/hooks";
import { anamnesisService } from "@/lib/api/services/anamnesis.service";
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
  const [eegReports, setEegReports] = useState<EEGReport[]>([]);
  const [protocols, setProtocols] = useState<ProtocolRead[]>([]);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    anamnesisService.getForPatient(patientId, "main").then(setAnamnesis).catch(() => setAnamnesis(null));
    eegService.getPatientReports(patientId).then((r) => setEegReports(r.data)).catch(() => setEegReports([]));
    treatmentProtocolService.listProtocols({ patientId })
      .then((list) => setProtocols(list.slice().sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))))
      .catch(() => setProtocols([]));
  }, [patientId]);

  const activeProtocol = protocols.find((p) => p.status === "active") ?? null;
  const latestScore = scoreInstances.slice().sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))[0];

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
        <div className="p-4 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
          <Box title="Demographics">
            <Field label="Age / Sex" value={`${patient?.age ?? "—"} · ${patient?.gender ?? "—"}`} />
            <Field label="MRN" value={patient?.mrn ?? "—"} />
            <Field label="BP / HR" value="Not tracked" />
            <Field label="Weight" value="Not tracked" />
            <Field label="Handedness" value="Not tracked" />
          </Box>

          <Box title="Anamnesis">
            {anamnesis ? (
              <>
                <Field label="Chief complaint" value={show(anamnesis.chief_complaint)} />
                <Field label="Duration" value={show(anamnesis.symptoms_duration)} />
                <Field label="Frequency" value={show(anamnesis.symptoms_frequency)} />
                <Field label="Progression" value={show(anamnesis.symptoms_progression)} />
              </>
            ) : <p className="text-xs text-neutral-400">Not recorded</p>}
          </Box>

          <Box title="History &amp; Comorbidities">
            {anamnesis ? (
              <>
                <Field label="Diagnosis related" value={show(anamnesis.diagnosis_details)} />
                <Field label="Operations" value={show(anamnesis.operations_details)} />
                <Field label="Neuromodulation" value={show(anamnesis.neuromodulation_details)} />
                <Field label="Other scans" value={show(anamnesis.other_scans)} />
              </>
            ) : <p className="text-xs text-neutral-400">Not recorded</p>}
          </Box>

          <Box title="Medications">
            <p className="text-xs text-neutral-400">No medication-tracking module in this system.</p>
            {anamnesis?.current_medications && (
              <Field label="Per anamnesis" value={anamnesis.current_medications} />
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

          <p className="text-xs text-neutral-500 flex items-center gap-1.5">Latest PRS as of {fmtDate(latestScore?.completed_at)}.</p>
        </div>
      )}
    </div>
  );
}
