export type UserRole = "patient" | "doctor" | "clinical_assistant" | "receptionist" | "platform_admin" | "clinical_admin";

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  roles: UserRole[];
  permissions: string[];
  clinic_id?: string;
  clinic_name?: string;
  clinic_city?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  clinic_id: string;
  date_of_birth?: string;
  gender?: string;
  city?: string;
  state?: string;
  country?: string;
  medical_history?: string;
  emergency_contact?: string;
}

export interface RegisterResponse {
  message: string;
  clinic_name: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user: User;
}

export interface JWTPayload {
  sub: string;
  email: string;
  first_name: string;
  roles: string[];
  permissions: string[];
  exp: number;
}
