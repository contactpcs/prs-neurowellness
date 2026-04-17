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

    // Raw list: one row per scale (id, disease_id, scale_id, prs_diseases, prs_scales, status, ...)
    const rawList: unknown[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.permissions)
        ? payload.permissions
        : [];

    // Group rows by disease_id so each AssessmentPermission covers all scales for that disease
    const diseaseMap = new Map<string, AssessmentPermission>();

    for (const item of rawList) {
      const p = item as Record<string, unknown>;
      const diseaseId = String(p.disease_id ?? "");
      if (!diseaseId) continue;

      const scaleId = String(p.scale_id ?? "");
      const diseases = (p.prs_diseases as Record<string, unknown>) ?? {};
      const scaleInfo = (p.prs_scales as Record<string, unknown>) ?? {};

      if (!diseaseMap.has(diseaseId)) {
        diseaseMap.set(diseaseId, {
          permission_id: String(p.id ?? ""),
          disease_id: diseaseId,
          disease_name: (diseases.disease_name as string) || diseaseId,
          granted_at: String(p.granted_at ?? ""),
          status: (p.status as AssessmentPermission["status"]) ?? "granted",
          scales: scaleId
            ? [{ scale_id: scaleId, scale_name: (scaleInfo.scale_name as string) || scaleId }]
            : [],
        });
      } else {
        const existing = diseaseMap.get(diseaseId)!;
        if (scaleId && !existing.scales?.some((s) => s.scale_id === scaleId)) {
          existing.scales = existing.scales ?? [];
          existing.scales.push({
            scale_id: scaleId,
            scale_name: (scaleInfo.scale_name as string) || scaleId,
          });
        }
      }
    }

    const permissions = Array.from(diseaseMap.values());
    return { permissions, total: permissions.length };
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
