import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { LoginCredentials, AuthResponse, RegisterData, ConsentFormItem } from "@/types/auth.types";

export interface Clinic {
  clinic_id: string;
  clinic_name: string;
  city?: string;
  state?: string;
  address?: string;
}

/** Raw /auth/me shape — self_registered/patient_id/registration_status are
 * returned on EVERY call (not just right after registering) so a patient
 * who logs back in mid-wizard can be routed to wherever they left off. */
interface MeResponse {
  id: string; email: string; first_name: string; last_name: string; role: string;
  clinic_id: string | null; region_id: string | null; is_active: boolean; consent_signed: boolean;
  consent_type_required: string | null;
  self_registered: boolean; patient_id: string | null; registration_status: string | null;
}

function meToUser(me: MeResponse): AuthResponse["user"] {
  return {
    id: me.id, email: me.email, first_name: me.first_name, last_name: me.last_name,
    roles: [me.role as AuthResponse["user"]["roles"][number]], permissions: [],
    clinic_id: me.clinic_id ?? undefined, region_id: me.region_id ?? undefined,
    is_active: me.is_active, consent_signed: me.consent_signed, consent_type_required: me.consent_type_required,
    self_registered: me.self_registered, patient_id: me.patient_id ?? undefined,
    registration_status: me.registration_status ?? undefined,
  };
}

export const authService = {
  /** Real backend: POST /auth/local-login {email} -> {access_token, token_type} only
   * (no user object, no refresh_token). Fetch /auth/me right after to build the
   * User the rest of the app expects, matching AuthResponse's declared shape. */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const loginRes = await apiClient.post(ENDPOINTS.AUTH.LOGIN, { email: credentials.email });
    const access_token: string = loginRes.data.access_token;
    const meRes = await apiClient.get(ENDPOINTS.AUTH.ME, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    return { access_token, refresh_token: "", expires_in: 0, user: meToUser(meRes.data as MeResponse) };
  },

  /** Real: POST /auth/register (public, no auth) -> {access_token}. Creates
   * an inactive, self_registered patient and logs them in immediately so
   * they can continue the rest of the wizard (disease selection, consent,
   * anamnesis, PRS) while still inactive — a receptionist's later approval
   * is what finally activates the account. */
  async register(formData: RegisterData): Promise<AuthResponse> {
    const { data } = await apiClient.post(ENDPOINTS.AUTH.REGISTER, {
      email: formData.email,
      first_name: formData.first_name,
      last_name: formData.last_name,
      phone: formData.phone,
      gender: formData.gender,
      dob: formData.date_of_birth,
      city: formData.city,
      state: formData.state,
      country: formData.country,
      primary_clinic_id: formData.clinic_id,
    });
    const access_token: string = data.access_token;
    const meRes = await apiClient.get(ENDPOINTS.AUTH.ME, { headers: { Authorization: `Bearer ${access_token}` } });
    return { access_token, refresh_token: "", expires_in: 0, user: meToUser(meRes.data as MeResponse) };
  },

  /** Re-fetches the current session's profile from the DB — used right after
   * signing onboarding consent, since the token itself doesn't change but
   * profiles.is_active does; the app needs the fresh value without a
   * forced re-login. */
  async me(): Promise<MeResponse> {
    const { data } = await apiClient.get(ENDPOINTS.AUTH.ME);
    return data;
  },

  /** Real: GET /consent-templates -> [{template_id, consent_type, version, title, content, content_hash, is_active}]
   * Old shape expected {consent_form_id, consent_form_name, is_required, created_at} — mapped best-effort. */
  async getConsentForms(): Promise<ConsentFormItem[]> {
    const response = await apiClient.get(ENDPOINTS.CONSENT.FORMS);
    const list = Array.isArray(response.data) ? response.data : [];
    return list.map((t: Record<string, unknown>) => ({
      consent_form_id: String(t.template_id ?? ""),
      consent_form_name: String(t.title ?? t.consent_type ?? ""),
      is_required: true,
      created_at: undefined,
    }));
  },

  /** Real: GET /auth/clinics (public, no auth) -> clinics open for new
   * patients (excludes only pending_closure/closed). */
  async getClinics(): Promise<Clinic[]> {
    const { data } = await apiClient.get(ENDPOINTS.AUTH.CLINICS);
    return Array.isArray(data) ? data : [];
  },

  // NOT AVAILABLE — no sync-profile concept (profile is created at staff/admin registration time).
  async syncProfile(_data: Partial<RegisterData> & { email: string; full_name?: string }): Promise<void> {
    throw new Error("Profile sync isn't available.");
  },
};
