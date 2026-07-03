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

type BackendEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
};

function unwrapEnvelope<T>(payload: unknown): unknown {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as BackendEnvelope<T>).data;
  }
  return payload;
}

function extractScaleIds(item: unknown): string[] {
  if (!item || typeof item !== "object") return [];

  const maybeScaleIds = (item as { scale_ids?: unknown }).scale_ids;
  if (Array.isArray(maybeScaleIds) && maybeScaleIds.every((x) => typeof x === "string")) {
    return maybeScaleIds;
  }

  const maybeScales = (item as { scales?: unknown }).scales;
  if (!Array.isArray(maybeScales)) return [];

  return maybeScales
    .map((s) => {
      if (!s || typeof s !== "object") return null;
      const scaleId = (s as { scale_id?: unknown }).scale_id;
      const id = (s as { id?: unknown }).id;
      if (typeof scaleId === "string") return scaleId;
      if (typeof id === "string") return id;
      return null;
    })
    .filter((x): x is string => Boolean(x));
}

function normalizeDiseaseToConditionBattery(item: unknown, index: number): ConditionBattery | null {
  if (!item || typeof item !== "object") return null;

  const obj = item as Record<string, unknown>;

  const diseaseId =
    (typeof obj.disease_id === "string" && obj.disease_id) ||
    (typeof obj.condition_id === "string" && obj.condition_id) ||
    (typeof obj.id === "string" && obj.id) ||
    null;

  if (!diseaseId) return null;

  const label =
    (typeof obj.disease_name === "string" && obj.disease_name) ||
    (typeof obj.label === "string" && obj.label) ||
    (typeof obj.disease_code === "string" && obj.disease_code) ||
    diseaseId;

  const description =
    (typeof obj.description === "string" && obj.description) ||
    (typeof obj.disease_description === "string" && obj.disease_description) ||
    null;

  const isActiveRaw = obj.status ?? obj.is_active;
  const is_active = typeof isActiveRaw === "boolean" ? isActiveRaw : true;

  const displayOrderRaw = obj.display_order;
  const display_order = typeof displayOrderRaw === "number" ? displayOrderRaw : index;

  const scale_ids = extractScaleIds(obj);
  const scalesRaw = (obj as { scales?: unknown }).scales;
  const scales = Array.isArray(scalesRaw) ? (scalesRaw as Scale[]) : undefined;

  return {
    id: diseaseId,
    condition_id: diseaseId,
    label,
    description,
    scale_ids,
    scales,
    is_active,
    display_order,
  };
}

function normalizeConditionsList(payload: unknown): { conditions: ConditionBattery[]; total: number } {
  // Legacy shape: { conditions: [...], total: number }
  if (payload && typeof payload === "object" && "conditions" in payload) {
    const conds = (payload as { conditions?: unknown }).conditions;
    const total = (payload as { total?: unknown }).total;
    if (Array.isArray(conds)) {
      return {
        conditions: conds as ConditionBattery[],
        total: typeof total === "number" ? total : conds.length,
      };
    }
  }

  // New shape: envelope or direct array under `data`
  const unwrapped = unwrapEnvelope<unknown[]>(payload);
  if (Array.isArray(unwrapped)) {
    const conditions = unwrapped
      .map((item, idx) => normalizeDiseaseToConditionBattery(item, idx))
      .filter((x): x is ConditionBattery => Boolean(x));
    return { conditions, total: conditions.length };
  }

  return { conditions: [], total: 0 };
}

function normalizeConditionDetail(payload: unknown): ConditionBattery {
  const unwrapped = unwrapEnvelope<unknown>(payload);

  // If it already looks like a ConditionBattery, return as-is.
  if (unwrapped && typeof unwrapped === "object" && "condition_id" in unwrapped && "label" in unwrapped) {
    return unwrapped as ConditionBattery;
  }

  const mapped = normalizeDiseaseToConditionBattery(unwrapped, 0);
  return (
    mapped ??
    ({
      id: "unknown",
      condition_id: "unknown",
      label: "Unknown Condition",
      description: null,
      scale_ids: [],
      is_active: true,
      display_order: 0,
    } as ConditionBattery)
  );
}

// backend-v2's PRS module has no scales/sessions/alerts/clinician-rating/
// score-history subsystem at all (confirmed against app/modules/prs/router.py
// — it only exposes: diseases list, patient-scale-assignments, and
// prs-assessment-instances start/get/responses/results). Every method below
// with no real equivalent throws instead of hitting a dead endpoint.
const NOT_AVAILABLE = "This PRS feature (sessions/scales-catalog/clinician-rating/risk-alerts/score-history) has no backend-v2 equivalent.";

export const prsService = {
  async getScales(): Promise<{ scales: Scale[]; total: number }> { throw new Error(NOT_AVAILABLE); },
  async getScale(_scaleId: string): Promise<Scale> { throw new Error(NOT_AVAILABLE); },

  // ─── Conditions — real endpoint, existing normalizer already handles the raw disease_id/disease_name shape ───
  async getConditions(): Promise<{ conditions: ConditionBattery[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.CONDITIONS);
    return normalizeConditionsList(data);
  },

  async getCondition(_conditionId: string): Promise<ConditionBattery> { throw new Error(NOT_AVAILABLE); },

  /** Real: GET /prs-catalog/scale-questions?scale_id= — used by the
   * self-registration wizard's PRS step (no scale/question catalog UI
   * existed anywhere in the app before this). */
  async getScaleQuestions(scaleId: string): Promise<{
    question_id: string; question_text: string; answer_type: string;
    min_value: number | null; max_value: number | null; is_required: boolean; display_order: number;
  }[]> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.SCALE_QUESTIONS, { params: { scale_id: scaleId } });
    return Array.isArray(data) ? data : [];
  },

  async createSession(_payload?: Record<string, unknown>): Promise<AssessmentSession> { throw new Error(NOT_AVAILABLE); },
  async getMySessions(_params?: { skip?: number; limit?: number }): Promise<{ sessions: AssessmentSession[]; total: number }> { return { sessions: [], total: 0 }; },
  async getPatientSessions(_patientId: string, _params?: { skip?: number; limit?: number }): Promise<{ sessions: AssessmentSession[]; total: number }> { return { sessions: [], total: 0 }; },
  async getSession(_sessionId: string): Promise<AssessmentSession> { throw new Error(NOT_AVAILABLE); },
  async startSession(_sessionId: string): Promise<AssessmentSession> { throw new Error(NOT_AVAILABLE); },
  async cancelSession(_sessionId: string): Promise<AssessmentSession> { throw new Error(NOT_AVAILABLE); },
  async autoSave(_sessionId: string, _scaleId: string, _questionIndex: number, _value: number | string): Promise<void> { throw new Error(NOT_AVAILABLE); },
  async submitResponse(_sessionId: string, _scaleId: string, _responses: Record<string, number | string>): Promise<{ response: ScaleResponse; score: Record<string, unknown>; risk_alerts_created: number; session_completed: boolean }> { throw new Error(NOT_AVAILABLE); },
  async submitClinicianRating(_sessionId: string, _scaleId: string, _responses: Record<string, number | string>, _clinicianNotes?: string): Promise<unknown> { throw new Error(NOT_AVAILABLE); },
  async recordConsent(_sessionId: string, _consentType: string, _consented: boolean, _consentText?: string): Promise<void> { throw new Error(NOT_AVAILABLE); },
  async getMyAlerts(_status?: string): Promise<{ alerts: RiskAlert[]; total: number }> { return { alerts: [], total: 0 }; },
  async getPatientAlerts(_patientId: string, _status?: string): Promise<{ alerts: RiskAlert[]; total: number }> { return { alerts: [], total: 0 }; },
  async acknowledgeAlert(_alertId: string): Promise<RiskAlert> { throw new Error(NOT_AVAILABLE); },
  async resolveAlert(_alertId: string, _resolutionNotes: string): Promise<RiskAlert> { throw new Error(NOT_AVAILABLE); },
  async getScoreHistory(_patientId: string, _scaleId?: string): Promise<{ history: ScoreHistory[]; total: number }> { return { history: [], total: 0 }; },
};
