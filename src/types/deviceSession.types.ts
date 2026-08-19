// tDCS Device Session module — 1:1 with backend/app/modules/device_sessions
// Pydantic schemas (SQL/v1/53_device_session_records.sql). Field names match
// the DB columns exactly, same convention treatmentProtocol.types.ts uses.

export type SessionStatus = "not_started" | "in_progress" | "paused" | "completed" | "stopped_early";

export type PauseStopReason =
  | "patient_discomfort" | "adverse_event" | "device_setup_issue" | "device_glitch" | "power_outage" | "other";

export type Symptom =
  | "tingling" | "itching" | "burning" | "headache" | "fatigue"
  | "sleepiness" | "dizziness" | "skin_redness" | "nausea" | "other";

export type Severity = "mild" | "moderate" | "severe";

export type AdverseEventType =
  | "sharp_burning_pain" | "skin_burn_lesion" | "dizziness" | "severe_headache" | "nausea_vomiting" | "other";

export type CognitiveActivity =
  | "sudoku" | "memory_game" | "word_recall" | "reading_aloud" | "breathing" | "sit_to_stand" | "drawing";

export type ScaleDeliveryMode = "ca_administered" | "patient_app";
export type ScaleStatus = "pending" | "in_progress" | "completed";
export type MediaType = "photo" | "video";
export type SosType = "discomfort" | "unwell" | "other" | "emergency";

export interface ConsentBlock {
  statements: { code: string; confirmed: boolean }[];
  signature: string;
  signed_at: string;
}

export interface NextSessionConfirmation {
  patient_confirmed: boolean;
  requested_date?: string | null;
  requested_slot?: string | null;
  note?: string | null;
}

export interface DeviceSessionChecklistUpdate {
  payment_verified?: boolean;
  payment_override_reason?: string | null;
  device_brand?: string | null;
  device_serial_number?: string | null;
  actual_intensity_ma?: number | null;
  intensity_deviates?: boolean;
  intensity_deviation_reason?: string | null;
  actual_duration_min?: number | null;
  duration_deviates?: boolean;
  duration_deviation_reason?: string | null;
  actual_ramp_up_sec?: number | null;
  ramp_up_deviates?: boolean;
  ramp_up_deviation_reason?: string | null;
  actual_ramp_down_sec?: number | null;
  ramp_down_deviates?: boolean;
  ramp_down_deviation_reason?: string | null;
  montage_verified?: boolean;
  contraindication_checklist?: Record<string, boolean>;
  patient_consent?: ConsentBlock;
  ca_declaration?: ConsentBlock;
}

export interface DeviceSessionRead {
  device_session_record_id: string;
  appointment_id: string;
  protocol_id: string;

  payment_verified: boolean;
  payment_override_reason: string | null;
  device_brand: string | null;
  device_serial_number: string | null;
  actual_intensity_ma: number | null;
  intensity_deviates: boolean;
  intensity_deviation_reason: string | null;
  actual_duration_min: number | null;
  duration_deviates: boolean;
  duration_deviation_reason: string | null;
  actual_ramp_up_sec: number | null;
  ramp_up_deviates: boolean;
  ramp_up_deviation_reason: string | null;
  actual_ramp_down_sec: number | null;
  ramp_down_deviates: boolean;
  ramp_down_deviation_reason: string | null;
  montage_verified: boolean;
  contraindication_checklist: Record<string, boolean>;
  patient_consent: ConsentBlock | null;
  ca_declaration: ConsentBlock | null;

  session_status: SessionStatus;
  device_fit_checklist: Record<string, boolean>;
  impedance_kohm: number | null;
  started_at: string | null;
  paused_at: string | null;
  resumed_at: string | null;
  stopped_at: string | null;
  completed_at: string | null;
  pause_stop_reason: PauseStopReason | null;
  pause_stop_reason_detail: string | null;
  next_session_confirmation: NextSessionConfirmation | null;

  created_by: string;
  created_at: string;
  updated_at: string;
}

/** GET /device-sessions/{appointment_id} — the header plus every hydrated
 * child list, for the CA resume view and the summary screen. */
export interface DeviceSessionDetail extends DeviceSessionRead {
  symptoms: SymptomRecord[];
  adverse_events: AdverseEventRecord[];
  notes: NoteRecord[];
  activities: ActivityRecord[];
  scales: DeviceSessionScale[];
  feedback: SessionFeedback | null;
  media: MediaRecord[];
  events: SessionEvent[];
  sos_events: SosEvent[];
}

export interface SymptomRecord {
  symptom_record_id: string;
  device_session_record_id: string;
  symptom: Symptom;
  severity: Severity;
  note: string | null;
  recorded_by: string;
  recorded_at: string;
}

export interface AdverseEventRecord {
  ae_record_id: string;
  device_session_record_id: string;
  event_type: AdverseEventType;
  severity: Severity;
  description: string;
  action_taken: string | null;
  recorded_by: string;
  recorded_at: string;
}

export interface NoteRecord {
  note_id: string;
  device_session_record_id: string;
  note_text: string;
  recorded_by: string;
  recorded_at: string;
}

export interface ActivityRecord {
  activity_record_id: string;
  device_session_record_id: string;
  activities: CognitiveActivity[];
  free_text: string | null;
  note: string | null;
  recorded_by: string;
  recorded_at: string;
}

export interface DeviceSessionScale {
  session_scale_id: string;
  device_session_record_id: string;
  protocol_scale_id: string;
  scale_code?: string;
  scale_name?: string;
  delivery_mode: ScaleDeliveryMode | null;
  prs_instance_id: string | null;
  status: ScaleStatus;
  created_at: string;
  updated_at: string;
}

export interface SessionFeedback {
  feedback_id: string;
  device_session_record_id: string;
  answers: {
    comfort: "comfortable" | "tolerable" | "uncomfortable";
    felt_after: "better" | "no_change" | "worse";
    next_intensity: "decrease" | "keep_same" | "increase";
  };
  quote: string | null;
  recorded_by: string;
  recorded_at: string;
}

export interface MediaRecord {
  media_id: string;
  device_session_record_id: string;
  recording_consent_confirmed: boolean;
  media_type: MediaType;
  file_key: string;
  captured_at: string;
  uploaded_by: string;
}

export interface SessionEvent {
  event_id: string;
  device_session_record_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  actor_id: string;
  actor_role: string;
  occurred_at: string;
}

export interface SosEvent {
  sos_id: string;
  device_session_record_id: string;
  sos_type: SosType;
  note: string | null;
  raised_by: string;
  raised_at: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
}
