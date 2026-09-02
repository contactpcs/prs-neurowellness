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

// ─── Device units (serial-numbered physical units, 73_device_units.sql) ───
// Optional layer under one ClinicDeviceRead row. A clinic can keep using
// quantity alone with no units listed here.
export interface DeviceUnitRead {
  device_unit_id: string;
  clinic_device_id: string;
  serial_number: string;
  status: "active" | "retired";
  notes?: string | null;
}

export interface DeviceUnitCreate {
  serial_number: string;
  notes?: string | null;
}

export interface DeviceUnitUpdate {
  serial_number?: string;
  status?: "active" | "retired";
  notes?: string | null;
}

// ─── Clinic device schedule (availability panel, Step 7) ───
// One pool per DEVICE the clinic owns (clinic_device_id), not one blanket
// number for the whole clinic — see backend SQL/v1/41_device_capacity_per_device.sql.
export interface DeviceScheduleRead {
  schedule_id: string;
  clinic_id: string;
  clinic_device_id: string;
  day_of_week: number; // 0=Sun..6=Sat
  start_time: string;
  end_time: string;
  break_start?: string | null;
  break_end?: string | null;
  is_active: boolean;
}

export interface DeviceOverrideRead {
  override_id: string;
  clinic_id: string;
  clinic_device_id: string;
  override_date: string;
  is_available: boolean;
  start_time?: string | null;
  end_time?: string | null;
  capacity?: number | null;
  reason?: string | null;
}

// One entry per device the clinic owns, for the Settings admin screen — every
// device it could set a schedule for, with the week it has so far (empty if
// unset yet).
export interface ClinicDeviceScheduleOverview {
  clinic_device_id: string;
  device_id: string;
  device_name?: string | null;
  modality?: string | null;
  quantity: number;
  week: DeviceScheduleRead[];
}

// Request shapes — mirror backend DeviceScheduleItem/Replace/OverrideCreate.
export interface DeviceScheduleItem {
  day_of_week: number; // 0=Sun..6=Sat
  start_time: string;  // "HH:MM:SS"
  end_time: string;
  break_start?: string | null;
  break_end?: string | null;
  is_active: boolean;
}

export interface DeviceScheduleReplace {
  items: DeviceScheduleItem[];
}

export interface DeviceOverrideCreate {
  override_date: string;
  is_available: boolean;
  start_time?: string | null;
  end_time?: string | null;
  capacity?: number | null; // null inherits the weekly capacity
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

// ─── Step 4 — Custom montages (core.protocol_custom_montages, 38) ───
// A doctor-authored montage, saved when the 10-20 map's freeform electrode
// combination has no match in the curated reference.*_placements library.
// Validated with the same electrode-shape rule a catalogue placement gets
// (backend re-runs validate_electrodes at write time), then usable in place
// of placement_id + dosing_id when creating a protocol (54).
export interface CustomMontageCreate {
  device_id: string;
  montage_name: string;
  /** Exactly 1 site — chk_pcm_electrode_shape. */
  anode_sites: string[];
  /** 1–4 sites — chk_pcm_electrode_shape. */
  cathode_sites: string[];
  condition_id?: string | null;
  description?: string | null;
  /** Required — a montage departing from the validated library carries the
   *  reason it was chosen as part of the clinical record. */
  clinical_reasoning: string;
}

export interface CustomMontageRead {
  custom_montage_id: string;
  created_by: string;
  clinic_id?: string | null;
  device_id: string;
  condition_id?: string | null;
  montage_name: string;
  anode_sites: string[];
  cathode_sites: string[];
  description?: string | null;
  clinical_reasoning: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  device_name?: string | null;
  modality?: string | null;
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
  /** reference.prs_scales.scale_id — a TEXT key like "GAD-7/2026", not a UUID.
   *  Sourced from the PRS catalogue since 51: it is what the questionnaire
   *  engine actually renders, so a scale outside it cannot be prescribed. */
  scale_id: string;
  scale_code: string;
  scale_name: string;
  is_common_scale?: boolean;
  applicable_for?: string | null;
  is_required?: boolean;
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
  /** A PRS scale_id. Required — protocol_scales has an FK into
   *  reference.prs_scales, and a free-typed name cannot be released to the
   *  patient as a task. */
  scale_id: string;
  cadence: string;
}

export interface ProtocolConditionAssignment {
  /** Exactly one of these two — never both, never neither.
   *  (chk_protocol_conditions_shape: num_nonnulls(condition_id, other_text) = 1) */
  condition_id?: string | null;
  other_text?: string | null;
}

export interface ProtocolCreate {
  /** A protocol hangs off a protocol INSTANCE (a course of device treatment)
   *  — its only parent since 48, which dropped plan_id from protocol_plan
   *  entirely. */
  instance_id: string;
  device_id: string;
  /** Optional pinned physical unit (DeviceUnitRead), narrowing device_id to
   *  one specific serialized machine. Omit for "any unit of this device
   *  type" — existing behaviour. When set, device_sessions prefills the
   *  CA's serial field from it at session start. */
  device_unit_id?: string | null;
  /** Exactly one of placement_id (catalogue) or custom_montage_id
   *  (doctor-authored, 38/54) — chk_protocol_plan_one_placement.
   *  dosing_id is required with placement_id, and must be omitted with
   *  custom_montage_id — chk_protocol_plan_dosing_requires_catalogue_
   *  placement (54). A custom montage has no catalogued dosing row to
   *  point at; the prescription is carried entirely by
   *  prescribed_current_ma/prescribed_duration_min/ramp_seconds below,
   *  which have always been independent of dosing_id (39). */
  placement_id?: string | null;
  dosing_id?: string | null;
  custom_montage_id?: string | null;
  session_count: number;
  follow_up_every_n?: number | null;
  start_date: string;
  /** 1 | 2 | 3 | 5 | 7 only — chk_treatment_protocols_sessions_per_week. */
  sessions_per_week: number;
  skip_dates: string[];
  extra_dates: string[];
  conditions: ProtocolConditionAssignment[];
  diagnosis_ids: string[];
  scales: ProtocolScaleAssignment[];
  /** Step 5, the prescribed dose. Optional at create so a half-finished draft
   *  can be saved, but ACTIVATION FAILS without current + duration + cadence:
   *  a clinical assistant reads these off the screen and sets them on the
   *  machine, so a NULL current is an unanswerable question at the bedside. */
  prescribed_current_ma?: number | null;
  prescribed_duration_min?: number | null;
  ramp_seconds?: number;
  /** Which consultation authored this. Provenance only. */
  authored_in_appointment_id?: string | null;
  /** Set to amend an existing protocol instead of starting a new lineage:
   *  the created row inherits this protocol's version_major and gets
   *  version_minor + 1, and the target is cancelled (its planned
   *  appointments too) and flipped to status='superseded' in the same
   *  request. Omit to start a new lineage at the instance's next major. */
  supersedes_protocol_id?: string | null;
  device_settings: Record<string, unknown>;
  notes?: string | null;
}

export interface ProtocolUpdate {
  session_count?: number;
  follow_up_every_n?: number | null;
  /** Editable on a draft so an incomplete step 5 can be completed before
   *  activation, which then requires all three. */
  prescribed_current_ma?: number | null;
  prescribed_duration_min?: number | null;
  ramp_seconds?: number | null;
  sessions_per_week?: number | null;
  device_settings?: Record<string, unknown>;
  notes?: string | null;
}

export interface ProtocolInstanceCreate {
  cycle_id: string;
  notes?: string | null;
}

export interface ProtocolInstanceRead {
  instance_id: string;
  cycle_id: string;
  patient_id: string;
  created_by: string;
  instance_number: number;
  status: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  clinic_id?: string | null;
  doctor_id?: string | null;
  patient_name?: string | null;
  created_by_name?: string | null;
  protocol_count: number;
}

export interface ProtocolRead {
  protocol_id: string;
  instance_id?: string | null;
  instance_number?: number | null;
  instance_status?: string | null;
  device_id: string;
  device_unit_id?: string | null;
  device_unit_serial_number?: string | null;
  set_by: string;
  session_count: number;
  follow_up_every_n?: number | null;
  status: "draft" | "active" | "cancelled" | "completed" | string;
  prescribed_current_ma?: number | null;
  prescribed_duration_min?: number | null;
  ramp_seconds?: number | null;
  sessions_per_week?: number | null;
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
  /** patients.patient_id — GET /doctor/patients/{id} and other patient-scoped
   *  routes expect this, not patient_id above (which is profiles.id). */
  patient_public_id?: string | null;
  patient_name?: string | null;
  doctor_id?: string | null;
  doctor_name?: string | null;
  clinic_id?: string | null;
  placement_id?: string | null;
  placement_summary?: string | null;
  dosing_id?: string | null;
  custom_montage_id?: string | null;
  appointment_count: number;
  /** Amendment lineage: a new lineage starts at major "N", minor 0;
   *  amending it (supersedes_protocol_id) inherits the major and bumps
   *  minor. Display as `${version_major}` when minor is 0, else
   *  `${version_major}.${version_minor}`. */
  supersedes_protocol_id?: string | null;
  version_major: number;
  version_minor: number;
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
  /** Hydrated when custom_montage_id is set instead of placement_id/
   *  dosing_id — mutually exclusive with placement/dosing above. */
  custom_montage?: CustomMontageRead | null;
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
