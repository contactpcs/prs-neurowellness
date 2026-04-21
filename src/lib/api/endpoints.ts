export const ENDPOINTS = {
  // ─── Auth ───
  AUTH: {
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
    ME: "/auth/login",
    SYNC_PROFILE: "/auth/sync-profile",
  },

  // ─── Doctors ───
  DOCTORS: {
    DASHBOARD: "/doctors/dashboard",
    PATIENTS: "/doctors/patients",
    PATIENT: (patientId: string) => `/doctors/patients/${patientId}`,
    GRANT_ASSESSMENT: (patientId: string) => `/doctors/patients/${patientId}/grant-assessment`,
    AVAILABILITY: "/doctors/availability",
  },

  // ─── Patients ───
  PATIENTS: {
    DASHBOARD: "/patients/dashboard",
    MY_DOCTOR: "/patients/my-doctor",
    MY_ASSESSMENTS: "/patients/my-assessments",
  },

  // ─── Staff ───
  STAFF: {
    DASHBOARD: "/staff/dashboard",
    PATIENTS: "/staff/patients",
    PATIENT: (patientId: string) => `/staff/patients/${patientId}`,
    DOCTORS: "/staff/doctors",
    ALLOCATE: (patientId: string) => `/staff/patients/${patientId}/allocate`,
  },

  // ─── Notifications ───
  NOTIFICATIONS: {
    LIST: "/notifications/",
    READ_ALL: "/notifications/read-all",
    READ: (id: string) => `/notifications/${id}/read`,
  },

  // ─── PRS ───
  PRS: {
    // Scales
    SCALES: "/prs/scales/",
    SCALE: (id: string) => `/prs/scales/${id}`,
    SCALE_BY_CODE: (code: string) => `/prs/scales/by-code/${code}`,
    // Conditions
    CONDITIONS: "/prs/conditions/",
    CONDITION: (id: string) => `/prs/conditions/${encodeURIComponent(id)}`,
    // Questions
    QUESTION_OPTIONS: (questionId: string) => `/prs/questions/${questionId}/options`,
    // Permissions
    PERMISSIONS: "/prs/permissions/",
    MY_PERMISSIONS: "/prs/permissions/my",
    PATIENT_PERMISSIONS: (patientId: string) => `/prs/permissions/patient/${patientId}`,
    REVOKE_PERMISSION: (permissionId: string) => `/prs/permissions/${permissionId}/revoke`,
    // Assessment
    ASSESSMENT_START: "/prs/assessment/start",
    ASSESSMENT_SUBMIT: "/prs/assessment/submit",
    ASSESSMENT_SAVE_RESPONSE: "/prs/assessment/save-response",
    ASSESSMENT_RESPONSES: (instanceId: string) => `/prs/assessment/${instanceId}/responses`,
    // Scores
    MY_SCORES: "/prs/scores/me",
    MY_SCORES_SUMMARY: "/prs/scores/me/summary",
    INSTANCE_SCORE: (instanceId: string) => `/prs/scores/instance/${instanceId}`,
    PATIENT_SCORES: (patientId: string) => `/prs/scores/patient/${patientId}`,
    PATIENT_SCORES_SUMMARY: (patientId: string) => `/prs/scores/patient/${patientId}/summary`,
    // Sessions (legacy — kept for existing session-based flows)
    SESSIONS: "/prs/sessions",
    MY_SESSIONS: "/prs/sessions/my",
    PATIENT_SESSIONS: (patientId: string) => `/prs/sessions/patient/${patientId}`,
    SESSION: (id: string) => `/prs/sessions/${id}`,
    START_SESSION: (id: string) => `/prs/sessions/${id}/start`,
    CANCEL_SESSION: (id: string) => `/prs/sessions/${id}/cancel`,
    SESSION_RESPONSES: (sessionId: string) => `/prs/sessions/${sessionId}/responses`,
    AUTO_SAVE: (sessionId: string, scaleId: string) =>
      `/prs/sessions/${sessionId}/responses/${scaleId}/auto-save`,
    SUBMIT_RESPONSE: (sessionId: string, scaleId: string) =>
      `/prs/sessions/${sessionId}/responses/${scaleId}/submit`,
    CLINICIAN_RATING: (sessionId: string, scaleId: string) =>
      `/prs/sessions/${sessionId}/responses/${scaleId}/clinician-rating`,
    CONSENT: (sessionId: string) => `/prs/sessions/${sessionId}/consent`,
    CONSENTS: (sessionId: string) => `/prs/sessions/${sessionId}/consents`,
    MY_ALERTS: "/prs/alerts/my",
    PATIENT_ALERTS: (patientId: string) => `/prs/alerts/patient/${patientId}`,
    ACKNOWLEDGE_ALERT: (id: string) => `/prs/alerts/${id}/acknowledge`,
    RESOLVE_ALERT: (id: string) => `/prs/alerts/${id}/resolve`,
    SCORE_HISTORY: (patientId: string) => `/prs/history/${patientId}`,
  },
} as const;
