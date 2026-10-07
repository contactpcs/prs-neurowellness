import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";

// Same shape as reception.service.ts's getMyProfile/updateMyProfile — a
// clinical assistant's own profiles row, GET/PATCH under a CA-scoped route
// (clinical/router.py) rather than reception's.
export const clinicalAssistantService = {
  async getMyProfile(): Promise<Record<string, unknown>> {
    const { data } = await apiClient.get(ENDPOINTS.CLINICAL_ASSISTANT.ME);
    return data;
  },

  // Matches UpdateMyProfileRequest (clinical/schemas.py) — same fields as
  // DoctorUpdate (staff/schemas.py), so the CA profile page can carry the
  // same set as the doctor one.
  async updateMyProfile(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { data } = await apiClient.patch(ENDPOINTS.CLINICAL_ASSISTANT.ME, payload);
    return data;
  },
};
