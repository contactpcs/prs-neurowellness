export type UserRole = "patient" | "doctor" | "clinical_assistant" | "platform_admin" | "clinical_admin";

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  roles: UserRole[];
  permissions: string[];
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
  role: UserRole;
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
