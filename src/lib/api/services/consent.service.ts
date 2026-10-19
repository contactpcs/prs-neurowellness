import apiClient from "../client";

/** One checkbox on a consent form — defined by the super admin per template version. */
export interface ConsentClause {
  code: string;
  label: string;
  required: boolean;
}

export interface ConsentClauseResponse extends ConsentClause {
  accepted: boolean;
}

export interface ConsentTemplate {
  template_id: string;
  consent_type: string;
  role: string | null;
  language: string;
  version: number;
  title: string;
  content: string;
  clauses: ConsentClause[];
  content_hash: string | null;
  is_active: boolean;
  published_at: string | null;
  created_at: string;
}

export interface ConsentTemplateDraft {
  consent_type: string;
  role?: string | null;
  language?: string;
  title: string;
  content: string;
  clauses: ConsentClause[];
}

export interface ConsentRecord {
  consent_id: string;
  consent_type: string;
  template_id: string;
  patient_id: string | null;
  staff_id: string | null;
  clinic_id: string | null;
  status: "pending" | "signed" | "revoked";
  signed_at: string | null;
  signer_type: "self" | "guardian" | null;
  signer_name: string | null;
  pdf_available: boolean;
  created_at: string;
}

export interface ConsentSigner {
  signer_type: "self" | "guardian";
  name: string;
  relation: string | null;
  contact: string | null;
  guardian_reason: string | null;
  on_behalf_of: string | null;
}

/** The consent exactly as it must be shown (pending) or as it was signed. */
export interface ConsentDocument {
  consent_id: string;
  consent_type: string;
  status: "pending" | "signed" | "revoked";
  template_id: string;
  version: number;
  language: string;
  title: string;
  content: string;
  clauses: (ConsentClause & { accepted?: boolean })[];
  rendered_hash: string;
  signer: ConsentSigner | null;
  signed_at: string | null;
  pdf_available: boolean;
}

export const consentService = {
  /** The caller's next consent to sign, or null when nothing is pending. */
  async getMyPending(): Promise<ConsentDocument | null> {
    const { data } = await apiClient.get("/consent-records/me/pending");
    return data ?? null;
  },

  /** All consent records for a person — admin Staff/Patients detail views. */
  async listForSubject(params: { patient_id?: string; staff_id?: string }): Promise<ConsentRecord[]> {
    const { data } = await apiClient.get("/consent-records", { params });
    return Array.isArray(data) ? data : [];
  },

  /** Signed: the exact text, ticks and signer stored at signing. */
  async getDocument(consentId: string): Promise<ConsentDocument> {
    const { data } = await apiClient.get(`/consent-records/${consentId}/document`);
    return data;
  },

  /** Opens the signed PDF (short-lived download link). */
  async downloadPdf(consentId: string): Promise<void> {
    const { data } = await apiClient.get(`/consent-records/${consentId}/pdf`);
    window.open(data.url, "_blank", "noopener");
  },

  /** accepted = codes of the ticked boxes; renderedHash = the hash of the
   * text that was displayed (from getMyPending) — the server refuses if the
   * wording changed in between. */
  async sign(consentId: string, accepted: string[], renderedHash: string): Promise<ConsentRecord> {
    const { data } = await apiClient.patch(`/consent-records/${consentId}/status`, {
      status: "signed",
      accepted,
      rendered_hash: renderedHash,
    });
    return data;
  },

  // ─── Super admin: template management ───
  async listTemplates(includeDrafts = false): Promise<ConsentTemplate[]> {
    const { data } = await apiClient.get("/consent-templates", { params: { include_drafts: includeDrafts } });
    return Array.isArray(data) ? data : [];
  },

  async createTemplate(draft: ConsentTemplateDraft): Promise<ConsentTemplate> {
    const { data } = await apiClient.post("/consent-templates", draft);
    return data;
  },

  async updateTemplate(templateId: string, patch: Partial<Pick<ConsentTemplateDraft, "title" | "content" | "clauses">>): Promise<ConsentTemplate> {
    const { data } = await apiClient.patch(`/consent-templates/${templateId}`, patch);
    return data;
  },

  async deleteTemplate(templateId: string): Promise<void> {
    await apiClient.delete(`/consent-templates/${templateId}`);
  },

  async publishTemplate(templateId: string, requireReconsent: boolean): Promise<ConsentTemplate & { reconsent_count: number }> {
    const { data } = await apiClient.post(`/consent-templates/${templateId}/publish`, { require_reconsent: requireReconsent });
    return data;
  },
};
