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
  clinic_name?: string | null; clinic_city?: string | null;
  consent_type_required: string | null;
  self_registered: boolean; patient_id: string | null; registration_status: string | null;
  approval_status: string | null; rejection_reason: string | null;
  doctor_id: string | null;
  email_verified: boolean; phone_verified: boolean;
}

function meToUser(me: MeResponse): AuthResponse["user"] {
  return {
    id: me.id, email: me.email, first_name: me.first_name, last_name: me.last_name,
    roles: [me.role as AuthResponse["user"]["roles"][number]], permissions: [],
    clinic_id: me.clinic_id ?? undefined, region_id: me.region_id ?? undefined,
    clinic_name: me.clinic_name ?? undefined, clinic_city: me.clinic_city ?? undefined,
    is_active: me.is_active, consent_signed: me.consent_signed, consent_type_required: me.consent_type_required,
    self_registered: me.self_registered, patient_id: me.patient_id ?? undefined,
    registration_status: me.registration_status ?? undefined,
    approval_status: me.approval_status ?? undefined,
    rejection_reason: me.rejection_reason ?? null,
    doctor_id: me.doctor_id ?? undefined,
    email_verified: me.email_verified, phone_verified: me.phone_verified,
  };
}

// Fetched once per page load and cached — decides which of the two parallel
// endpoint pairs to call (local-login/register vs the real login/OTP
// wizard). A plain module-level cache is enough here: auth_mode is a
// deploy-time setting, never changes mid-session.
let cachedAuthMode: "local" | "cognito" | null = null;
async function getAuthMode(): Promise<"local" | "cognito"> {
  if (cachedAuthMode) return cachedAuthMode;
  const { data } = await apiClient.get(ENDPOINTS.AUTH.CONFIG);
  cachedAuthMode = data.auth_mode === "cognito" ? "cognito" : "local";
  return cachedAuthMode;
}

export const authService = {
  /** Local dev: POST /auth/local-login {email} -> {access_token} (no
   * password check). Cognito mode: POST /auth/login {username, password} ->
   * real tokens. Either way, fetch /auth/me right after to build the User
   * shape the rest of the app expects. */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const mode = await getAuthMode();
    const loginRes = mode === "cognito"
      ? await apiClient.post(ENDPOINTS.AUTH.REAL_LOGIN, { username: credentials.username, password: credentials.password })
      : await apiClient.post(ENDPOINTS.AUTH.LOGIN, { email: credentials.username });
    const access_token: string = loginRes.data.access_token;
    const meRes = await apiClient.get(ENDPOINTS.AUTH.ME, {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    return { access_token, refresh_token: loginRes.data.refresh_token ?? "", expires_in: 0, user: meToUser(meRes.data as MeResponse) };
  },

  /** Completes Cognito's NEW_PASSWORD_REQUIRED challenge — a staff
   * account's first login after AdminCreateUser's auto-emailed temp
   * password. session comes from the login() error the challenge raised. */
  async completeNewPassword(username: string, newPassword: string, session: string): Promise<AuthResponse> {
    const { data } = await apiClient.post(ENDPOINTS.AUTH.NEW_PASSWORD, { username, new_password: newPassword, session });
    const access_token: string = data.access_token;
    const meRes = await apiClient.get(ENDPOINTS.AUTH.ME, { headers: { Authorization: `Bearer ${access_token}` } });
    return { access_token, refresh_token: data.refresh_token ?? "", expires_in: 0, user: meToUser(meRes.data as MeResponse) };
  },

  /** Local dev only — single-step registration, no OTP. 404s once
   * auth_mode == 'cognito'; real signup is the OTP wizard below. */
  async register(formData: RegisterData): Promise<AuthResponse> {
    const { data } = await apiClient.post(ENDPOINTS.AUTH.REGISTER, {
      email: formData.email,
      first_name: formData.first_name,
      last_name: formData.last_name,
      phone: formData.phone,
      gender: formData.gender,
      dob: formData.date_of_birth,
      address: formData.address,
      city: formData.city,
      state: formData.state,
      country: formData.country,
      pincode: formData.pincode,
      primary_clinic_id: formData.clinic_id,
      guardian_name: formData.guardian_name,
      guardian_relationship: formData.guardian_relationship,
      guardian_contact: formData.guardian_contact,
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

  // ─── Real patient signup wizard (cognito mode only) ───────────────────────

  isRealSignupEnabled: getAuthMode,

  /** Step 1 — details + the patient's chosen password. Starts Cognito's
   * SignUp with that password and auto-sends the OTP. Nothing written to our
   * DB yet. */
  async patientSignupStart(data: {
    first_name: string; last_name: string; dob?: string; gender?: string; address?: string;
    city?: string; state?: string; country?: string; pincode?: string; primary_clinic_id: string;
    method: "email" | "mobile"; contact: string; password: string; confirm_password: string;
    guardian_name?: string; guardian_relationship?: string; guardian_contact?: string;
  }): Promise<void> {
    await apiClient.post(ENDPOINTS.AUTH.SIGNUP_START, data);
  },

  async patientSignupResend(contact: string): Promise<void> {
    await apiClient.post(ENDPOINTS.AUTH.SIGNUP_RESEND, { contact });
  },

  /** Step 2 — the OTP plus the same form as Start (stateless wizard).
   * Verifies the code, creates the account and logs in, in ONE call, so a
   * patient can't abandon signup between "verified" and "account exists". */
  async patientSignupComplete(data: {
    first_name: string; last_name: string; dob?: string; gender?: string; address?: string;
    city?: string; state?: string; country?: string; pincode?: string; primary_clinic_id: string;
    method: "email" | "mobile"; contact: string; password: string; code: string;
    guardian_name?: string; guardian_relationship?: string; guardian_contact?: string;
  }): Promise<AuthResponse> {
    const { data: res } = await apiClient.post(ENDPOINTS.AUTH.SIGNUP_CONFIRM, data);
    const access_token: string = res.access_token;
    const meRes = await apiClient.get(ENDPOINTS.AUTH.ME, { headers: { Authorization: `Bearer ${access_token}` } });
    return { access_token, refresh_token: "", expires_in: 0, user: meToUser(meRes.data as MeResponse) };
  },

  /** Post-signup: adds + sends a verification code for the channel NOT used
   * at signup (authenticated — apiClient already attaches the Bearer token). */
  async verifyChannelStart(attribute: "email" | "phone_number", value: string): Promise<void> {
    await apiClient.post(ENDPOINTS.AUTH.VERIFY_CHANNEL_START, { attribute, value });
  },

  async verifyChannelConfirm(attribute: "email" | "phone_number", code: string, value: string): Promise<void> {
    await apiClient.post(ENDPOINTS.AUTH.VERIFY_CHANNEL_CONFIRM, { attribute, code, value });
  },

  // NOT AVAILABLE — no sync-profile concept (profile is created at staff/admin registration time).
  async syncProfile(_data: Partial<RegisterData> & { email: string; full_name?: string }): Promise<void> {
    throw new Error("Profile sync isn't available.");
  },

  // ─── Forgot password (cognito mode only — 404s under local auth) ─────────

  /** Always resolves regardless of whether the username exists — the
   * backend intentionally returns 204 either way to avoid leaking account
   * existence. Show the same "check your email/phone" message unconditionally. */
  async forgotPasswordStart(username: string): Promise<void> {
    await apiClient.post(ENDPOINTS.AUTH.FORGOT_PASSWORD_START, { username });
  },

  /** Sets the new password directly — Cognito's ConfirmForgotPassword does
   * the code check and password change in one call. */
  async forgotPasswordConfirm(username: string, code: string, newPassword: string, confirmPassword: string): Promise<void> {
    await apiClient.post(ENDPOINTS.AUTH.FORGOT_PASSWORD_CONFIRM, {
      username, code, new_password: newPassword, confirm_password: confirmPassword,
    });
  },
};
