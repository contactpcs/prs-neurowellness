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

export interface FinalReportPrsEntry {
  instance_id: string;
  completed_at: string | null;
  origin: string; // device_session | initial | follow_up | protocol_followup | <assessment_stage>
  score: number | null;
  severity_level: string | null;
  severity_label: string | null;
  device_name: string | null;
  session_number: number | null;
  conditions: string[];
  scales: {
    scale_code: string;
    scale_name: string;
    value: number | null;
    max: number | null;
    percentage: number | null;
    severity_label: string | null;
  }[];
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
  prs: { diseases: FinalReportPrsDisease[] };
  doctor_notes: FinalReportNote[];
  medications: FinalReportMedication[];
  treatment_plans: FinalReportTreatmentPlan[];
  sessions: FinalReportSession[];
}

export interface FinalReportNoteCandidate extends FinalReportNote {
  appointment_id: string | null;
  /** Belongs to the chosen scope — what the picker pre-ticks. */
  in_scope: boolean;
}

export interface FinalReportPreview {
  scope: FinalReportScope;
  sections: FinalReportSections;
  note_candidates: FinalReportNoteCandidate[];
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
  diagnosis: string;
  note_ids: string[];
  confirm_sign: boolean;
}
