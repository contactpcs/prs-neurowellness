export const ENDPOINTS = {
  AUTH: {
    LOGIN: "/auth/login",
    REGISTER: "/auth/register",
  },
  PRS: {
    HEALTH: "/prs/health",
    SCALES: "/prs/scales",
    SCALE: (id: string) => `/prs/scales/${id}`,
    SCALE_BY_CODE: (code: string) => `/prs/scales/by-code/${code}`,
    CONDITIONS: "/prs/conditions",
    CONDITION: (id: string) => `/prs/conditions/${id}`,
    ASSESSMENT_START: "/prs/assessment/start",
    QUESTION_OPTIONS: (questionId: string) => `/prs/questions/${questionId}/options`,
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
  PATIENTS: {
    LIST: "/patients",
    DETAIL: (id: string) => `/patients/${id}`,
  },
} as const;
