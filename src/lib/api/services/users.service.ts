import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { User } from "@/types/auth.types";

export const usersService = {
  // Real GET /auth/me returns {id,email,first_name,last_name,role,clinic_id,region_id} — role (singular) mapped to roles (array).
  async getProfile(): Promise<User> {
    const { data } = await apiClient.get(ENDPOINTS.USERS.PROFILE);
    return {
      id: data.id,
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      roles: [data.role as User["roles"][number]],
      permissions: [],
      clinic_id: data.clinic_id ?? undefined,
    };
  },

  // NOT AVAILABLE — no profile-edit endpoint exists.
  async updateProfile(_payload: Record<string, unknown>): Promise<User> {
    throw new Error("Editing your profile isn't available yet.");
  },
};
