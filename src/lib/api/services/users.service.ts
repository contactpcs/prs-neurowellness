import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { User } from "@/types/auth.types";

export const usersService = {
  // Patient self-profile — GET /auth/me only carries identity fields (no
  // dob/address/city/etc), so this fetches the full patient record via
  // GET /patients/{patient_id} instead (patient_id comes off the logged-in
  // user, set on every /auth/me call — see auth.types.ts).
  async getProfile(): Promise<Record<string, unknown>> {
    const me = await apiClient.get(ENDPOINTS.USERS.PROFILE);
    const patientId = me.data.patient_id;
    if (!patientId) return me.data;
    const { data } = await apiClient.get(ENDPOINTS.DOCTORS.PATIENT(patientId));
    return data;
  },

  // NOT AVAILABLE — no patient self-edit endpoint exists yet (PATCH
  // /patients/{id} is admin-only, see patients/router.py:71-74).
  async updateProfile(_payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    throw new Error("Editing your profile isn't available yet.");
  },
};
