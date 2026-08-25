import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { AnamnesisRecord } from "@/types/domain.types";

export type AnamnesisStartPayload = {
  patient_id: string;
  taken_by: "patient" | "doctor_on_behalf";
  assessment_stage: "general_registration" | "main_clinical";
  /** The visit this anamnesis is being captured/edited during, for the
   *  doctor portal's per-visit bundle. Omit when taken outside a visit. */
  appointment_id?: string | null;
};

export type AnamnesisSaveResponsePayload = {
  anamnesis_id: string;
  question_id: string;
  response_value?: string | null;
  response_values?: string[] | null;
};

export type AnamnesisResponseItem = {
  question_id: string;
  response_value?: string | null;
  response_values?: string[] | null;
};

export type AnamnesisSavePayload = {
  anamnesis_id: string;
  chief_complaint?: string | null;
  main_symptoms?: string | null;
  initial_symptoms?: string | null;
  diagnosis_related?: boolean | null;
  diagnosis_details?: string | null;
  symptoms_start?: string | null;
  symptoms_duration?: string | null;
  symptoms_frequency?: string | null;
  symptoms_intensity?: string | null;
  symptoms_progression?: string | null;
  secondary_symptoms?: string[] | null;
  secondary_symptoms_details?: string | null;
  has_operations?: boolean | null;
  operations_details?: string | null;
  previous_treatments?: string | null;
  current_medications?: string | null;
  has_brain_mri?: boolean | null;
  mri_details?: string | null;
  other_scans?: string | null;
  has_neuromodulation?: boolean | null;
  neuromodulation_details?: string | null;
};

export type AnamnesisSubmitPayload = {
  anamnesis_id: string;
  responses?: AnamnesisResponseItem[] | null;
};

export type AnamnesisQuestion = {
  question_id: string;
  section_number: number;
  section_title: string;
  question_code: string;
  question_text: string;
  answer_type: string;
  is_required: boolean;
  display_order: number;
  depends_on_question_id?: string | null;
  depends_on_value?: string | null;
  helper_text?: string | null;
  options: Array<{
    option_id: string;
    option_label: string;
    option_value: string;
    display_order: number;
  }>;
};

export const anamnesisService = {
  // Real GET /anamnesis-catalog shape matches this directly.
  async getQuestions(): Promise<AnamnesisQuestion[]> {
    const { data } = await apiClient.get(ENDPOINTS.ANAMNESIS.QUESTIONS);
    return Array.isArray(data) ? data : [];
  },

  async start(payload: AnamnesisStartPayload): Promise<{ anamnesis_id: string; status: "in_progress" | "completed"; resumed: boolean }> {
    const { data } = await apiClient.post(ENDPOINTS.ANAMNESIS.START(payload.patient_id), {
      taken_by: payload.taken_by,
      assessment_stage: payload.assessment_stage,
      appointment_id: payload.appointment_id ?? undefined,
    });
    return { anamnesis_id: data.anamnesis_id, status: data.status, resumed: false };
  },

  // Real backend has no per-response save — adapted to a single-item PATCH batch.
  async saveResponse(payload: AnamnesisSaveResponsePayload): Promise<{ response_id: string }> {
    await apiClient.patch(ENDPOINTS.ANAMNESIS.SAVE_RESPONSE(payload.anamnesis_id), {
      responses: [{
        question_id: payload.question_id,
        response_value: payload.response_value ?? undefined,
        response_values: payload.response_values ?? undefined,
      }],
      complete: false,
    });
    return { response_id: "" };
  },

  /** NOTE: this maps old fixed field names (chief_complaint, etc.) to
   * hardcoded question_id codes (q_chief_complaint, ...) that were specific
   * to the OLD backend's anamnesis catalog. The real backend-v2 catalog has
   * its own question_id values (from `/anamnesis-catalog`) which almost
   * certainly don't match these codes — this method will silently save
   * nothing meaningful until the real question_ids are substituted in. */
  async save(payload: AnamnesisSavePayload): Promise<AnamnesisRecord> {
    const responses: AnamnesisSaveResponsePayload[] = [];

    const fieldToQuestion: Record<string, string> = {
      chief_complaint: "q_chief_complaint",
      main_symptoms: "q_main_symptoms",
      initial_symptoms: "q_initial_symptoms",
      diagnosis_related: "q_diagnosis_related",
      diagnosis_details: "q_diagnosis_details",
      symptoms_start: "q_symptoms_start",
      symptoms_duration: "q_symptoms_duration",
      symptoms_frequency: "q_symptoms_frequency",
      symptoms_intensity: "q_symptoms_intensity",
      symptoms_progression: "q_symptoms_progression",
      secondary_symptoms: "q_secondary_symptoms",
      secondary_symptoms_details: "q_secondary_details",
      has_operations: "q_has_operations",
      operations_details: "q_operations_details",
      previous_treatments: "q_previous_treatments",
      current_medications: "q_current_medications",
      has_brain_mri: "q_has_brain_mri",
      mri_details: "q_mri_details",
      other_scans: "q_other_scans",
      has_neuromodulation: "q_has_neuromodulation",
      neuromodulation_details: "q_neuromodulation_details",
    };

    for (const [field, questionId] of Object.entries(fieldToQuestion)) {
      const value = payload[field as keyof AnamnesisSavePayload];
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          responses.push({ anamnesis_id: payload.anamnesis_id, question_id: questionId, response_values: value });
        } else if (typeof value === "boolean") {
          responses.push({ anamnesis_id: payload.anamnesis_id, question_id: questionId, response_value: value ? "yes" : "no" });
        } else {
          responses.push({ anamnesis_id: payload.anamnesis_id, question_id: questionId, response_value: String(value) });
        }
      }
    }

    for (const resp of responses) {
      try {
        await this.saveResponse(resp);
      } catch (e) {
        console.error(`Failed to save response for ${resp.question_id}:`, e);
      }
    }

    return {
      anamnesis_id: payload.anamnesis_id,
      patient_id: "",
      status: "in_progress",
      taken_by: "patient",
      responses: [],
    } as unknown as AnamnesisRecord;
  },

  async submit(payload: AnamnesisSubmitPayload): Promise<AnamnesisRecord> {
    const { data } = await apiClient.patch(ENDPOINTS.ANAMNESIS.SUBMIT(payload.anamnesis_id), {
      responses: payload.responses ?? [],
      complete: true,
    });
    return data;
  },

  // NOT AVAILABLE directly — resolved via the caller's own /patients record first.
  async getMyAnamnesis(): Promise<AnamnesisRecord> {
    const patientsRes = await apiClient.get(ENDPOINTS.PATIENTS.DASHBOARD);
    const own = Array.isArray(patientsRes.data) ? patientsRes.data[0] : undefined;
    if (!own?.patient_id) throw new Error("No patient record found for the current user.");
    const { data } = await apiClient.get(ENDPOINTS.ANAMNESIS.FOR_PATIENT(own.patient_id));
    return withResponses(data);
  },

  async getForPatient(patientId: string, assessmentStage?: "general_registration" | "main_clinical"): Promise<AnamnesisRecord | null> {
    try {
      const { data } = await apiClient.get(ENDPOINTS.ANAMNESIS.FOR_PATIENT(patientId), {
        params: assessmentStage ? { assessment_stage: assessmentStage } : undefined,
      });
      return withResponses(data);
    } catch (err: unknown) {
      if ((err as { response?: { status?: number } })?.response?.status === 404) return null;
      throw err;
    }
  },
};

/** GET /patients/{id}/anamnesis (and the per-visit summary endpoint) return
 * the assessment row only — saved answers live at GET /anamnesis/{id}/responses.
 * Merge them so consumers get a hydratable record in one call.
 * Response-fetch failures degrade to an answerless record rather than
 * failing the whole load. Exported so usePatientVisitSummary can hydrate
 * the visit-scoped anamnesis the same way. */
export async function withResponses(record: AnamnesisRecord): Promise<AnamnesisRecord> {
  if (!record?.anamnesis_id) return record;
  try {
    const { data } = await apiClient.get(ENDPOINTS.ANAMNESIS.RESPONSES(record.anamnesis_id));
    return { ...record, responses: Array.isArray(data) ? data : [] };
  } catch {
    return record;
  }
}
