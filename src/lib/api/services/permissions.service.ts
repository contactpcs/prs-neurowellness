import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { Permission } from "@/types/domain.types";

export const permissionsService = {
  async grantPermission(payload: { patient_id: string; disease_id: string; scale_ids?: string[] }): Promise<Permission> {
    const { data } = await apiClient.post(ENDPOINTS.PRS.PERMISSIONS, payload);
    return data.data ?? data;
  },

  async getMyPermissions(): Promise<{ permissions: Permission[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.MY_PERMISSIONS);
    const payload = data.data ?? data;
    return {
      permissions: payload.permissions ?? payload ?? [],
      total: payload.total ?? 0,
    };
  },

  async getPatientPermissions(patientId: string): Promise<{ permissions: Permission[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.PRS.PATIENT_PERMISSIONS(patientId));
    const payload = data.data ?? data;

    // Raw list: one row per scale (id, disease_id, scale_id, prs_diseases, prs_scales, status, ...)
    const rawList: unknown[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.permissions)
        ? payload.permissions
        : [];

    // Group rows by disease_id so each Permission covers all scales for that disease
    const diseaseMap = new Map<string, Permission & { _rowIds: string[] }>();

    for (const item of rawList) {
      const p = item as Record<string, unknown>;
      const diseaseId = String(p.disease_id ?? "");
      if (!diseaseId) continue;

      const scaleId = String(p.scale_id ?? "");
      const diseases = (p.prs_diseases as Record<string, unknown>) ?? {};

      if (!diseaseMap.has(diseaseId)) {
        diseaseMap.set(diseaseId, {
          permission_id: String(p.id ?? ""),
          patient_id: String(p.patient_id ?? ""),
          granted_by: String(p.doctor_id ?? ""),
          disease_id: diseaseId,
          disease_name: (diseases.disease_name as string) || undefined,
          scale_ids: scaleId ? [scaleId] : [],
          status: (p.status as Permission["status"]) ?? "granted",
          granted_at: String(p.granted_at ?? ""),
          expires_at: p.expires_at ? String(p.expires_at) : undefined,
          _rowIds: [String(p.id ?? "")],
        });
      } else {
        const existing = diseaseMap.get(diseaseId)!;
        if (scaleId && !existing.scale_ids.includes(scaleId)) {
          existing.scale_ids.push(scaleId);
        }
        existing._rowIds.push(String(p.id ?? ""));
      }
    }

    const permissions = Array.from(diseaseMap.values()).map(({ _rowIds: _, ...rest }) => rest);
    return { permissions, total: permissions.length };
  },

  async revokePermission(permissionId: string): Promise<Permission> {
    const { data } = await apiClient.put(ENDPOINTS.PRS.REVOKE_PERMISSION(permissionId));
    return data.data ?? data;
  },
};
