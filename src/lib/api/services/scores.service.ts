import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { ScoreSummaryItem, PatientScoreInstance } from "@/types/domain.types";

export type InstanceScoreDetail = {
  instance_id: string;
  disease_id?: string;
  disease_name?: string;
  disease_score?: number;
  overall_severity?: string;
  completed_at?: string;
  scale_results: ScoreSummaryItem[];
};

export const scoresService = {
  async getMyScores(params?: { skip?: number; limit?: number }): Promise<{ scores: ScoreSummaryItem[]; total: number }> {
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

  async getInstanceScore(instanceId: string): Promise<InstanceScoreDetail> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.INSTANCE_SCORE(instanceId));
    return data.data ?? data;
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
