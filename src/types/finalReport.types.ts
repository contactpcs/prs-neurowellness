// Final Report — backend app/modules/final_reports (SQL/v1/117).
// `FinalReportSections` is the snapshot frozen at signing; the preview
// endpoint returns the same shape with doctor_notes still empty.

export type FinalReportScope = "overall" | "last_consultation";

export interface FinalReportAnamnesis {
  anamnesis_id: string;
  stage: string; // registration | main
  status: string;
  appointment_id: string | null;
  recorded_at: string | null;
  sections: { title: string; items: { question: string; answer: string | null }[] }[];
}

export interface FinalReportPrsScale {
  scale_code: string;
  scale_name: string;
  value: number | null;
  max: number | null;
  percentage: number | null;
  severity_label: string | null;
  /** Only on reports signed 2026-10-13/14, when a row also listed earlier
   * results of scales it did not answer. Rows are now one PRS record each,
   * with only its own scales. */
  carried?: boolean;
  taken_at?: string | null;
}

/** PRS taken at the device sessions of one protocol instance ("Instance 1",
 * "Instance 2", ... when the patient runs several devices): one row per PRS
 * record, no condition. (The condition a session scale is filed under in
 * the database is arbitrary — see assembler._device_session_groups in the
 * backend.) An instance with no PRS yet still has a block, with no entries. */
export interface FinalReportPrsDeviceGroup {
  instance_number?: number | null;
  device_name: string | null;
  /** The conditions the doctor selected on the protocol. */
  conditions: string[];
  entries: {
    /** The PRS record. Absent on reports signed before 2026-10-14 (one row per session then). */
    instance_id?: string;
    appointment_id: string | null;
    /** completed | in_progress (an unfinished PRS, printed only when ticked). */
    status?: string;
    completed_at: string | null;
    session_number: number | null;
    /** Plain average of the scales, 0-100, lower is better. */
    score?: number | null;
    severity_label?: string | null;
    scales: FinalReportPrsScale[];
  }[];
  /** One weekly row of the session score. */
  weekly_progress: { weeks: string[]; scores: (number | null)[] };
}

export interface FinalReportPrsEntry {
  instance_id: string;
  status?: string;
  completed_at: string | null;
  origin: string; // device_session | initial | follow_up | protocol_followup | <assessment_stage>
  score: number | null;
  severity_level: string | null;
  severity_label: string | null;
  device_name: string | null;
  session_number: number | null;
  conditions: string[];
  scales: FinalReportPrsScale[];
}

export interface FinalReportPrsDisease {
  /** null for the general registration PRS, which has no disease. */
  disease_id: string | null;
  disease_name: string;
  entries: FinalReportPrsEntry[];
  weekly_progress: { weeks: string[]; scores: (number | null)[] };
}

export interface FinalReportNote {
  note_id: string;
  category: string;
  note_text: string;
  created_at: string;
  doctor_name: string | null;
}

export interface FinalReportMedication {
  medicine_id?: string;
  medicine_name: string;
  dose: string | null;
  timing: string | null;
  meal_instruction: string | null;
  duration: string | null;
  note: string | null;
  status: "active" | "stopped";
  started_at: string | null;
  stopped_at: string | null;
  prescribed_by_name: string | null;
}

export interface FinalReportTreatmentPlan {
  protocol_id: string;
  /** Which of the patient's protocol instances this is (1, 2, ...). */
  instance_number?: number | null;
  status: string;
  version: string;
  device_name: string | null;
  modality: string | null;
  prescribed_by: string | null;
  activated_at: string | null;
  conditions: string[];
  placement: string | null;
  dosage: Record<string, string | number>;
  session_count: number | null;
  sessions_per_week: number | null;
  follow_up_every_n: number | null;
  schedule: { session_number: number | null; date: string; start_time: string | null; status: string }[];
  follow_ups: { after_session_number: number | null; date: string; status: string }[];
}

export interface FinalReportSession {
  appointment_id?: string;
  session_number: number | null;
  date: string;
  status: string;
  device_name: string | null;
  prescribed_current_ma: number | null;
  actual_intensity_ma: number | null;
  prescribed_duration_min: number | null;
  actual_duration_min: number | null;
  deviations: string[];
  stop_reason: string | null;
  symptom_count: number;
  adverse_event_count: number;
}

export interface FinalReportSections {
  scope: FinalReportScope;
  generated_at: string;
  window: {
    from: string | null;
    to: string | null;
    consultation: { appointment_id: string; appointment_type: string; appointment_date: string } | null;
  };
  patient: { name: string; dob: string | null; gender: string | null; mrn: string | null } | null;
  doctor: { name: string; license_number: string | null; specialization: string | null } | null;
  clinic: { clinic_name: string; address: string | null; city: string | null; phone: string | null } | null;
  anamnesis: FinalReportAnamnesis[];
  diagnosis_codes: { icd10_code: string; icd10_description: string | null }[];
  brain_mapping: { available: boolean };
  /** diseases = the main PRS, per condition. device_sessions = PRS taken at
   * device sessions (absent on reports signed before 2026-10-13, where
   * those rows sit inside `diseases`). */
  prs: { diseases: FinalReportPrsDisease[]; device_sessions?: FinalReportPrsDeviceGroup[] };
  doctor_notes: FinalReportNote[];
  medications: FinalReportMedication[];
  treatment_plans: FinalReportTreatmentPlan[];
  sessions: FinalReportSession[];
}

/** Per report section, the ids the doctor ticked with that section's pencil.
 * A missing or null key keeps the scope's default. */
export interface FinalReportSelection {
  anamnesis_ids?: string[] | null;
  /** Main PRS sittings (prs instance ids). */
  prs_ids?: string[] | null;
  /** Device sessions with PRS, by appointment id. */
  session_prs_ids?: string[] | null;
  note_ids?: string[] | null;
  medicine_ids?: string[] | null;
  protocol_ids?: string[] | null;
  /** Device sessions for section 08, by appointment id. */
  session_ids?: string[] | null;
}

export type FinalReportSelectionKey = keyof FinalReportSelection;

/** Everything each section's pencil can offer — the patient's full history. */
/** What a PRS candidate shows in the pencil: its overall score and every scale. */
interface FinalReportPrsCandidateScores {
  score: number | null;
  severity_label: string | null;
  scales: FinalReportPrsScale[];
}

export interface FinalReportCandidates {
  /** Each earlier anamnesis in full (all questions and answers). */
  anamnesis: { id: string; recorded_at: string | null; status: string; sections: FinalReportAnamnesis["sections"] }[];
  /** Every PRS record, one each (id = PRS instance id), completed or in progress. */
  prs: ({ id: string; status: string; condition: string; completed_at: string | null; origin: string } & FinalReportPrsCandidateScores)[];
  session_prs: ({
    id: string;
    status: string;
    instance_number: number | null;
    device_name: string | null;
    session_number: number | null;
    /** Conditions selected on the protocol. */
    conditions?: string[];
    completed_at: string | null;
  } & FinalReportPrsCandidateScores)[];
  notes: { id: string; category: string; note_text: string; created_at: string; doctor_name: string | null }[];
  medicines: { id: string; medicine_name: string; dose: string | null; status: string; started_at: string | null }[];
  protocols: { id: string; device_name: string | null; version: string; status: string; instance_number: number | null; created_at: string | null }[];
  sessions: { id: string; session_number: number | null; date: string; device_name: string | null; status: string }[];
  /** Diagnoses written on this patient's earlier signed reports. */
  diagnoses: { report_id: string; diagnosis: string; signed_at: string }[];
}

export interface FinalReportPreview {
  scope: FinalReportScope;
  sections: FinalReportSections;
  /** The ids the sections hold. */
  selection: Required<{ [K in FinalReportSelectionKey]: string[] }>;
  candidates: FinalReportCandidates;
}

export interface FinalReportSignature {
  typed_name: string | null;
  license_number: string | null;
  style: string;
  signed_at: string;
}

export interface FinalReportMeta {
  report_id: string;
  patient_id: string;
  clinic_id: string;
  doctor_id: string;
  doctor_name: string | null;
  scope: FinalReportScope;
  appointment_id: string | null;
  diagnosis: string;
  signature: FinalReportSignature;
  content_hash: string;
  signed_at: string;
}

export interface FinalReport extends FinalReportMeta {
  snapshot: FinalReportSections;
}

export interface FinalReportSignPayload {
  scope: FinalReportScope;
  /** What goes in, section by section; the server rebuilds the report from it. */
  selection?: FinalReportSelection;
  diagnosis: string;
  note_ids?: string[];
  confirm_sign: boolean;
}
