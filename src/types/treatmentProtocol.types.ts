// Mirrors backend/app/modules/treatment_protocols/schemas.py exactly.
// Decimal -> number, UUID -> string, date -> "YYYY-MM-DD" string.

export const MODALITIES = ["tDCS", "HD-tDCS", "taVNS", "TPS", "rTMS", "other"] as const;
export type Modality = (typeof MODALITIES)[number];

export const EVIDENCE_RANK: Record<string, number> = { A: 3, B: 2, C: 1 };

// ─── Step 1 — Device ───
export interface DeviceCompanyRead {
  company_id: string;
  company_code: string;
  company_name: string;
  country?: string | null;
  is_active: boolean;
}

export interface DeviceRead {
  device_id: string;
  device_code: string;
  device_name: string;
  model_number?: string | null;
  modality: string;
  phase: 1 | 2;
  is_active: boolean;
  company_id?: string | null;
  company_name?: string | null;
  company_code?: string | null;
  /** Only populated when the request passed clinic_id — units that clinic owns.
   * Not the same as device-schedule capacity (concurrent session slots). */
  clinic_quantity?: number | null;
}

// ─── Clinic device inventory (Settings → Clinic Devices) ───
// Mirrors backend/app/modules/scheduling/schemas.py ClinicDeviceRead/Create/Update.
// Distinct from DeviceScheduleRead below: this is WHAT the clinic owns,
// device-schedule is WHEN sessions run and HOW MANY at once.
export interface ClinicDeviceRead {
  clinic_device_id: string;
  clinic_id: string;
  device_id: string;
  quantity: number;
  is_active: boolean;
  acquired_on?: string | null;
  notes?: string | null;
  // Hydrated from the catalogue so the screen shows names, not ids.
  device_code?: string | null;
  device_name?: string | null;
  modality?: string | null;
  phase?: 1 | 2 | null;
  device_is_active?: boolean | null;
  company_name?: string | null;
}

export interface ClinicDeviceCreate {
  device_id: string;
  quantity?: number; // defaults to 1 server-side
  acquired_on?: string | null;
  notes?: string | null;
}

export interface ClinicDeviceUpdate {
  quantity?: number;
  is_active?: boolean;
  acquired_on?: string | null;
  notes?: string | null;
}

// ─── Clinic device schedule (availability panel, Step 7) ───
export interface DeviceScheduleRead {
  schedule_id: string;
  clinic_id: string;
  day_of_week: number; // 0=Sun..6=Sat
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  break_start?: string | null;
  break_end?: string | null;
  capacity: number;
  is_active: boolean;
}

export interface DeviceOverrideRead {
  override_id: string;
  clinic_id: string;
  override_date: string;
  is_available: boolean;
  start_time?: string | null;
  end_time?: string | null;
  capacity?: number | null;
  reason?: string | null;
}

export interface DeviceSlotRead {
  date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  booked: number;
  remaining: number;
  is_available: boolean;
}

// ─── Step 2 — Condition ───
export interface ConditionRead {
  condition_id: string;
  condition_name: string;
  display_order: number;
  is_active: boolean;
  diagnosis_count: number;
  evidence_level?: string | null;
}

// ─── Step 3 — Diagnosis ───
export interface DiagnosisRead {
  diagnosis_id: string;
  condition_id: string;
  condition_name: string;
  icd10_code: string;
  icd10_description: string;
  suggested_montage?: string | null;
  evidence_level?: string | null;
}

export interface ResolutionAlternate {
  condition_id: string;
  condition_name: string;
  evidence_level?: string | null;
  placement_summary?: string | null;
  placement_id?: string | null;
  dosing_id?: string | null;
}

export interface DiagnosisResolution {
  driving_condition_id?: string | null;
  driving_condition_name?: string | null;
  evidence_level?: string | null;
  placement_id?: string | null;
  placement_summary?: string | null;
  dosing_id?: string | null;
  suggested_dosing?: Record<string, unknown> | null;
  suggested_scales: string[];
  alternates: ResolutionAlternate[];
  note?: string | null;
}

// ─── Step 4 — Placement ───
export interface PlacementRead {
  placement_id: string;
  condition_id: string;
  device_id: string;
  modality: string;
  montage_label: string;
  is_active: boolean;
  anode_site?: string | null;
  cathode_site?: string | null;
  return_sites?: string[] | null;
  ear_side?: string | null;
  auricular_site?: string | null;
  target_region?: string | null;
  hemisphere?: string | null;
  coil_target?: string | null;
  coil_type?: string | null;
  placement_details?: Record<string, unknown> | null;
  summary?: string | null;
}

export interface ElectrodeValidationRequest {
  device_id: string;
  anode_site?: string | null;
  cathode_sites: string[];
}

export interface ElectrodeValidationResult {
  valid: boolean;
  modality: string;
  max_cathodes: number;
  errors: string[];
  warnings: string[];
}

// ─── Step 5 — Dosing ───
export interface DosingRead {
  dosing_id: string;
  condition_id: string;
  device_id: string;
  modality: string;
  placement_id?: string | null;
  evidence_level: string;
  num_sessions_text?: string | null;
  notes?: string | null;
  is_active: boolean;
  current_ma_min?: number | null;
  current_ma_max?: number | null;
  total_current_ma?: number | null;
  per_return_current_ma?: number | null;
  session_duration_min?: number | null;
  sessions_per_day?: number | null;
  intensity_ma?: number | null;
  pulse_width_us?: number | null;
  duty_cycle_on_sec?: number | null;
  duty_cycle_off_sec?: number | null;
  energy_mj?: number | null;
  pulses_per_session?: number | null;
  pulse_rate_hz?: number | null;
  frequency_hz?: number | null;
  pct_motor_threshold?: number | null;
  train_count?: number | null;
  pulses_per_train?: number | null;
  inter_train_interval_sec?: number | null;
  dose_details?: Record<string, unknown> | null;
}

// ─── Step 6 — Scales ───
export interface ScaleRead {
  scale_id: string;
  scale_code: string;
  scale_name: string;
  prs_scale_id?: string | null;
  display_order: number;
}

// ─── Step 7 — Schedule preview ───
export interface SchedulePreviewRequest {
  start_date: string;
  session_count: number;
  sessions_per_week: number;
  follow_up_every_n?: number | null;
  skip_dates: string[];
  extra_dates: string[];
}

export interface ScheduledSession {
  session_number: number;
  planned_date: string;
}

export interface ScheduledFollowUp {
  after_session_number: number;
  planned_date: string;
}

export interface SchedulePreview {
  sessions: ScheduledSession[];
  follow_ups: ScheduledFollowUp[];
  session_count: number;
  follow_up_count: number;
  first_date?: string | null;
  last_date?: string | null;
  week_count: number;
}

// ─── Step 8 — Protocol lifecycle ───
export interface ProtocolScaleAssignment {
  scale_id?: string | null;
  scale_code?: string | null;
  cadence: string;
}

export interface ProtocolCreate {
  plan_id: string;
  device_id: string;
  placement_id: string;
  dosing_id: string;
  session_count: number;
  follow_up_every_n?: number | null;
  start_date: string;
  sessions_per_week: number;
  skip_dates: string[];
  extra_dates: string[];
  diagnosis_ids: string[];
  scales: ProtocolScaleAssignment[];
  device_settings: Record<string, unknown>;
  notes?: string | null;
}

export interface ProtocolUpdate {
  session_count?: number;
  follow_up_every_n?: number | null;
  device_settings?: Record<string, unknown>;
  notes?: string | null;
}

export interface ProtocolRead {
  protocol_id: string;
  plan_id: string;
  device_id: string;
  set_by: string;
  session_count: number;
  follow_up_every_n?: number | null;
  status: "draft" | "active" | "cancelled" | "completed" | string;
  device_settings: Record<string, unknown>;
  notes?: string | null;
  activated_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  device_name?: string | null;
  modality?: string | null;
  company_name?: string | null;
  patient_id?: string | null;
  patient_name?: string | null;
  doctor_id?: string | null;
  doctor_name?: string | null;
  clinic_id?: string | null;
  placement_id?: string | null;
  placement_summary?: string | null;
  dosing_id?: string | null;
  appointment_count: number;
}

export interface ProtocolSessionRead {
  appointment_id: string;
  appointment_type: string;
  session_number?: number | null;
  appointment_date: string;
  start_time?: string | null;
  end_time?: string | null;
  status: string;
  doctor_id?: string | null;
  ca_id?: string | null;
}

export interface ProtocolDetail extends ProtocolRead {
  placement?: PlacementRead | null;
  dosing?: DosingRead | null;
  sessions: ProtocolSessionRead[];
  follow_ups: ProtocolSessionRead[];
}

// ─── PRS responses ───
export interface DeviceSessionPrsCreate {
  appointment_id: string;
  instance_id: string;
  session_number: number;
}

export interface FollowUpPrsCreate {
  appointment_id: string;
  instance_id: string;
  after_session_number: number;
}

export interface PrsResponseRead {
  response_id: string;
  appointment_id: string;
  protocol_id: string;
  patient_id: string;
  instance_id: string;
  session_number: number;
  recorded_at: string;
  kind: string;
}

// ─── Clinical module (treatment_plans/cycles — plan_id FK dependency) ───
export interface TreatmentCycleRead {
  cycle_id: string;
  patient_id: string;
  doctor_id: string;
  ca_id?: string | null;
  clinic_id: string;
  cycle_type: "initial" | "followup" | string;
  cycle_number: number;
  status: string;
  created_at: string;
}

export interface TreatmentPlanRead {
  plan_id: string;
  patient_id: string;
  doctor_id: string;
  cycle_id: string;
  device_type: string;
  sessions_prescribed: number;
  standard_sessions: number;
  extended_sessions: number;
  status: string;
  parent_plan_id?: string | null;
  created_at: string;
}
