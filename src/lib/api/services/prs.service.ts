import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type {
  Scale,
  ConditionBattery,
  AssessmentSession,
  ScaleResponse,
  RiskAlert,
  ScoreHistory,
} from "@/types/prs.types";

export const prsService = {
  // ─── Scales ───
  async getScales(): Promise<{ scales: Scale[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.SCALES);
    return data;
  },

  async getScale(scaleId: string): Promise<Scale> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.SCALE(scaleId));
    return data;
  },

  // ─── Conditions ───
  async getConditions(): Promise<{ conditions: ConditionBattery[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.CONDITIONS);
    return data;
  },

  async getCondition(conditionId: string): Promise<ConditionBattery> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.CONDITION(conditionId));
    return data;
  },

  // ─── Sessions ───
  async createSession(payload: {
    patient_id: string;
    condition_id?: string;
    custom_scale_ids?: string[];
    title?: string;
    clinical_notes?: string;
    patient_instructions?: string;
    mode?: string;
    due_date?: string;
  }): Promise<AssessmentSession> {
    const { data } = await apiClient.post(ENDPOINTS.PRS.SESSIONS, payload);
    return data;
  },

  async getMySessions(): Promise<{ sessions: AssessmentSession[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.MY_SESSIONS);
    return data;
  },

  async getPatientSessions(patientId: string): Promise<{ sessions: AssessmentSession[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.PATIENT_SESSIONS(patientId));
    return data;
  },

  async getSession(sessionId: string): Promise<AssessmentSession> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.SESSION(sessionId));
    return data;
  },

  async startSession(sessionId: string): Promise<AssessmentSession> {
    const { data } = await apiClient.patch(ENDPOINTS.PRS.START_SESSION(sessionId));
    return data;
  },

  async cancelSession(sessionId: string): Promise<AssessmentSession> {
    const { data } = await apiClient.patch(ENDPOINTS.PRS.CANCEL_SESSION(sessionId));
    return data;
  },

  // ─── Responses ───
  async autoSave(sessionId: string, scaleId: string, questionIndex: number, value: number | string): Promise<void> {
    await apiClient.patch(ENDPOINTS.PRS.AUTO_SAVE(sessionId, scaleId), {
      question_index: questionIndex,
      value,
    });
  },

  async submitResponse(sessionId: string, scaleId: string, responses: Record<string, number | string>): Promise<{
    response: ScaleResponse;
    score: Record<string, unknown>;
    risk_alerts_created: number;
    session_completed: boolean;
  }> {
    const { data } = await apiClient.post(ENDPOINTS.PRS.SUBMIT_RESPONSE(sessionId, scaleId), { responses });
    return data;
  },

  async submitClinicianRating(sessionId: string, scaleId: string, responses: Record<string, number | string>, clinicianNotes?: string): Promise<unknown> {
    const { data } = await apiClient.post(ENDPOINTS.PRS.CLINICIAN_RATING(sessionId, scaleId), {
      responses,
      clinician_notes: clinicianNotes,
    });
    return data;
  },

  // ─── Consent ───
  async recordConsent(sessionId: string, consentType: string, consented: boolean, consentText?: string): Promise<void> {
    await apiClient.post(ENDPOINTS.PRS.CONSENT(sessionId), {
      consent_type: consentType,
      consented,
      consent_text: consentText,
    });
  },

  // ─── Alerts ───
  async getMyAlerts(status?: string): Promise<{ alerts: RiskAlert[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.MY_ALERTS, { params: { status } });
    return data;
  },

  async getPatientAlerts(patientId: string, status?: string): Promise<{ alerts: RiskAlert[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.PATIENT_ALERTS(patientId), { params: { status } });
    return data;
  },

  async acknowledgeAlert(alertId: string): Promise<RiskAlert> {
    const { data } = await apiClient.patch(ENDPOINTS.PRS.ACKNOWLEDGE_ALERT(alertId));
    return data;
  },

  async resolveAlert(alertId: string, resolutionNotes: string): Promise<RiskAlert> {
    const { data } = await apiClient.patch(ENDPOINTS.PRS.RESOLVE_ALERT(alertId), {
      resolution_notes: resolutionNotes,
    });
    return data;
  },

  // ─── Score History ───
  async getScoreHistory(patientId: string, scaleId?: string): Promise<{ history: ScoreHistory[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.SCORE_HISTORY(patientId), { params: { scale_id: scaleId } });
    return data;
  },
};
