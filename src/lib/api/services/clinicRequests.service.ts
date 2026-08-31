import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";

export interface ClinicRequest {
  request_id: string;
  request_type: "create_clinic" | "close_clinic" | "change_admin" | "change_main_branch";
  clinic_type: string | null;
  clinic_id: string | null;
  region_id: string;
  submitted_by: string;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  payload: Record<string, unknown>;
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: string;
}

export interface CreateClinicRequestPayload {
  request_type: ClinicRequest["request_type"];
  region_id: string;
  clinic_type?: string;
  clinic_id?: string;
  payload?: Record<string, unknown>;
}

export const clinicRequestsService = {
  list: async (params?: { region_id?: string; status?: string }): Promise<ClinicRequest[]> => {
    const res = await apiClient.get(ENDPOINTS.CLINIC_REQUESTS.LIST, { params });
    return Array.isArray(res.data) ? res.data : [];
  },

  create: async (payload: CreateClinicRequestPayload): Promise<ClinicRequest> => {
    const res = await apiClient.post(ENDPOINTS.CLINIC_REQUESTS.CREATE, payload);
    return res.data;
  },

  decide: async (id: string, decision: "approved" | "rejected" | "withdrawn", review_notes?: string): Promise<ClinicRequest> => {
    const res = await apiClient.patch(ENDPOINTS.CLINIC_REQUESTS.DECISION(id), { decision, review_notes });
    return res.data;
  },
};
