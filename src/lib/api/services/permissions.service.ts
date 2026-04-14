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
    return {
      permissions: payload.permissions ?? payload ?? [],
      total: payload.total ?? 0,
    };
  },

  async revokePermission(permissionId: string): Promise<Permission> {
    const { data } = await apiClient.put(ENDPOINTS.PRS.REVOKE_PERMISSION(permissionId));
    return data.data ?? data;
  },
};
