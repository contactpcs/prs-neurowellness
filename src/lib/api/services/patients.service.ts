import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { PatientDashboard, AssessmentPermission } from "@/types/domain.types";

export const patientsService = {
  /** NOT AVAILABLE as a single aggregate — composed from /auth/me (name/email)
   * and /patients (RLS-scoped to the caller's own record, which also joins
   * the assigned doctor's name/phone/specialization off primary_doctor_id). */
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
        phone: own?.phone as string | undefined,
        date_of_birth: own?.dob as string | undefined,
        gender: own?.gender as string | undefined,
        address: own?.address as string | undefined,
        city: own?.city as string | undefined,
        state: own?.state as string | undefined,
        country: own?.country as string | undefined,
        pincode: own?.pincode as string | undefined,
      },
      assigned_doctor: own?.primary_doctor_id ? {
        id: own.primary_doctor_id as string,
        full_name: (own.doctor_name as string) ?? "",
        first_name: (own.doctor_first_name as string) ?? "",
        last_name: (own.doctor_last_name as string) ?? "",
        specialization: (own.doctor_specialization as string) ?? undefined,
        phone: (own.doctor_phone as string) ?? undefined,
      } : undefined,
    };
  },

  /** Real — GET /patients (RLS-scoped to caller) already joins the assigned
   * doctor's name/phone/specialization off primary_doctor_id, same as
   * getDashboard() above; this just extracts that piece for consumers that
   * only need the doctor. */
  async getMyDoctor(): Promise<{ id: string; first_name: string; last_name: string; specialization?: string; phone?: string } | null> {
    const { data } = await apiClient.get(ENDPOINTS.PATIENTS.DASHBOARD);
    const own = Array.isArray(data) ? data[0] : undefined;
    if (!own?.primary_doctor_id) return null;
    return {
      id: own.primary_doctor_id as string,
      first_name: (own.doctor_first_name as string) ?? "",
      last_name: (own.doctor_last_name as string) ?? "",
      specialization: (own.doctor_specialization as string) ?? undefined,
      phone: (own.doctor_phone as string) ?? undefined,
    };
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

  /** Composed: resolve own patient_id via /patients (RLS-scoped), then group
   * /patients/{id}/scale-assignments (which now carry disease_id) by disease.
   * Disease/scale names come from /prs-catalog/diseases; a disease counts as
   * "completed" when a completed prs-instance exists for it. */
  async getMyAssessments(): Promise<{ permissions: AssessmentPermission[]; total: number }> {
    const patientsRes = await apiClient.get(ENDPOINTS.PATIENTS.DASHBOARD);
    const own = Array.isArray(patientsRes.data) ? patientsRes.data[0] : undefined;
    if (!own?.patient_id) return { permissions: [], total: 0 };
    const patientId = String(own.patient_id);

    const [assignRes, diseasesRes, instancesRes] = await Promise.all([
      apiClient.get(ENDPOINTS.PRS.PATIENT_PERMISSIONS(patientId), {
        params: { assessment_stage: "main_clinical" },
      }),
      apiClient.get(ENDPOINTS.PRS.CONDITIONS).catch(() => ({ data: [] })),
      apiClient
        .get(ENDPOINTS.PRS.PATIENT_INSTANCES(patientId), {
          params: { assessment_stage: "main_clinical" },
        })
        .catch(() => ({ data: [] })),
    ]);

    type AssignmentRow = {
      psa_id?: string;
      scale_id?: string;
      disease_id?: string;
      is_active?: boolean;
      created_at?: string;
    };
    type DiseaseRow = {
      disease_id?: string;
      disease_name?: string;
      scales?: { scale_id: string; scale_name?: string; short_name?: string }[];
    };
    type InstanceRow = { disease_id?: string; status?: string };

    const assignments: AssignmentRow[] = Array.isArray(assignRes.data) ? assignRes.data : [];
    const diseases: DiseaseRow[] = Array.isArray(diseasesRes.data) ? diseasesRes.data : [];
    const instances: InstanceRow[] = Array.isArray(instancesRes.data) ? instancesRes.data : [];

    const diseaseById = new Map(diseases.map((d) => [String(d.disease_id), d]));
    const completedDiseases = new Set(
      instances.filter((i) => i.status === "completed").map((i) => String(i.disease_id)),
    );

    const byDisease = new Map<string, AssignmentRow[]>();
    for (const a of assignments) {
      if (a.is_active === false || !a.disease_id) continue;
      const key = String(a.disease_id);
      if (!byDisease.has(key)) byDisease.set(key, []);
      byDisease.get(key)!.push(a);
    }

    const permissions: AssessmentPermission[] = Array.from(byDisease.entries()).map(
      ([diseaseId, rows]) => {
        const disease = diseaseById.get(diseaseId);
        const scaleNameById = new Map(
          (disease?.scales ?? []).map((s) => [s.scale_id, s.scale_name ?? s.short_name]),
        );
        return {
          permission_id: String(rows[0]?.psa_id ?? diseaseId),
          patient_id: patientId,
          disease_id: diseaseId,
          disease_name: disease?.disease_name ?? diseaseId,
          granted_at: String(rows[0]?.created_at ?? ""),
          status: completedDiseases.has(diseaseId) ? "completed" : "granted",
          scales: rows
            .filter((r) => r.scale_id)
            .map((r) => ({
              scale_id: String(r.scale_id),
              scale_name: scaleNameById.get(String(r.scale_id)) ?? String(r.scale_id),
            })),
        };
      },
    );

    return { permissions, total: permissions.length };
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
