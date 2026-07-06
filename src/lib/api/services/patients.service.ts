import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { PatientDashboard, AssessmentPermission } from "@/types/domain.types";

export const patientsService = {
  /** NOT AVAILABLE as a single aggregate — composed from /auth/me (name/email,
   * which /patients never returns — PatientRead has no profile fields joined)
   * and /patients (RLS-scoped to the caller's own record, for the id). */
  async getDashboard(): Promise<PatientDashboard> {
    const [meRes, patientsRes] = await Promise.all([
      apiClient.get(ENDPOINTS.AUTH.ME),
      apiClient.get(ENDPOINTS.PATIENTS.DASHBOARD),
    ]);
    const me = meRes.data as { id: string; first_name: string; last_name: string; email: string };
    const own = Array.isArray(patientsRes.data) ? patientsRes.data[0] : undefined;
    return {
      profile: {
        id: (own?.patient_id as string) ?? me.id,
        full_name: `${me.first_name} ${me.last_name}`.trim(),
        first_name: me.first_name,
        last_name: me.last_name,
        email: me.email,
      },
    };
  },

  // NOT AVAILABLE — no doctor-lookup endpoint reachable from the patient role.
  async getMyDoctor(): Promise<{ id: string; first_name: string; last_name: string; specialization?: string; phone?: string }> {
    throw new Error("Doctor lookup isn't available yet.");
  },

  /** Real: POST /patients/{patient_id}/disease-selection — patientId here is
   * patients.patient_id (public ID), not the profile id. Used by the
   * self-registration wizard's disease-selection step. */
  async selectDisease(patientId: string, diseaseId: string): Promise<void> {
    await apiClient.post(ENDPOINTS.PATIENTS.DISEASE_SELECTION(patientId), { disease_id: diseaseId, is_primary: true });
  },

  /** Real: GET /patients/{patient_id}/disease-selection — used as a fallback
   * when the self-registration wizard's PRS step can't find the disease_id
   * it cached in localStorage (e.g. cleared, or a re-login on a fresh
   * session after localStorage was already cleaned up post-completion). */
  async getPrimaryDiseaseSelection(patientId: string): Promise<{ disease_id: string | null } | null> {
    const { data } = await apiClient.get(ENDPOINTS.PATIENTS.DISEASE_SELECTION(patientId));
    if (!Array.isArray(data) || data.length === 0) return null;
    const primary = data.find((d: { is_primary?: boolean }) => d.is_primary) ?? data[0];
    return { disease_id: primary.disease_id ?? null };
  },

  // NOT AVAILABLE — scale-assignments carry no disease grouping (scale_id/assessment_stage only, no disease_id).
  async getMyAssessments(): Promise<{ permissions: AssessmentPermission[]; total: number }> {
    return { permissions: [], total: 0 };
  },

  /** Real: GET /patients/{patient_id}/scale-assignments?assessment_stage=
   * Used by the self-registration wizard's PRS step to find which scales
   * were auto-assigned off the patient's disease selection. */
  async getScaleAssignments(patientId: string, assessmentStage: string): Promise<{ scale_id: string }[]> {
    const { data } = await apiClient.get(`/patients/${patientId}/scale-assignments`, {
      params: { assessment_stage: assessmentStage },
    });
    return Array.isArray(data) ? data : [];
  },
};
