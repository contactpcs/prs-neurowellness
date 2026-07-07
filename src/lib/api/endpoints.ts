// Backend-v2 endpoint map. Key NAMES are kept identical to what the screens
// already call (ENDPOINTS.X.Y) — only the underlying path strings changed.
// Keys with no backend-v2 equivalent are commented and left pointing at
// their old (non-existent) path so calls fail cleanly (404) rather than
// silently doing the wrong thing — see the matching service file for
// details on what's mapped vs. left broken.

export const ENDPOINTS = {
  // ─── Auth ───
  AUTH: {
    LOGIN: "/auth/local-login", // local dev only: {email} or {cognito_sub}, no password checked
    REAL_LOGIN: "/auth/login",  // cognito mode: {username (email or phone), password}
    NEW_PASSWORD: "/auth/login/new-password", // completes NEW_PASSWORD_REQUIRED: {username, new_password, session}
    CONFIG: "/auth/config",     // public — {auth_mode: "local"|"cognito"}, decides which of the above to call
    REGISTER: "/auth/register", // local dev only — real signup is the OTP wizard below
    SIGNUP_START: "/auth/patients/signup/start",
    SIGNUP_RESEND: "/auth/patients/signup/resend",
    SIGNUP_VERIFY: "/auth/patients/signup/verify",
    SIGNUP_COMPLETE: "/auth/patients/signup/complete",
    VERIFY_CHANNEL_START: "/auth/patients/verify-channel/start",
    VERIFY_CHANNEL_CONFIRM: "/auth/patients/verify-channel/confirm",
    ME: "/auth/me",             // real — GET only
    SYNC_PROFILE: "/auth/sync-profile", // NOT AVAILABLE
    CLINICS: "/auth/clinics",           // real — public clinic picker for self-registration
  },

  // ─── Consent ───
  CONSENT: {
    FORMS: "/consent-templates",   // real — GET, field names differ (see auth.service.ts)
    RESPONSES: "/consent-records", // real, but requires auth + clinic_id (was public in old backend)
  },

  // ─── Users ───
  USERS: {
    PROFILE: "/auth/me", // real — GET only, no PUT (no profile-edit endpoint exists)
  },

  // ─── Doctors ───
  DOCTORS: {
    DASHBOARD: "/doctors/dashboard", // NOT AVAILABLE — no aggregate endpoint, composed client-side
    PATIENTS: "/patients",           // real — RLS auto-scopes to the doctor's assigned patients
    PATIENT: (patientId: string) => `/patients/${patientId}`, // real
    PATIENT_RESULTS: (patientId: string) => `/doctors/patients/${patientId}/results`, // NOT AVAILABLE
    PATIENT_RESULT: (_patientId: string, instanceId: string) => `/prs-assessment-instances/${instanceId}/results`, // real (patientId unused, instance-keyed)
    GRANT_ASSESSMENT: (_patientId: string) => `/patient-scale-assignments`, // real, but per-scale POST (see doctors.service.ts)
    AVAILABILITY: "/doctors/availability", // NOT AVAILABLE — real toggle needs PATCH /doctors/{own_doctor_id}, id not resolvable here
  },

  // ─── Patients (patient-role self views) ───
  PATIENTS: {
    DASHBOARD: "/patients",       // real — RLS-scoped to own record, composed client-side
    MY_DOCTOR: "/patients/my-doctor",           // NOT AVAILABLE
    MY_ASSESSMENTS: "/patients/my-assessments", // NOT AVAILABLE — scale-assignments carry no disease grouping data
    MY_SCORES: "/patients/my-scores",           // NOT AVAILABLE — no list-instances-by-patient endpoint
    DISEASE_SELECTION: (patientId: string) => `/patients/${patientId}/disease-selection`, // real — POST
    DECIDE_APPROVAL: (patientId: string) => `/patients/${patientId}/approval`, // real — PATCH {decision, rejection_reason}
    ALLOCATE_DOCTOR: (patientId: string) => `/patients/${patientId}/allocate-doctor`, // real — PATCH {doctor_id}
  },

  // ─── Staff ───
  STAFF: {
    DASHBOARD: "/staff/dashboard", // NOT AVAILABLE — composed client-side with defaults
    PATIENTS: "/patients",         // real — RLS-scoped to the staff member's clinic
    PATIENTS_PENDING: "/patients", // real (same endpoint) — filtered client-side by registration_status
    REGISTER_PATIENT: "/patients", // real — POST, payload reshaped (see staff.service.ts)
    PATIENT: (patientId: string) => `/patients/${patientId}`, // real
    APPROVE_PATIENT: (patientId: string) => `/staff/patients/${patientId}/approve`, // NOT AVAILABLE — no approval gate, registration_status auto-advances
    REJECT_PATIENT: (patientId: string) => `/staff/patients/${patientId}/reject`,   // NOT AVAILABLE
    DOCTORS: "/doctors", // real
    ALLOCATE: (patientId: string) => `/staff/patients/${patientId}/allocate`, // NOT AVAILABLE — no reassign-doctor endpoint found
  },

  // ─── Admin ───
  ADMIN: {
    CLINICS_BOOTSTRAP: "/admin/clinics/create", // NOT AVAILABLE
    DASHBOARD: "/admin/dashboard",              // NOT AVAILABLE — composed client-side
    CLINICS: "/clinics",                        // real
    CLINIC: (id: string) => `/clinics/${id}`,   // real
    DEACTIVATE_CLINIC: (id: string) => `/clinics/${id}/status`, // real — PATCH {status:"pending_closure"}
    ACTIVATE_CLINIC: (id: string) => `/clinics/${id}/status`,   // real — PATCH {status:"active"}
    STAFF: "/admin/staff",                                      // NOT AVAILABLE — composed from DOCTORS/STAFF below
    STAFF_MEMBER: (id: string) => `/admin/staff/${id}`,          // NOT AVAILABLE — no unified staff-by-id lookup
    REGISTER_STAFF: "/admin/staff/register",                     // NOT AVAILABLE — real routes are role-specific (see admin.service.ts)
    DEACTIVATE_STAFF: (id: string) => `/admin/staff/${id}/deactivate`, // NOT AVAILABLE
    REACTIVATE_STAFF: (id: string) => `/admin/staff/${id}/reactivate`, // NOT AVAILABLE
    DELETE_STAFF: (id: string) => `/admin/staff/${id}`,                // NOT AVAILABLE
    PATIENTS: "/patients",                                             // real
    APPROVE_PATIENT: (id: string) => `/admin/patients/${id}/approve`, // NOT AVAILABLE
    REJECT_PATIENT: (id: string) => `/admin/patients/${id}/reject`,   // NOT AVAILABLE
    DELETE_PATIENT: (id: string) => `/admin/patients/${id}`,          // NOT AVAILABLE — PHI is never hard-deleted
  },

  // ─── Staff Requests (clinic_admin initiates, regional_admin approves) ───
  STAFF_REQUESTS: {
    LIST: "/staff-requests",     // real — GET, ?clinic_id&status
    CREATE: "/staff-requests",   // real — POST
    DECISION: (id: string) => `/staff-requests/${id}/decision`, // real — PATCH {decision, review_notes}
  },

  // ─── Clinic Requests (regional_admin initiates, super_admin approves) ───
  CLINIC_REQUESTS: {
    LIST: "/clinic-requests",   // real — GET, ?region_id&status
    CREATE: "/clinic-requests", // real — POST
    DECISION: (id: string) => `/clinic-requests/${id}/decision`, // real — PATCH {decision, review_notes}, super_admin only
  },

  // ─── Notifications ───
  NOTIFICATIONS: {
    LIST: "/notifications",           // real
    READ_ALL: "/notifications/read",  // real — PATCH {notification_ids: null}, method+body adapted in service
    READ: (_id: string) => "/notifications/read", // real — same endpoint, body carries the id
  },

  // ─── PRS ───
  // backend-v2's PRS module is flat: diseases -> scale-assignments ->
  // one instance per disease/stage -> submit responses -> DB-computed
  // results. The old sessions/scales-catalog/clinician-rating/risk-alerts/
  // score-history subsystem was never built — those keys are left pointing
  // at their old (dead) paths since there is nothing real to map them to.
  PRS: {
    SCALES: "/prs/scales/",                       // NOT AVAILABLE
    SCALE: (id: string) => `/prs/scales/${id}`,   // NOT AVAILABLE
    SCALE_BY_CODE: (code: string) => `/prs/scales/by-code/${code}`, // NOT AVAILABLE
    CONDITIONS: "/prs-catalog/diseases",          // real
    CONDITION: (id: string) => `/prs/conditions/${encodeURIComponent(id)}`, // NOT AVAILABLE — no per-disease detail endpoint
    QUESTION_OPTIONS: (questionId: string) => `/prs/questions/${questionId}/options`, // NOT AVAILABLE
    PERMISSIONS: "/patient-scale-assignments",    // real (closest equivalent — see permissions.service.ts)
    MY_PERMISSIONS: "/prs/permissions/my",        // NOT AVAILABLE — no self patient_id resolvable from a bare URL
    PATIENT_PERMISSIONS: (patientId: string) => `/patients/${patientId}/scale-assignments`, // real
    PATIENT_INSTANCES: (patientId: string) => `/patients/${patientId}/prs-instances`, // real — GET ?assessment_stage=
    SCALE_QUESTIONS: "/prs-catalog/scale-questions", // real — GET ?scale_id= (scale_id is a composite key with "/", so query param not path)
    REVOKE_PERMISSION: (permissionId: string) => `/prs/permissions/${permissionId}/revoke`, // NOT AVAILABLE — no revoke endpoint
    ASSESSMENT_START: "/prs-assessment-instances", // real — shape differs (see prsAssessment.service.ts)
    ASSESSMENT_SUBMIT: (instanceId: string) => `/prs-assessment-instances/${instanceId}/responses`, // real
    ASSESSMENT_SAVE_RESPONSE: (instanceId: string) => `/prs-assessment-instances/${instanceId}/responses`, // real (same endpoint, single-item batch)
    ASSESSMENT_RESPONSES: (instanceId: string) => `/prs-assessment-instances/${instanceId}`, // NOT AVAILABLE as a separate list — instance GET only
    MY_SCORES: "/prs/scores/me",                                    // NOT AVAILABLE
    MY_SCORES_SUMMARY: "/prs/scores/me/summary",                    // NOT AVAILABLE
    INSTANCE_SCORE: (instanceId: string) => `/prs-assessment-instances/${instanceId}/results`, // real
    PATIENT_SCORES: (patientId: string) => `/prs/scores/patient/${patientId}`,         // NOT AVAILABLE
    PATIENT_SCORES_SUMMARY: (patientId: string) => `/prs/scores/patient/${patientId}/summary`, // NOT AVAILABLE
    SESSIONS: "/prs/sessions/",                                     // NOT AVAILABLE
    MY_SESSIONS: "/prs/sessions/my",                                // NOT AVAILABLE
    PATIENT_SESSIONS: (patientId: string) => `/prs/sessions/patient/${patientId}`, // NOT AVAILABLE
    SESSION: (sessionId: string) => `/prs/sessions/${sessionId}`,   // NOT AVAILABLE
    START_SESSION: (sessionId: string) => `/prs/sessions/${sessionId}/start`, // NOT AVAILABLE
    CANCEL_SESSION: (sessionId: string) => `/prs/sessions/${sessionId}/cancel`, // NOT AVAILABLE
    AUTO_SAVE: (sessionId: string, scaleId: string) => `/prs/sessions/${sessionId}/scales/${scaleId}/auto-save`, // NOT AVAILABLE
    SUBMIT_RESPONSE: (sessionId: string, scaleId: string) => `/prs/sessions/${sessionId}/scales/${scaleId}/submit`, // NOT AVAILABLE
    CLINICIAN_RATING: (sessionId: string, scaleId: string) => `/prs/sessions/${sessionId}/scales/${scaleId}/clinician-rating`, // NOT AVAILABLE
    CONSENT: (sessionId: string) => `/prs/sessions/${sessionId}/consent`, // NOT AVAILABLE
    MY_ALERTS: "/prs/alerts/my",                                    // NOT AVAILABLE
    PATIENT_ALERTS: (patientId: string) => `/prs/alerts/patient/${patientId}`, // NOT AVAILABLE
    ACKNOWLEDGE_ALERT: (alertId: string) => `/prs/alerts/${alertId}/acknowledge`, // NOT AVAILABLE
    RESOLVE_ALERT: (alertId: string) => `/prs/alerts/${alertId}/resolve`, // NOT AVAILABLE
    SCORE_HISTORY: (patientId: string) => `/prs/scores/patient/${patientId}/history`, // NOT AVAILABLE
  },

  // ─── Anamnesis ───
  ANAMNESIS: {
    QUESTIONS: "/anamnesis-catalog",                                    // real
    START: (patientId: string) => `/patients/${patientId}/anamnesis`,   // real — patientId now required (service adapts)
    SAVE_RESPONSE: (anamnesisId: string) => `/anamnesis/${anamnesisId}`, // real — PATCH, single-item batch
    SUBMIT: (anamnesisId: string) => `/anamnesis/${anamnesisId}`,        // real — PATCH {responses, complete:true}
    ME: "/patients",                                                    // real (composed — resolve own patient_id first)
    FOR_PATIENT: (patientId: string) => `/patients/${patientId}/anamnesis`, // real
    RESPONSES: (anamnesisId: string) => `/anamnesis/${anamnesisId}/responses`, // real
  },

  // ─── Schedule ───
  SCHEDULE: {
    MY: "/schedule/my",                       // real — GET {weekly,overrides}, PUT {items:[...]} atomic replace
    ADD_OVERRIDE: "/schedule/my/overrides",   // real — POST, own clinic/doctor resolved server-side
    DELETE_OVERRIDE: (id: string) => `/schedule/my/overrides/${id}`, // real
    SLOTS: (doctorId: string) => `/doctors/${doctorId}/availability`, // real — params: from_date, to_date?, include_unavailable?
    DOCTOR: (doctorId: string) => `/doctors/${doctorId}`,             // real
  },

  // ─── Appointments ───
  APPOINTMENTS: {
    LIST: "/appointments",              // real — GET list, POST create (same path as old)
    UPCOMING: "/appointments/upcoming", // real
    TODAY: "/appointments/today",       // real
    GET: (id: string) => `/appointments/${id}`, // real
    UPDATE: (id: string) => `/appointments/${id}`, // real — PATCH {notes?, patient_complaint?, appointment_type?}
    HISTORY: (id: string) => `/appointments/${id}/audit-log`, // real
    CONFIRM: (id: string) => `/appointments/${id}/status`, // real — PATCH {status:"confirmed"}
    CHECK_IN: (id: string) => `/appointments/${id}/status`, // real — PATCH {status:"checked_in"}
    START: (id: string) => `/appointments/${id}/status`,    // real — PATCH {status:"in_progress"}
    COMPLETE: (id: string) => `/appointments/${id}/status`, // real — PATCH {status:"completed"}
    CANCEL: (id: string) => `/appointments/${id}/status`,   // real — PATCH {status:"cancelled"}
    RESCHEDULE: (id: string) => `/appointments/${id}/reschedule`, // real
    NO_SHOW: (id: string) => `/appointments/${id}/status`,  // real — PATCH {status:"no_show"}
    REQUEST_RESCHEDULE: (id: string) => `/appointments/${id}/request-reschedule`, // real — POST, patient-only
  },

  // ─── Appointment Requests ───
  APPOINTMENT_REQUESTS: {
    LIST: "/appointment-requests",   // real
    CREATE: "/appointment-requests", // real
    GET: (id: string) => `/appointment-requests/${id}`, // real
    APPROVE: (id: string) => `/appointment-requests/${id}/decision`, // real — PATCH {decision:"approved", ...}
    REJECT: (id: string) => `/appointment-requests/${id}/decision`,  // real — PATCH {decision:"rejected", review_notes}
    CANCEL: (id: string) => `/appointment-requests/${id}/decision`,  // real — PATCH {decision:"cancelled_by_patient"}
  },

  // ─── Doctor Notes ───
  // Real backend only supports create + get-by-note-id (session-keyed, many
  // required fields the old payload never had). No list-by-patient, no
  // update. Left pointing at old paths — genuinely no equivalent to map to.
  DOCTOR_NOTES: {
    FOR_PATIENT: (patientId: string) => `/doctor-notes/patient/${patientId}`, // NOT AVAILABLE
    ME: "/doctor-notes/me",                                                   // NOT AVAILABLE
    UPSERT: (patientId: string) => `/doctor-notes/patient/${patientId}`,      // NOT AVAILABLE
  },

  // ─── EEG Reports ───
  EEG: {
    UPLOAD: "/patients", // real base — actual flow is presign+PUT+confirm, composed in eeg.service.ts
    REPORT: (reportId: string) => `/eeg/reports/${reportId}`, // NOT AVAILABLE — no get-by-id-only endpoint
    DOWNLOAD: (reportId: string) => `/files/eeg/${reportId}/download-url`, // real
    PATIENT_REPORTS: (patientId: string) => `/patients/${patientId}/files`, // real — ?doc_type=eeg
    DELETE: (reportId: string) => `/eeg/reports/${reportId}`, // NOT AVAILABLE — no delete endpoint
    // EEG analysis pipeline — NOT AVAILABLE, no backend equivalent at all.
    ANALYZE: "/eeg/analysis/analyze",
    ANALYSIS_STATUS: (jobId: string) => `/eeg/analysis/status/${jobId}`,
    ANALYSIS_DOWNLOAD: (jobId: string, filename: string) => `/eeg/analysis/download/${jobId}/${filename}`,
  },
} as const;
