import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { StaffDashboard, PatientListItem, PatientDetail, DoctorListItem } from "@/types/domain.types";
import type { ConsentResponseItem } from "@/types/auth.types";

export interface RegisterPatientPayload {
  full_name: string;
  email: string;
  password: string;
  phone: string;
  date_of_birth: string;
  gender: string;
  city: string;
  state: string;
  country?: string;
  consent_responses?: ConsentResponseItem[];
}

/** PatientRead now joins profiles for first_name/last_name/email/phone/dob/gender. */
function normalizePatient(raw: Record<string, unknown>): PatientListItem {
  const first = String(raw.first_name ?? "");
  const last = String(raw.last_name ?? "");
  return {
    id: String(raw.patient_id ?? ""),
    profile_id: (raw.profile_id as string) ?? undefined,
    full_name: `${first} ${last}`.trim(),
    first_name: first,
    last_name: last,
    email: String(raw.email ?? ""),
    phone: (raw.phone as string) ?? undefined,
    date_of_birth: (raw.dob as string) ?? undefined,
    gender: (raw.gender as string) ?? undefined,
    mrn: (raw.mrn as string) ?? undefined,
    status: (raw.registration_status as string) ?? undefined,
    clinic_id: (raw.primary_clinic_id as string) ?? undefined,
    registered_at: (raw.registration_completed_at as string) ?? undefined,
    created_at: (raw.created_at as string) ?? undefined,
    doctor_id: (raw.primary_doctor_id as string) ?? null,
    doctor_name: (raw.doctor_name as string) ?? null,
  };
}

export const staffService = {
  // NOT AVAILABLE — no aggregate endpoint, composed with defaults.
  async getDashboard(): Promise<StaffDashboard> {
    const { data } = await apiClient.get(ENDPOINTS.STAFF.PATIENTS);
    const list: Record<string, unknown>[] = Array.isArray(data) ? data : [];
    return {
      patient_count: list.length,
      pending_count: list.filter((p) => p.registration_status !== "registration_complete").length,
      registered_today: 0,
      upcoming_sessions: [],
      recent_scores: [],
    };
  },

  async getPatients(_params?: { page?: number; limit?: number; search?: string }): Promise<{ patients: PatientListItem[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.STAFF.PATIENTS);
    const raw: Record<string, unknown>[] = Array.isArray(data) ? data : [];
    const patients = raw.map(normalizePatient);
    return { patients, total: patients.length };
  },

  /** Real: GET /patients?approval_status=pending (clinic-scoped automatically
   * for receptionist). Only self-registered patients who've finished the
   * whole 6-step wizard show up here — matches the actual approval gate
   * (see SQL/24_patient_self_registration.sql), not a heuristic. */
  async getPendingPatients(_params?: { page?: number; limit?: number }): Promise<{ patients: PatientListItem[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.STAFF.PATIENTS, { params: { approval_status: "pending" } });
    const raw: Record<string, unknown>[] = Array.isArray(data) ? data : [];
    const patients = raw.map(normalizePatient);
    return { patients, total: patients.length };
  },

  /** Real backend needs first_name/last_name (not full_name), no password,
   * and a primary_clinic_id — resolved from the caller's own /auth/me since
   * the old payload never carried a clinic_id. */
  async registerPatient(payload: RegisterPatientPayload): Promise<PatientListItem> {
    const [first_name, ...rest] = payload.full_name.trim().split(/\s+/);
    const me = (await apiClient.get(ENDPOINTS.AUTH.ME)).data as { clinic_id?: string | null };
    if (!me.clinic_id) throw new Error("Your account has no assigned clinic — cannot register a patient.");
    const { data } = await apiClient.post(ENDPOINTS.STAFF.REGISTER_PATIENT, {
      email: payload.email,
      first_name,
      last_name: rest.join(" ") || first_name,
      phone: payload.phone || undefined,
      gender: payload.gender || undefined,
      dob: payload.date_of_birth || undefined,
      primary_clinic_id: me.clinic_id,
    });
    return normalizePatient(data);
  },

  async getPatient(patientId: string): Promise<PatientDetail> {
    const { data } = await apiClient.get(ENDPOINTS.STAFF.PATIENT(patientId));
    return normalizePatient(data) as PatientDetail;
  },

  /** Real: PATCH /patients/{id}/approval {decision: "approved"} — only
   * valid once registration_status='registration_complete' and
   * approval_status='pending' (backend enforces both). */
  async approvePatient(patientId: string): Promise<PatientDetail> {
    const { data } = await apiClient.patch(ENDPOINTS.PATIENTS.DECIDE_APPROVAL(patientId), { decision: "approved" });
    return normalizePatient(data) as PatientDetail;
  },
  async rejectPatient(patientId: string, reason?: string): Promise<PatientDetail> {
    const { data } = await apiClient.patch(ENDPOINTS.PATIENTS.DECIDE_APPROVAL(patientId), {
      decision: "rejected", rejection_reason: reason,
    });
    return normalizePatient(data) as PatientDetail;
  },

  async getDoctors(): Promise<{ doctors: DoctorListItem[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.STAFF.DOCTORS);
    const list: Record<string, unknown>[] = Array.isArray(data) ? data : [];
    return {
      doctors: list.map((d) => ({
        id: String(d.doctor_id ?? ""),
        first_name: String(d.first_name ?? ""),
        last_name: String(d.last_name ?? ""),
        specialization: (d.specialization as string) ?? undefined,
        availability_status: (d.availability_status as DoctorListItem["availability_status"]) ?? "available",
        patient_count: 0,
      })),
      total: list.length,
    };
  },

  /** Real: PATCH /patients/{id}/allocate-doctor {doctor_id} — ends any
   * existing active doctor_patient_assignments row and creates a new one,
   * same clinic only (backend rejects a doctor at a different clinic). */
  async allocatePatient(patientId: string, doctorId: string): Promise<PatientDetail> {
    const { data } = await apiClient.patch(ENDPOINTS.PATIENTS.ALLOCATE_DOCTOR(patientId), { doctor_id: doctorId });
    return normalizePatient(data) as PatientDetail;
  },
};
