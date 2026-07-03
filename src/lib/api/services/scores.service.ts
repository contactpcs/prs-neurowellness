import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { AssessmentInstance } from "@/types/domain.types";

export type ScaleResultDetail = {
  scale_result_id: string;
  scale_id: string;
  scale_name?: string;
  scale_code?: string;
  calculated_value?: number;
  max_possible?: number;
  percentage?: number;
  severity_level?: string;
  severity_label?: string;
  subscale_scores?: Record<string, unknown>;
  risk_flags?: unknown[];
};

export type InstanceScoreDetail = {
  instance: {
    instance_id: string;
    disease_id?: string;
    disease_name?: string;
    status?: string;
    started_at?: string;
    completed_at?: string;
    initiated_by?: string;
  };
  disease_result?: {
    disease_score?: number;
    severity_level?: string;
    severity_label?: string;
    percentage?: number;
  };
  weighted_result?: {
    disease_score?: number;
    severity_level?: string;
    severity_label?: string;
    scale_breakdown?: Record<string, unknown>;
  };
  scale_results: ScaleResultDetail[];
};

export const scoresService = {
  // NOT AVAILABLE — no list-instances-by-patient endpoint exists to build these from.
  async getMyScores(_params?: { skip?: number; limit?: number }): Promise<{ instances: AssessmentInstance[]; total: number }> {
    return { instances: [], total: 0 };
  },

  async getMyScoresSummary(): Promise<{ instances: AssessmentInstance[]; total: number; diseases: number }> {
    return { instances: [], total: 0, diseases: 0 };
  },

  async getInstanceScore(instanceId: string): Promise<InstanceScoreDetail> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.INSTANCE_SCORE(instanceId));
    return {
      instance: { instance_id: instanceId },
      scale_results: Array.isArray(data?.scale_results) ? data.scale_results : [],
    };
  },

  async getPatientScores(_patientId: string, _params?: { skip?: number; limit?: number }): Promise<{ instances: AssessmentInstance[]; total: number }> {
    return { instances: [], total: 0 };
  },

  async getPatientScoresSummary(_patientId: string): Promise<{ instances: AssessmentInstance[]; total: number; diseases: number }> {
    return { instances: [], total: 0, diseases: 0 };
  },
};
