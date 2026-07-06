import apiClient from "../client";

export interface ConsentTemplate {
  template_id: string;
  consent_type: string;
  role: string | null;
  version: number;
  title: string;
  content: string;
  is_active: boolean;
}

export interface ConsentRecord {
  consent_id: string;
  consent_type: string;
  template_id: string;
  patient_id: string | null;
  staff_id: string | null;
  clinic_id: string;
  status: "pending" | "signed" | "revoked";
  signed_at: string | null;
  created_at: string;
}

export const consentService = {
  /** Staff-onboarding templates are now split one-per-role (doctor, CA,
   * receptionist, clinic_admin, regional_admin, super_admin) instead of one
   * shared [ROLE]-placeholder template — role must be passed for those to
   * get the right wording. patient_onboarding (and the other non-role-split
   * types) have a single row with role=null, so omit role for those. */
  async getTemplate(consentType: string, role?: string | null): Promise<ConsentTemplate | null> {
    const { data } = await apiClient.get("/consent-templates");
    const list: ConsentTemplate[] = Array.isArray(data) ? data : [];
    return list.find((t) => t.consent_type === consentType && t.is_active && (t.role ?? null) === (role ?? null)) ?? null;
  },

  /** Finds the caller's own pending onboarding consent — staff_id/patient_id
   * is the profile id (same as /auth/me's `id`), which is how consent_records
   * are keyed for whoever needs to sign. */
  async getMyPending(profileId: string, role: string): Promise<ConsentRecord | null> {
    const param = role === "patient" ? "patient_id" : "staff_id";
    const { data } = await apiClient.get("/consent-records", { params: { [param]: profileId } });
    const list: ConsentRecord[] = Array.isArray(data) ? data : [];
    return list.find((r) => r.status === "pending") ?? null;
  },

  /** All consent records for a person (not just pending) — used by the
   * admin Staff/Patients detail views to show real consent status instead
   * of just the derived is_active flag. */
  async listForSubject(params: { patient_id?: string; staff_id?: string }): Promise<ConsentRecord[]> {
    const { data } = await apiClient.get("/consent-records", { params });
    return Array.isArray(data) ? data : [];
  },

  async sign(consentId: string, payload: { signature_data: string; witness_id?: string }): Promise<ConsentRecord> {
    const { data } = await apiClient.patch(`/consent-records/${consentId}/status`, {
      status: "signed",
      sign: { signature_data: payload.signature_data, witness_id: payload.witness_id || undefined },
    });
    return data;
  },
};
