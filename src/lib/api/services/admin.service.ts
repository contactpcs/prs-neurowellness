import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type {
  AdminDashboard,
  AdminClinic,
  AdminRegion,
  AdminAccount,
  ClinicAdminAssignPayload,
  RegionalAdminAssignPayload,
  CreateClinicPayload,
  AdminStaffMember,
  RegisterStaffPayload,
  AdminPatient,
} from "@/types/admin.types";

/** Real backend has no `is_active` boolean — clinics carry a `status` enum
 * (setup|active|pending_closure|closed). Derived here so the rest of the
 * app can keep reading the boolean it always expected. */
function mapClinic(c: Record<string, unknown>): AdminClinic {
  return {
    clinic_id: String(c.clinic_id ?? ""),
    clinic_code: String(c.clinic_code ?? ""),
    clinic_name: String(c.clinic_name ?? ""),
    clinic_type: (c.clinic_type as AdminClinic["clinic_type"]) ?? "anava_owned",
    status: (c.status as AdminClinic["status"]) ?? "setup",
    region_id: String(c.region_id ?? ""),
    clinic_admin_id: (c.clinic_admin_id as string | null) ?? null,
    is_main_branch: Boolean(c.is_main_branch),
    address: (c.address as string) ?? undefined,
    city: (c.city as string) ?? undefined,
    state: (c.state as string) ?? undefined,
    phone: (c.phone as string) ?? undefined,
    email: (c.email as string) ?? undefined,
    is_active: c.status === "active",
    created_at: (c.created_at as string) ?? undefined,
  };
}

export const adminService = {
  // ─── Regions ───
  async getRegions(): Promise<AdminRegion[]> {
    const { data } = await apiClient.get("/regions");
    return Array.isArray(data) ? data : [];
  },

  async getRegion(id: string): Promise<AdminRegion> {
    const { data } = await apiClient.get(`/regions/${id}`);
    return data;
  },

  async createRegion(payload: { region_name: string; country: string; state: string }): Promise<AdminRegion> {
    const { data } = await apiClient.post("/regions", payload);
    return data;
  },

  async updateRegion(id: string, payload: { region_name?: string; is_active?: boolean }): Promise<AdminRegion> {
    const { data } = await apiClient.patch(`/regions/${id}`, payload);
    return data;
  },

  async deleteRegion(id: string): Promise<void> {
    await apiClient.delete(`/regions/${id}`);
  },

  async assignRegionalAdmin(regionId: string, payload: RegionalAdminAssignPayload): Promise<AdminRegion> {
    const { data } = await apiClient.post(`/regions/${regionId}/assign-admin`, payload);
    return data;
  },

  // ─── Admins (regional_admin / clinic_admin management view) ───
  async getAdmins(params?: { admin_type?: string; region_id?: string; clinic_id?: string }): Promise<AdminAccount[]> {
    const { data } = await apiClient.get("/admins", { params });
    return Array.isArray(data) ? data : [];
  },

  // ─── Dashboard — no aggregate endpoint, composed from real counts ───
  async getDashboard(): Promise<AdminDashboard> {
    const [clinicsRes, patientsRes] = await Promise.all([
      apiClient.get(ENDPOINTS.ADMIN.CLINICS),
      apiClient.get(ENDPOINTS.ADMIN.PATIENTS),
    ]);
    const clinics = (Array.isArray(clinicsRes.data) ? clinicsRes.data : []).map(mapClinic);
    const patients = Array.isArray(patientsRes.data) ? patientsRes.data : [];
    return {
      stats: {
        total_clinics: clinics.length,
        total_doctors: 0,
        total_receptionists: 0,
        total_clinical_assistants: 0,
        total_patients: patients.length,
        pending_approvals: 0,
        active_assessments: 0,
      },
      clinic_breakdown: clinics.map((c) => ({
        clinic_id: c.clinic_id,
        clinic_name: c.clinic_name,
        city: c.city,
        state: c.state,
        is_active: c.is_active,
        staff_count: 0,
        patient_count: 0,
      })),
    };
  },

  // ─── Clinics ───
  async getClinics(params?: { region_id?: string }): Promise<AdminClinic[]> {
    const res = await apiClient.get(ENDPOINTS.ADMIN.CLINICS, { params });
    const payload = Array.isArray(res.data) ? res.data : [];
    return payload.map(mapClinic);
  },

  async getClinic(id: string): Promise<AdminClinic> {
    const res = await apiClient.get(ENDPOINTS.ADMIN.CLINIC(id));
    return mapClinic(res.data);
  },

  // 2-step flow — clinic_admin_id is never sent here (backend rejects it as
  // an unknown field; the schema doesn't accept it at create time anymore).
  async createClinic(payload: CreateClinicPayload): Promise<AdminClinic> {
    const res = await apiClient.post(ENDPOINTS.ADMIN.CLINICS, payload);
    return mapClinic(res.data);
  },

  // Step 2 — creates the clinic_admin person and assigns them in one call.
  async assignClinicAdmin(clinicId: string, payload: ClinicAdminAssignPayload): Promise<AdminClinic> {
    const res = await apiClient.post(`/clinics/${clinicId}/assign-admin`, payload);
    return mapClinic(res.data);
  },

  async updateClinic(id: string, payload: Partial<CreateClinicPayload>): Promise<AdminClinic> {
    const res = await apiClient.patch(ENDPOINTS.ADMIN.CLINIC(id), payload);
    return mapClinic(res.data);
  },

  async activateClinic(id: string): Promise<void> {
    await apiClient.patch(ENDPOINTS.ADMIN.ACTIVATE_CLINIC(id), { status: "active" });
  },

  async deactivateClinic(id: string): Promise<void> {
    await apiClient.patch(ENDPOINTS.ADMIN.DEACTIVATE_CLINIC(id), { status: "pending_closure" });
  },

  async deleteClinic(id: string): Promise<void> {
    await apiClient.delete(ENDPOINTS.ADMIN.CLINIC(id));
  },

  // ─── Staff — composed from the 3 role-specific lists, no single /admin/staff.
  // Each sub-fetch is caught individually so one role's failure doesn't blank
  // out the other two (this was the root cause of "list sometimes shows empty"). ───
  async getStaff(params?: { clinic_id?: string; role?: string; search?: string; skip?: number; limit?: number }): Promise<{ staff: AdminStaffMember[]; total: number }> {
    const [doctorsRes, casRes, receptionistsRes, clinicsRes] = await Promise.allSettled([
      apiClient.get("/doctors", { params }),
      apiClient.get("/clinical-assistants", { params }),
      apiClient.get("/receptionists", { params }),
      apiClient.get(ENDPOINTS.ADMIN.CLINICS),
    ]);

    const clinicNameById = new Map<string, string>();
    if (clinicsRes.status === "fulfilled" && Array.isArray(clinicsRes.value.data)) {
      for (const c of clinicsRes.value.data) clinicNameById.set(String(c.clinic_id), String(c.clinic_name ?? ""));
    }

    const toMember = (row: Record<string, unknown>, role: string, idField: string): AdminStaffMember => {
      const clinicId = (row.clinic_id as string) ?? undefined;
      return {
        id: String(row[idField] ?? ""),
        profile_id: (row.profile_id as string) ?? undefined,
        first_name: String(row.first_name ?? ""),
        last_name: String(row.last_name ?? ""),
        email: String(row.email ?? ""),
        phone: (row.phone as string) ?? undefined,
        role,
        clinic_id: clinicId,
        clinic_name: clinicId ? clinicNameById.get(clinicId) ?? clinicId : undefined,
        // profile_is_active is the real consent-gate signal (joined from
        // profiles). doctors/clinical_assistants/receptionists each have
        // their own separate `is_active` column too (a staff-management
        // on/off flag, unrelated to consent, defaults TRUE) — using that
        // one here was the bug: it showed "Active" for people who'd never
        // signed their onboarding consent.
        is_active: (row.profile_is_active as boolean) ?? true,
        created_at: (row.created_at as string) ?? undefined,
        specialization: (row.specialization as string) ?? undefined,
        license_number: (row.license_number as string) ?? undefined,
        hospital_affiliation: (row.hospital_affiliation as string) ?? undefined,
        max_patient_count: (row.max_patient_count as number) ?? undefined,
        qualification: (row.qualification as string) ?? undefined,
      };
    };

    const list: AdminStaffMember[] = [
      ...(doctorsRes.status === "fulfilled" && Array.isArray(doctorsRes.value.data) ? doctorsRes.value.data.map((d: Record<string, unknown>) => toMember(d, "doctor", "doctor_id")) : []),
      ...(casRes.status === "fulfilled" && Array.isArray(casRes.value.data) ? casRes.value.data.map((c: Record<string, unknown>) => toMember(c, "clinical_assistant", "ca_id")) : []),
      ...(receptionistsRes.status === "fulfilled" && Array.isArray(receptionistsRes.value.data) ? receptionistsRes.value.data.map((r: Record<string, unknown>) => toMember(r, "receptionist", "receptionist_id")) : []),
    ];
    return { staff: list, total: list.length };
  },

  /** Raw, unmapped record straight from the role-specific GET-by-id endpoint
   * — used by the "show everything in the DB" detail modal, which doesn't
   * want the narrowed AdminStaffMember shape the list view uses. */
  async getStaffDetail(id: string, role: string): Promise<Record<string, unknown>> {
    const path = role === "doctor" ? `/doctors/${id}`
      : role === "clinical_assistant" ? `/clinical-assistants/${id}`
      : `/receptionists/${id}`;
    const [{ data }, clinicsRes] = await Promise.all([
      apiClient.get(path),
      apiClient.get(ENDPOINTS.ADMIN.CLINICS).catch(() => ({ data: [] as unknown[] })),
    ]);
    const clinicNameById = new Map<string, string>();
    if (Array.isArray(clinicsRes.data)) {
      for (const c of clinicsRes.data as Record<string, unknown>[]) clinicNameById.set(String(c.clinic_id), String(c.clinic_name ?? ""));
    }
    return data.clinic_id ? { ...data, clinic_name: clinicNameById.get(String(data.clinic_id)) ?? null } : data;
  },

  /** Real backend has 3 separate role-specific creation endpoints, no
   * password (Cognito-based invite flow), and needs clinic_id explicitly. */
  async registerStaff(payload: RegisterStaffPayload): Promise<AdminStaffMember> {
    const path = payload.role === "doctor" ? "/doctors"
      : payload.role === "clinical_assistant" ? "/clinical-assistants"
      : "/receptionists";
    const res = await apiClient.post(path, {
      email: payload.email,
      first_name: payload.first_name,
      last_name: payload.last_name,
      phone: payload.phone || undefined,
      clinic_id: payload.clinic_id,
      gender: payload.gender || undefined,
      dob: payload.dob || undefined,
      address: payload.address || undefined,
      city: payload.city || undefined,
      state: payload.state || undefined,
      country: payload.country || undefined,
      pincode: payload.pincode || undefined,
      staff_request_id: payload.staff_request_id || undefined,
      ...(payload.role === "doctor" ? {
        specialization: payload.specialization || undefined,
        license_number: payload.license_number || undefined,
        hospital_affiliation: payload.hospital_affiliation || undefined,
        max_patient_count: payload.max_patient_count || undefined,
      } : {}),
      ...(payload.role === "clinical_assistant" ? {
        qualification: payload.qualification || undefined,
      } : {}),
    });
    return {
      ...res.data,
      id: res.data.doctor_id ?? res.data.ca_id ?? res.data.receptionist_id,
      first_name: res.data.first_name, last_name: res.data.last_name, email: res.data.email,
      role: payload.role, is_active: res.data.profile_is_active ?? false,
    };
  },

  /** Real backend has 3 separate role-specific PATCH endpoints — payload.role
   * (always present, the edit form is seeded from the existing member) picks
   * which one. Both profile fields (name/phone/...) and role-specific fields
   * (specialization, qualification, ...) go through the same PATCH — the
   * backend splits them server-side. */
  async updateStaff(id: string, payload?: Partial<RegisterStaffPayload>): Promise<AdminStaffMember> {
    const role = payload?.role;
    const path = role === "doctor" ? `/doctors/${id}`
      : role === "clinical_assistant" ? `/clinical-assistants/${id}`
      : `/receptionists/${id}`;
    const { data } = await apiClient.patch(path, {
      first_name: payload?.first_name || undefined,
      last_name: payload?.last_name || undefined,
      phone: payload?.phone || undefined,
      gender: payload?.gender || undefined,
      dob: payload?.dob || undefined,
      address: payload?.address || undefined,
      specialization: payload?.specialization || undefined,
      license_number: payload?.license_number || undefined,
      hospital_affiliation: payload?.hospital_affiliation || undefined,
      max_patient_count: payload?.max_patient_count || undefined,
      qualification: payload?.qualification || undefined,
    });
    return {
      ...data,
      id: data.doctor_id ?? data.ca_id ?? data.receptionist_id ?? id,
      role: role ?? "",
      is_active: data.profile_is_active ?? true,
    };
  },

  /** Toggle the role-slot's own on/off flag (NOT the delete/consent
   * profile.is_active signal) — doctors use availability_status, CAs and
   * receptionists have a real is_active column. */
  async _setStaffActive(id: string, role: string | undefined, active: boolean): Promise<void> {
    if (role === "doctor") {
      await apiClient.patch(`/doctors/${id}`, { availability_status: active ? "available" : "inactive" });
    } else if (role === "clinical_assistant") {
      await apiClient.patch(`/clinical-assistants/${id}`, { is_active: active });
    } else if (role === "receptionist") {
      await apiClient.patch(`/receptionists/${id}`, { is_active: active });
    } else {
      throw new Error("Could not determine this staff member's role.");
    }
  },
  async deactivateStaff(id: string, role?: string): Promise<void> {
    await this._setStaffActive(id, role, false);
  },
  async reactivateStaff(id: string, role?: string): Promise<void> {
    await this._setStaffActive(id, role, true);
  },

  /** Never a real DELETE — the backend soft-deletes (deleted_at set,
   * profile deactivated) so clinical history/audit trail is retained. The
   * person disappears from this list immediately either way. */
  async deleteStaff(id: string, role?: string): Promise<void> {
    const path = role === "doctor" ? `/doctors/${id}`
      : role === "clinical_assistant" ? `/clinical-assistants/${id}`
      : role === "receptionist" ? `/receptionists/${id}`
      : null;
    if (!path) throw new Error("Could not determine this staff member's role.");
    await apiClient.delete(path);
  },

  // ─── Patients ───
  async getPatients(params?: { clinic_id?: string; status?: string; search?: string; skip?: number; limit?: number }): Promise<{ patients: AdminPatient[]; total: number }> {
    const [res, clinicsRes] = await Promise.all([
      apiClient.get(ENDPOINTS.ADMIN.PATIENTS, { params }),
      apiClient.get(ENDPOINTS.ADMIN.CLINICS).catch(() => ({ data: [] as unknown[] })),
    ]);
    const clinicNameById = new Map<string, string>();
    if (Array.isArray(clinicsRes.data)) {
      for (const c of clinicsRes.data as Record<string, unknown>[]) clinicNameById.set(String(c.clinic_id), String(c.clinic_name ?? ""));
    }
    const list: Record<string, unknown>[] = Array.isArray(res.data) ? res.data : [];
    const patients: AdminPatient[] = list.map((p) => {
      const clinicId = (p.primary_clinic_id as string) ?? undefined;
      return {
      id: String(p.patient_id ?? ""),
      profile_id: (p.profile_id as string) ?? undefined,
      first_name: String(p.first_name ?? ""),
      last_name: String(p.last_name ?? ""),
      email: String(p.email ?? ""),
      phone: (p.phone as string) ?? undefined,
      date_of_birth: (p.dob as string) ?? undefined,
      gender: (p.gender as string) ?? undefined,
      clinic_id: clinicId,
      clinic_name: clinicId ? clinicNameById.get(clinicId) ?? clinicId : undefined,
      approval_status: "approved" as const,
      registration_status: (p.registration_status as string) ?? undefined,
      mrn: (p.mrn as string) ?? undefined,
      registered_at: (p.registration_completed_at as string) ?? undefined,
      created_at: (p.created_at as string) ?? undefined,
      };
    });
    return { patients, total: patients.length };
  },

  async registerPatient(payload: { email: string; first_name: string; last_name: string; phone?: string; gender?: string; dob?: string; address?: string; primary_clinic_id: string; emergency_contact_name?: string; emergency_contact_phone?: string }): Promise<AdminPatient> {
    const { data } = await apiClient.post(ENDPOINTS.ADMIN.PATIENTS, payload);
    return {
      id: String(data.patient_id ?? ""), profile_id: data.profile_id ?? undefined,
      first_name: data.first_name, last_name: data.last_name,
      email: data.email, phone: data.phone ?? undefined, clinic_id: payload.primary_clinic_id, approval_status: "approved",
      registration_status: data.registration_status ?? undefined,
      mrn: data.mrn ?? undefined, created_at: data.created_at ?? undefined,
    };
  },

  /** Raw, unmapped record straight from GET /patients/{id} — used by the
   * "show everything in the DB" detail modal. Also pulls disease selection,
   * anamnesis responses, and general-registration PRS results so the modal
   * can show the patient's full onboarding record in one place. */
  async getPatientDetail(id: string): Promise<Record<string, unknown>> {
    const [{ data }, clinicsRes, diseasesRes, diseaseSelectionRes, anamnesisCatalogRes] = await Promise.all([
      apiClient.get(`/patients/${id}`),
      apiClient.get(ENDPOINTS.ADMIN.CLINICS).catch(() => ({ data: [] as unknown[] })),
      apiClient.get(ENDPOINTS.PRS.CONDITIONS).catch(() => ({ data: [] as unknown[] })),
      apiClient.get(ENDPOINTS.PATIENTS.DISEASE_SELECTION(id)).catch(() => ({ data: [] as unknown[] })),
      apiClient.get(ENDPOINTS.ANAMNESIS.QUESTIONS).catch(() => ({ data: [] as unknown[] })),
    ]);
    const clinicNameById = new Map<string, string>();
    if (Array.isArray(clinicsRes.data)) {
      for (const c of clinicsRes.data as Record<string, unknown>[]) clinicNameById.set(String(c.clinic_id), String(c.clinic_name ?? ""));
    }
    const diseaseNameById = new Map<string, string>();
    if (Array.isArray(diseasesRes.data)) {
      for (const d of diseasesRes.data as Record<string, unknown>[]) diseaseNameById.set(String(d.disease_id), String(d.disease_name ?? ""));
    }
    const diseaseSelections = (Array.isArray(diseaseSelectionRes.data) ? diseaseSelectionRes.data : []) as Record<string, unknown>[];
    const diseases = diseaseSelections.map((sel) => ({
      ...sel,
      disease_name: sel.disease_id ? diseaseNameById.get(String(sel.disease_id)) ?? null : null,
    }));

    let anamnesis: Record<string, unknown> | null = null;
    let anamnesisResponses: Record<string, unknown>[] = [];
    try {
      const { data: assessment } = await apiClient.get(ENDPOINTS.ANAMNESIS.FOR_PATIENT(id));
      anamnesis = assessment;
      if (assessment?.anamnesis_id) {
        const { data: responses } = await apiClient.get(ENDPOINTS.ANAMNESIS.RESPONSES(assessment.anamnesis_id));
        anamnesisResponses = Array.isArray(responses) ? responses : [];
      }
    } catch {
      anamnesis = null;
    }

    let generalPrs: Record<string, unknown> | null = null;
    try {
      const { data: instances } = await apiClient.get(ENDPOINTS.PRS.PATIENT_INSTANCES(id), {
        params: { assessment_stage: "general_registration" },
      });
      const latest = Array.isArray(instances) ? instances[0] : undefined;
      if (latest?.instance_id) {
        const { data: results } = await apiClient.get(ENDPOINTS.PRS.INSTANCE_SCORE(latest.instance_id));
        generalPrs = { instance: latest, ...results };
      }
    } catch {
      generalPrs = null;
    }

    return {
      ...data,
      clinic_name: data.primary_clinic_id ? clinicNameById.get(String(data.primary_clinic_id)) ?? null : null,
      diseases,
      anamnesis,
      anamnesis_responses: anamnesisResponses,
      anamnesis_catalog: Array.isArray(anamnesisCatalogRes.data) ? anamnesisCatalogRes.data : [],
      general_prs: generalPrs,
    };
  },

  async updatePatient(id: string, payload: { first_name?: string; last_name?: string; phone?: string; gender?: string; dob?: string; address?: string; emergency_contact_name?: string; emergency_contact_phone?: string }): Promise<AdminPatient> {
    const { data } = await apiClient.patch(`/patients/${id}`, payload);
    return {
      id: String(data.patient_id ?? id), profile_id: data.profile_id ?? undefined,
      first_name: data.first_name ?? "", last_name: data.last_name ?? "", email: data.email ?? "",
      phone: data.phone ?? undefined, date_of_birth: data.dob ?? undefined, gender: data.gender ?? undefined,
      clinic_id: data.primary_clinic_id ?? undefined, approval_status: "approved",
      registration_status: data.registration_status ?? undefined,
      mrn: data.mrn ?? undefined, created_at: data.created_at ?? undefined,
    };
  },

  async approvePatient(_id: string): Promise<void> {
    throw new Error("Patient approval isn't a backend-v2 concept — registration completes automatically.");
  },
  async rejectPatient(_id: string): Promise<void> {
    throw new Error("Patient rejection isn't a backend-v2 concept.");
  },

  /** Never a real DELETE — patients table has an explicit comment: "soft
   * delete — deactivate, never physically remove PHI records". Marks the
   * patient and their profile deleted/inactive; the row and all clinical
   * history stay in the database for compliance/audit. */
  async deletePatient(id: string): Promise<void> {
    await apiClient.delete(`/patients/${id}`);
  },
};
