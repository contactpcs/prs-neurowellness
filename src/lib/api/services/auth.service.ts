import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import { LoginCredentials, RegisterData, AuthResponse } from "@/types/auth.types";

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const { data } = await apiClient.post(ENDPOINTS.AUTH.LOGIN, credentials);
    return data;
  },

  async register(userData: RegisterData): Promise<AuthResponse> {
    const { data } = await apiClient.post(ENDPOINTS.AUTH.REGISTER, userData);
    return data;
  },
};
