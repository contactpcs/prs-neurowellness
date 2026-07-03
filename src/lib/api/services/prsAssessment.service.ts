import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";

// GAP: backend-v2's PRS module has no endpoint that returns a scale's
// question list (confirmed against app/modules/prs/router.py — only
// diseases list, patient-scale-assignments, and prs-assessment-instances
// start/get/responses/results exist). Methods that need per-question data
// (getConditionDetails, getQuestionOptions, and the `scales`/`questions`
// fields of startAssessment/getResponses) cannot be filled from a real
// source — they return empty rather than fabricated data.

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
  // NOT AVAILABLE — no per-disease scale/question detail endpoint.
  async getConditionDetails(conditionId: string): Promise<PrsConditionDetails> {
    return { disease_id: conditionId, scales: [] };
  },

  /** Real endpoint (POST /prs-assessment-instances) needs assessment_stage,
   * which the old payload never carried — defaulted to "main_clinical".
   * `scales` comes back empty (see file-level GAP note above); the instance
   * itself is real and usable for submitAssessment/getResponses. */
  async startAssessment(payload: {
    disease_id: string;
    taken_by: "patient" | "doctor_on_behalf";
    patient_id?: string;
  }): Promise<PrsAssessmentStartResult> {
    if (!payload.patient_id) throw new Error("patient_id is required to start an assessment.");
    const { data } = await apiClient.post(ENDPOINTS.PRS.ASSESSMENT_START, {
      patient_id: payload.patient_id,
      disease_id: payload.disease_id,
      assessment_stage: "main_clinical",
    });
    return { instance_id: data.instance_id, is_resumed: false, scales: [] };
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

  // NOT AVAILABLE as a separate responses list — only the instance record itself is fetchable.
  async getResponses(instanceId: string): Promise<PrsInstanceResponses> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.ASSESSMENT_RESPONSES(instanceId));
    return {
      instance_id: data.instance_id ?? instanceId,
      status: data.status ?? "in_progress",
      responses_count: 0,
      responses: [],
      responses_by_qid: {},
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
