import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";

// POST /prs-assessment-instances returns the full AssessmentStartRead
// (instance_id, is_resumed, scales[] each with questions[] incl. options[])
// and resumes an in-progress instance instead of duplicating. Saved answers
// are restorable via GET /prs-assessment-instances/{id}/responses. The only
// remaining gap is a per-question options endpoint — options now arrive
// embedded in each question, so getQuestionOptions stays a stub.

type ApiSuccessResponse<T> = {
  success: boolean;
  message: string;
  data: T;
  meta?: unknown;
};

function unwrap<T>(payload: unknown): T {
  const maybe = payload as Partial<ApiSuccessResponse<T>>;
  if (maybe && typeof maybe === "object" && "data" in maybe) {
    return maybe.data as T;
  }
  return payload as T;
}

export type PrsConditionScale = {
  scale_id: string;
  scale_code: string;
  scale_name: string;
  display_order?: number;
};

export type PrsConditionDetails = {
  disease_id: string;
  disease_name?: string;
  description?: string;
  scales: PrsConditionScale[];
} & Record<string, unknown>;

export type PrsAssessmentQuestion = {
  question_id: string;
  question_text: string;
  answer_type: string;
  min_value?: number | null;
  max_value?: number | null;
  is_required?: boolean;
  skip_logic?: unknown;
  display_order?: number;
  question_index: number;
  options?: PrsQuestionOption[];
};

export type PrsAssessmentScaleResult = {
  scale_id: string;
  scale_code?: string;
  scale_name?: string;
  display_order?: number;
  questions: PrsAssessmentQuestion[];
  is_completed?: boolean;
};

export type PrsAssessmentStartResult = {
  instance_id: string;
  is_resumed?: boolean;
  scales: PrsAssessmentScaleResult[];
};

export type PrsSavedResponse = {
  response_id: string;
  question_id: string;
  given_response: string;
  response_value: number | null;
};

export type PrsInstanceResponses = {
  instance_id: string;
  status: string;
  responses_count: number;
  responses: PrsSavedResponse[];
  responses_by_qid: Record<string, PrsSavedResponse>;
};

export type PrsQuestionOption = {
  option_id: string;
  value: string;
  label: string;
  points?: number;
  display_order?: number;
};

export type PrsQuestionOptionsResult = {
  question_id: string;
  answer_type: string;
  is_required: boolean;
  min?: number;
  max?: number;
  options: PrsQuestionOption[];
};

export const prsAssessmentService = {
  /** Composed from GET /prs-catalog/diseases — each disease row now carries
   * its scales[] (scale_id, scale_code, scale_name, full_name, short_name). */
  async getConditionDetails(conditionId: string): Promise<PrsConditionDetails> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.CONDITIONS);
    const list = unwrap<Record<string, unknown>[]>(data);
    const match = Array.isArray(list)
      ? list.find((d) => d.disease_id === conditionId)
      : undefined;
    if (!match) return { disease_id: conditionId, scales: [] };
    return {
      ...match,
      disease_id: conditionId,
      scales: Array.isArray(match.scales) ? (match.scales as PrsConditionScale[]) : [],
    };
  },

  /** Real endpoint (POST /prs-assessment-instances) needs assessment_stage,
   * which the old payload never carried — defaulted to "main_clinical".
   * Returns AssessmentStartRead: resumes an in-progress instance
   * (is_resumed: true) instead of duplicating, and carries the full
   * scales → questions → options tree in one call. */
  async startAssessment(payload: {
    disease_id: string;
    taken_by: "patient" | "doctor_on_behalf";
    patient_id?: string;
    session_id?: string;
    cycle_id?: string;
  }): Promise<PrsAssessmentStartResult> {
    if (!payload.patient_id) throw new Error("patient_id is required to start an assessment.");
    const { data } = await apiClient.post(ENDPOINTS.PRS.ASSESSMENT_START, {
      patient_id: payload.patient_id,
      disease_id: payload.disease_id,
      assessment_stage: "main_clinical",
      ...(payload.session_id ? { session_id: payload.session_id } : {}),
      ...(payload.cycle_id ? { cycle_id: payload.cycle_id } : {}),
    });
    const result = unwrap<PrsAssessmentStartResult>(data);
    return {
      instance_id: result.instance_id,
      is_resumed: result.is_resumed ?? false,
      scales: Array.isArray(result.scales) ? result.scales : [],
    };
  },

  /** Real: POST /prs-assessment-instances with assessment_stage=general_registration
   * — used by the self-registration wizard's PRS step, separate from
   * startAssessment() above (which hardcodes main_clinical for the doctor
   * flow, not touched here). */
  async startGeneralRegistrationAssessment(patientId: string, diseaseId: string): Promise<{ instance_id: string }> {
    const { data } = await apiClient.post(ENDPOINTS.PRS.ASSESSMENT_START, {
      patient_id: patientId,
      disease_id: diseaseId,
      assessment_stage: "general_registration",
    });
    return { instance_id: data.instance_id };
  },

  // NOT AVAILABLE — no per-question options endpoint.
  async getQuestionOptions(questionId: string): Promise<PrsQuestionOptionsResult> {
    return { question_id: questionId, answer_type: "text", is_required: false, options: [] };
  },

  /** Real endpoint has no scale_id/question_index/label fields — only
   * question_id + given_response. */
  async saveResponse(
    instanceId: string,
    _scaleId: string,
    _questionIndex: number,
    questionId: string,
    value: number | string,
    _label?: string | null
  ): Promise<void> {
    await apiClient.post(ENDPOINTS.PRS.ASSESSMENT_SAVE_RESPONSE(instanceId), {
      responses: [{ question_id: questionId, given_response: String(value) }],
    });
  },

  /** Real: GET /prs-assessment-instances/{id}/responses — returns saved
   * ResponseRead[], used to restore answers when resuming an instance. */
  async getResponses(instanceId: string): Promise<PrsInstanceResponses> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.ASSESSMENT_RESPONSES(instanceId));
    const raw = unwrap<unknown>(data);
    const list: PrsSavedResponse[] = Array.isArray(raw)
      ? (raw as PrsSavedResponse[])
      : Array.isArray((raw as { responses?: unknown })?.responses)
        ? ((raw as { responses: PrsSavedResponse[] }).responses)
        : [];
    const byQid: Record<string, PrsSavedResponse> = {};
    for (const r of list) byQid[r.question_id] = r;
    return {
      instance_id: (raw as { instance_id?: string })?.instance_id ?? instanceId,
      status: (raw as { status?: string })?.status ?? "in_progress",
      responses_count: list.length,
      responses: list,
      responses_by_qid: byQid,
    };
  },

  /** Old `responses` keys were question_index numbers (never real question_ids,
   * since no question catalog was ever fetched for scales) — passed through
   * as question_id best-effort, but they won't match the real catalog's ids. */
  async submitAssessment(
    instanceId: string,
    scaleId: string,
    responses: Record<string, number | string>
  ): Promise<unknown> {
    const responseList = Object.entries(responses).map(([question_id, v]) => ({
      question_id,
      given_response: String(v),
    }));
    const { data } = await apiClient.post(ENDPOINTS.PRS.ASSESSMENT_SUBMIT(instanceId), {
      responses: responseList,
      finalize_scale_id: scaleId,
    });
    return unwrap<unknown>(data);
  },
};
