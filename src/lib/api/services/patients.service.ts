import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { PatientDashboard, AssessmentPermission, ScoreSummaryItem } from "@/types/domain.types";

export const patientsService = {
  async getDashboard(): Promise<PatientDashboard> {
    const { data } = await apiClient.get(ENDPOINTS.PATIENTS.DASHBOARD);
    return data.data ?? data;
  },

  async getMyDoctor(): Promise<{ id: string; first_name: string; last_name: string; specialization?: string; phone?: string }> {
    const { data } = await apiClient.get(ENDPOINTS.PATIENTS.MY_DOCTOR);
    return data.data ?? data;
  },

  async getMyAssessments(): Promise<{ permissions: AssessmentPermission[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PATIENTS.MY_ASSESSMENTS);
    const payload = data.data ?? data;
    return {
      permissions: payload.permissions ?? payload ?? [],
      total: payload.total ?? 0,
    };
  },

  async getMyScores(): Promise<{ scores: ScoreSummaryItem[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PATIENTS.MY_SCORES);
    const payload = data.data ?? data;
    return {
      scores: payload.scores ?? payload ?? [],
      total: payload.total ?? 0,
    };
  },
};
