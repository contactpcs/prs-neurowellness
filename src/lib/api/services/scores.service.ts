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

function parseJsonField<T>(v: unknown, fallback: T): T {
  if (typeof v !== "string") return (v as T) ?? fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

/** Backend GET /prs-assessment-instances/{id}/results returns
 * { scale_results, final_result } with subscale_scores/risk_flags/
 * scale_summaries as raw JSON strings, and no instance record. Compose the
 * InstanceScoreDetail the results pages render: instance fetched
 * separately (disease_name resolved from the catalog), final_result mapped
 * to disease_result, scale names matched from final_result.scale_summaries. */
export async function fetchInstanceScoreDetail(instanceId: string): Promise<InstanceScoreDetail> {
  const [resultsRes, instanceRes, diseasesRes] = await Promise.all([
    apiClient.get(ENDPOINTS.PRS.INSTANCE_SCORE(instanceId)),
    apiClient.get(ENDPOINTS.PRS.ASSESSMENT_INSTANCE(instanceId)).catch(() => ({ data: null })),
    apiClient.get(ENDPOINTS.PRS.CONDITIONS).catch(() => ({ data: [] })),
  ]);

  const raw = resultsRes.data as { scale_results?: Record<string, unknown>[]; final_result?: Record<string, unknown> | null };
  const inst = (instanceRes.data ?? {}) as Record<string, unknown>;
  const diseases: { disease_id?: string; disease_name?: string }[] = Array.isArray(diseasesRes.data) ? diseasesRes.data : [];

  const final = raw.final_result ?? null;
  const summaries = parseJsonField<{ scale_code?: string; scale_name?: string }[]>(final?.scale_summaries, []);
  const nameByCode = new Map(summaries.map((s) => [s.scale_code, s.scale_name]));

  const scale_results: ScaleResultDetail[] = (Array.isArray(raw.scale_results) ? raw.scale_results : []).map((sr) => {
    const scaleId = String(sr.scale_id ?? "");
    const scaleCode = scaleId.split("/")[0];
    return {
      ...(sr as object),
      scale_result_id: String(sr.scale_result_id ?? scaleId),
      scale_id: scaleId,
      scale_code: scaleCode,
      scale_name: nameByCode.get(scaleCode) ?? scaleCode,
      subscale_scores: parseJsonField<Record<string, unknown>>(sr.subscale_scores, {}),
      risk_flags: parseJsonField<unknown[]>(sr.risk_flags, []),
    } as ScaleResultDetail;
  });

  const diseaseId = inst.disease_id != null ? String(inst.disease_id) : undefined;
  return {
    instance: {
      instance_id: instanceId,
      disease_id: diseaseId,
      disease_name: diseases.find((d) => d.disease_id === diseaseId)?.disease_name ?? diseaseId,
      status: inst.status as string | undefined,
      started_at: inst.started_at as string | undefined,
      completed_at: inst.completed_at as string | undefined,
      initiated_by: inst.initiated_by as string | undefined,
    },
    disease_result: final
      ? {
          disease_score: final.percentage != null ? Number(final.percentage) : undefined,
          percentage: final.percentage != null ? Number(final.percentage) : undefined,
          severity_level: (final.overall_severity as string | null) ?? undefined,
          severity_label: (final.overall_severity_label as string | null) ?? undefined,
        }
      : undefined,
    scale_results,
  };
}

export const scoresService = {
  // NOT AVAILABLE — no list-instances-by-patient endpoint exists to build these from.
  async getMyScores(_params?: { skip?: number; limit?: number }): Promise<{ instances: AssessmentInstance[]; total: number }> {
    return { instances: [], total: 0 };
  },

  async getMyScoresSummary(): Promise<{ instances: AssessmentInstance[]; total: number; diseases: number }> {
    return { instances: [], total: 0, diseases: 0 };
  },

  async getInstanceScore(instanceId: string): Promise<InstanceScoreDetail> {
    return fetchInstanceScoreDetail(instanceId);
  },

  async getPatientScores(_patientId: string, _params?: { skip?: number; limit?: number }): Promise<{ instances: AssessmentInstance[]; total: number }> {
    return { instances: [], total: 0 };
  },

  async getPatientScoresSummary(_patientId: string): Promise<{ instances: AssessmentInstance[]; total: number; diseases: number }> {
    return { instances: [], total: 0, diseases: 0 };
  },
};
