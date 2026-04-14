import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { ScoreSummaryItem, PatientScoreInstance } from "@/types/domain.types";

export const scoresService = {
  async getMyScores(params?: { page?: number; limit?: number }): Promise<{ scores: ScoreSummaryItem[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.MY_SCORES, { params });
    const payload = data.data ?? data;
    return {
      scores: payload.scores ?? payload ?? [],
      total: payload.total ?? 0,
    };
  },

  async getMyScoresSummary(): Promise<{ scores: ScoreSummaryItem[] }> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.MY_SCORES_SUMMARY);
    const payload = data.data ?? data;
    return {
      scores: payload.scores ?? payload ?? [],
    };
  },

  async getPatientScores(patientId: string, params?: { page?: number; limit?: number }): Promise<{ instances: PatientScoreInstance[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.PATIENT_SCORES(patientId), { params });
    const payload = data.data ?? data;
    return {
      instances: payload.instances ?? payload ?? [],
      total: payload.total ?? 0,
    };
  },

  async getPatientScoresSummary(patientId: string): Promise<{ scores: ScoreSummaryItem[] }> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.PATIENT_SCORES_SUMMARY(patientId));
    const payload = data.data ?? data;
    return {
      scores: payload.scores ?? payload ?? [],
    };
  },
};
