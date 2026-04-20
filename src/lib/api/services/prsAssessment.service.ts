import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";

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

export type PrsAssessmentStartResult = {
  instance_id: string;
  scale: Record<string, unknown> & {
    scale_id: string;
    scale_code?: string;
    scale_name?: string;
    questions: PrsAssessmentQuestion[];
  };
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
  async getConditionDetails(conditionId: string): Promise<PrsConditionDetails> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.CONDITION(conditionId));
    return unwrap<PrsConditionDetails>(data);
  },

  async startAssessment(payload: {
    scale_id: string;
    disease_id?: string;
    taken_by: "patient" | "doctor_on_behalf";
    patient_id?: string;
    include_options?: boolean;
  }): Promise<PrsAssessmentStartResult> {
    const { data } = await apiClient.post(ENDPOINTS.PRS.ASSESSMENT_START, payload);
    return unwrap<PrsAssessmentStartResult>(data);
  },

  async getQuestionOptions(questionId: string): Promise<PrsQuestionOptionsResult> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.QUESTION_OPTIONS(questionId));
    return unwrap<PrsQuestionOptionsResult>(data);
  },

  async saveResponse(
    instanceId: string,
    scaleId: string,
    questionIndex: number,
    questionId: string,
    value: number | string,
    label?: string | null
  ): Promise<void> {
    await apiClient.post(ENDPOINTS.PRS.ASSESSMENT_SAVE_RESPONSE, {
      instance_id: instanceId,
      scale_id: scaleId,
      question_index: questionIndex,
      question_id: questionId,
      response_value: String(value),
      response_label: label ?? undefined,
    });
  },

  async submitAssessment(
    instanceId: string,
    scaleId: string,
    responses: Record<string, number | string>
  ): Promise<unknown> {
    const responseList = Object.entries(responses)
      .map(([idx, v]) => ({
        question_index: Number(idx),
        response_value: String(v),
      }))
      .filter((r) => Number.isFinite(r.question_index));

    const { data } = await apiClient.post(ENDPOINTS.PRS.ASSESSMENT_SUBMIT, {
      instance_id: instanceId,
      scale_id: scaleId,
      responses: responseList,
    });
    return unwrap<unknown>(data);
  },
};
