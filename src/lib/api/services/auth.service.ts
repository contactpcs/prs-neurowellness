import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import { LoginCredentials, RegisterData, AuthResponse } from "@/types/auth.types";

// Convert form data to backend format
interface RegisterFormData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  phone?: string;
  role: string;
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await apiClient.post(ENDPOINTS.AUTH.LOGIN, credentials);
    // Backend wraps response in success_response, so extract the data property
    return response.data.data || response.data;
  },

  async register(formData: RegisterFormData | RegisterData): Promise<AuthResponse> {
    // Convert form data (first_name, last_name) to backend format (full_name)
    const backendData = {
      full_name: 'first_name' in formData ? `${formData.first_name} ${formData.last_name}`.trim() : (formData as RegisterData).full_name || '',
      email: formData.email,
      password: formData.password,
      phone: formData.phone,
      role: formData.role,
      city: 'city' in formData ? formData.city : undefined,
      state: 'state' in formData ? formData.state : undefined,
      country: 'country' in formData ? formData.country : "USA",
    };
    
    const response = await apiClient.post(ENDPOINTS.AUTH.REGISTER, backendData);
    // Backend wraps response in success_response, so extract the data property
    return response.data.data || response.data;
  },
};
