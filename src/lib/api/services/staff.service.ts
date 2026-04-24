import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { StaffDashboard, PatientListItem, PatientDetail, DoctorListItem } from "@/types/domain.types";

export const staffService = {
  async getDashboard(): Promise<StaffDashboard> {
    const { data } = await apiClient.get(ENDPOINTS.STAFF.DASHBOARD);
    return data.data ?? data;
  },

  async getPatients(params?: { page?: number; limit?: number; search?: string }): Promise<{ patients: PatientListItem[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.STAFF.PATIENTS, { params });
    const payload = data.data ?? data;
    return {
      patients: payload.patients ?? payload ?? [],
      total: payload.total ?? 0,
    };
  },

  async getPatient(patientId: string): Promise<PatientDetail> {
    const { data } = await apiClient.get(ENDPOINTS.STAFF.PATIENT(patientId));
    const payload = data.data ?? data;
    return payload.patient ?? payload;
  },

  async getDoctors(): Promise<{ doctors: DoctorListItem[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.STAFF.DOCTORS);
    const payload = data.data ?? data;
    return {
      doctors: payload.doctors ?? payload ?? [],
      total: payload.total ?? 0,
    };
  },

  async allocatePatient(patientId: string, doctorId: string): Promise<unknown> {
    const { data } = await apiClient.post(ENDPOINTS.STAFF.ALLOCATE(patientId), { doctor_id: doctorId });
    return data.data ?? data;
  },
};
