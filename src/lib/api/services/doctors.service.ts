import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { DoctorDashboard, PatientListItem, PatientDetail } from "@/types/domain.types";

export const doctorsService = {
  async getDashboard(): Promise<DoctorDashboard> {
    const { data } = await apiClient.get(ENDPOINTS.DOCTORS.DASHBOARD);
    return data.data ?? data;
  },

  async getPatients(params?: { page?: number; limit?: number; search?: string }): Promise<{ patients: PatientListItem[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.DOCTORS.PATIENTS, { params });
    const payload = data.data ?? data;
    return {
      patients: payload.patients ?? payload ?? [],
      total: payload.total ?? 0,
    };
  },

  async getPatient(patientId: string): Promise<PatientDetail> {
    const { data } = await apiClient.get(ENDPOINTS.DOCTORS.PATIENT(patientId));
    return data.data ?? data;
  },

  async grantAssessment(patientId: string, payload: { disease_id: string; scale_ids?: string[] }): Promise<unknown> {
    const { data } = await apiClient.post(ENDPOINTS.DOCTORS.GRANT_ASSESSMENT(patientId), payload);
    return data.data ?? data;
  },

  async updateAvailability(status: "available" | "unavailable"): Promise<unknown> {
    const { data } = await apiClient.put(ENDPOINTS.DOCTORS.AVAILABILITY, { availability_status: status });
    return data.data ?? data;
  },
};
