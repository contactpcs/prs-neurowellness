import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { DoctorDashboard, PatientListItem, PatientDetail, AnamnesisRecord } from "@/types/domain.types";
import type { ProtocolRead } from "@/types/treatmentProtocol.types";
import { fetchInstanceScoreDetail, type InstanceScoreDetail } from "./scores.service";

/** GET /patients/{id}/visits/{appointmentId}/summary — everything tied to
 * one visit. `inherited: true` on a PRS/protocol record means it's carried
 * forward from an earlier visit, not authored at this one; anamnesis is
 * never inherited (null means "no anamnesis taken" at this visit, except
 * the initial visit which always resolves to version 1). */
export type VisitSummary = {
  appointment_id: string;
  appointment_type: string;
  appointment_date: string;
  registration: PatientDetail | null;
  anamnesis: (AnamnesisRecord & { inherited?: boolean }) | null;
  prs_instances: Array<Record<string, unknown> & { instance_id: string; inherited?: boolean }>;
  protocols: Array<ProtocolRead & { inherited?: boolean; lineage?: ProtocolRead[] }>;
};

/** PatientRead now joins profiles for first_name/last_name/email/phone. */
function mapPatient(p: Record<string, unknown>): PatientListItem {
  const first = String(p.first_name ?? "");
  const last = String(p.last_name ?? "");
  return {
    id: String(p.patient_id ?? ""),
    full_name: `${first} ${last}`.trim(),
    first_name: first,
    last_name: last,
    email: String(p.email ?? ""),
    phone: (p.phone as string) ?? undefined,
    mrn: (p.mrn as string) ?? undefined,
    date_of_birth: (p.dob as string) ?? undefined,
    gender: (p.gender as string) ?? undefined,
    status: (p.registration_status as string) ?? undefined,
    clinic_id: (p.primary_clinic_id as string) ?? undefined,
    created_at: (p.created_at as string) ?? undefined,
    last_prs: null,
  };
}

export const doctorsService = {
  // NOT AVAILABLE — no aggregate endpoint, no self doctor_id resolvable from a bare URL.
  async getDashboard(): Promise<DoctorDashboard> {
    return { doctor: { id: "", first_name: "", last_name: "" }, patient_count: 0 };
  },

  /** Real: GET /patients, RLS-scoped to this doctor's assigned patients. No
   * pagination meta (no `page`/`limit`/`search` server-side filtering either). */
  async getPatients(_params?: { page?: number; limit?: number; search?: string }): Promise<{ patients: PatientListItem[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.DOCTORS.PATIENTS);
    const list: Record<string, unknown>[] = Array.isArray(data) ? data : [];
    const patients = list.map(mapPatient);
    return { patients, total: patients.length };
  },

  async getPatient(patientId: string): Promise<PatientDetail> {
    const { data } = await apiClient.get(ENDPOINTS.DOCTORS.PATIENT(patientId));
    return mapPatient(data) as PatientDetail;
  },

  async getPatientResult(_patientId: string, instanceId: string): Promise<InstanceScoreDetail> {
    return fetchInstanceScoreDetail(instanceId);
  },

  async getVisitSummary(patientId: string, appointmentId: string): Promise<VisitSummary> {
    const { data } = await apiClient.get(ENDPOINTS.DOCTORS.VISIT_SUMMARY(patientId, appointmentId));
    return data;
  },

  /** Real backend has no single grant-assessment call — POST one
   * patient-scale-assignment per scale_id instead. Callers that pass only a
   * disease_id (the assign page) get every scale in that disease's battery,
   * resolved from /prs-catalog/diseases — without this the loop below ran
   * zero POSTs and "assigned" nothing. */
  async grantAssessment(patientId: string, payload: { disease_id: string; scale_ids?: string[] }): Promise<unknown> {
    let scaleIds = payload.scale_ids ?? [];
    if (scaleIds.length === 0) {
      const { data } = await apiClient.get(ENDPOINTS.PRS.CONDITIONS);
      const diseases: { disease_id?: string; scales?: { scale_id: string }[]; scale_ids?: string[] }[] =
        Array.isArray(data) ? data : [];
      const disease = diseases.find((d) => d.disease_id === payload.disease_id);
      scaleIds = disease?.scales?.map((s) => s.scale_id) ?? disease?.scale_ids ?? [];
      if (scaleIds.length === 0) throw new Error(`No scales found for disease ${payload.disease_id}`);
    }
    const results = await Promise.all(
      scaleIds.map((scale_id) =>
        apiClient.post(ENDPOINTS.DOCTORS.GRANT_ASSESSMENT(patientId), {
          patient_id: patientId,
          scale_id,
          disease_id: payload.disease_id,
          assessment_stage: "main_clinical",
          assignment_reason: "doctor_override",
        })
      )
    );
    return results.map((r) => r.data);
  },

  // NOT AVAILABLE — real toggle is PATCH /doctors/{own_doctor_id}, and the
  // caller's own doctor_id isn't resolvable from /auth/me (that returns profile_id, not doctor_id).
  async updateAvailability(_status: "available" | "unavailable"): Promise<unknown> {
    throw new Error("Updating your own availability isn't available yet.");
  },

  /** Real: GET /doctors/{id}/weekly-schedules — the only working-hours
   * concept in this system (CAs/receptionists have no schedule model). */
  async listWeeklySchedules(doctorId: string): Promise<{ day_of_week: number; start_time: string; end_time: string; slot_duration_minutes: number }[]> {
    const { data } = await apiClient.get(`/doctors/${doctorId}/weekly-schedules`);
    return Array.isArray(data) ? data : [];
  },

  /** Real: GET /doctors/{id}/schedule-overrides — single-date exceptions
   * (leave/holiday or a special one-off availability window). Note the
   * backend's ScheduleOverrideRead doesn't expose start_time/end_time even
   * when is_available=true — only date/is_available/reason are returned. */
  async listScheduleOverrides(doctorId: string): Promise<{ override_id: string; override_date: string; is_available: boolean; reason: string | null }[]> {
    const { data } = await apiClient.get(`/doctors/${doctorId}/schedule-overrides`);
    return Array.isArray(data) ? data : [];
  },
};
