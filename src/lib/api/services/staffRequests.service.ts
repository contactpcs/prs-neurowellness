import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";

export interface StaffRequest {
  request_id: string;
  clinic_id: string;
  request_type: "open_position" | "candidate_referral" | "staff_removal";
  position_role: "doctor" | "clinical_assistant" | "receptionist";
  candidate_name: string | null;
  candidate_email: string | null;
  candidate_phone?: string | null;
  candidate_credentials?: Record<string, unknown> | null;
  status: "pending" | "under_review" | "approved" | "rejected" | "withdrawn";
  submitted_by: string;
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: string;
  // Set once a doctor/CA/receptionist profile is created against this
  // request — status stays 'approved' forever, this is the real signal.
  fulfilled_profile_id?: string | null;
  fulfilled_at?: string | null;
}

export interface CreateStaffRequestPayload {
  clinic_id: string;
  request_type: StaffRequest["request_type"];
  position_role: StaffRequest["position_role"];
  candidate_name?: string;
  candidate_email?: string;
  candidate_phone?: string;
  candidate_credentials?: Record<string, unknown>;
  target_staff_id?: string;
}

export const staffRequestsService = {
  list: async (params?: { clinic_id?: string; status?: string }): Promise<StaffRequest[]> => {
    const res = await apiClient.get(ENDPOINTS.STAFF_REQUESTS.LIST, { params });
    return Array.isArray(res.data) ? res.data : [];
  },

  create: async (payload: CreateStaffRequestPayload): Promise<StaffRequest> => {
    const res = await apiClient.post(ENDPOINTS.STAFF_REQUESTS.CREATE, payload);
    return res.data;
  },

  decide: async (id: string, decision: "approved" | "rejected" | "under_review", review_notes?: string): Promise<StaffRequest> => {
    const res = await apiClient.patch(ENDPOINTS.STAFF_REQUESTS.DECISION(id), { decision, review_notes });
    return res.data;
  },
};
