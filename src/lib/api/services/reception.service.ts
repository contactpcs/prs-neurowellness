import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { PatientListItem, PatientDetail, DoctorListItem, StaffDashboard, Notification } from "@/types/domain.types";

/**
 * Receptionist-only adapter — talks to backend/app/modules/reception
 * (`/api/v1/reception/*`), a dedicated module scoped to
 * receptionist/clinic_admin/regional_admin/super_admin (403 for other
 * roles). Do NOT import this from clinical-assistant screens — they share
 * staff.service.ts's generic /patients-based endpoints instead, which stay
 * untouched.
 *
 * Field coverage matches Documents/Reception_API_Integration_Guide.md
 * exactly — several fields the old generic staffService could populate
 * (email/dob on the list view, mrn, clinic name, patient_count per doctor)
 * have no equivalent here and are left undefined rather than guessed.
 */

export interface RegisterPatientPayload {
  first_name: string;
  last_name: string;
  gender: string;
  date_of_birth: string;
  /** Login channel — the contact below becomes the patient's login ID. */
  channel: "phone" | "email";
  contact: string;
  street?: string;
  city: string;
  state: string;
  country?: string;
  pincode?: string;
  guardian?: { name: string; relation: string; contact_number: string };
  password: string;
}

function splitName(fullName: string): { first: string; last: string } {
  const parts = fullName.trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

function normalizePatientListItem(raw: Record<string, unknown>): PatientListItem {
  const full = String(raw.full_name ?? "");
  const { first, last } = splitName(full);
  return {
    id: String(raw.patient_id ?? ""),
    full_name: full,
    first_name: first,
    last_name: last,
    email: "",
    phone: (raw.phone as string) ?? undefined,
    age: (raw.age as number | null) ?? undefined,
    gender: (raw.gender as string) ?? undefined,
    status: (raw.registration_status as string) ?? undefined,
    doctor_id: null,
    doctor_name: (raw.assigned_doctor as string | null) ?? null,
    last_visit: (raw.last_visit as string | null) ?? null,
    next_appointment: (raw.next_appointment as string | null) ?? null,
  };
}

function normalizePatientProfile(raw: Record<string, unknown>): PatientDetail {
  const full = String(raw.full_name ?? "");
  const { first, last } = splitName(full);
  const personal = (raw.personal ?? {}) as Record<string, unknown>;
  const contact = (raw.contact ?? {}) as Record<string, unknown>;
  return {
    id: String(raw.patient_id ?? ""),
    full_name: full,
    first_name: first,
    last_name: last,
    email: (contact.email as string) ?? "",
    phone: (contact.phone as string) ?? undefined,
    date_of_birth: (personal.date_of_birth as string) ?? undefined,
    gender: (personal.gender as string) ?? undefined,
    status: (raw.registration_status as string) ?? undefined,
    approval_status: (raw.approval_status as string) ?? undefined,
    doctor_id: null,
    doctor_name: (raw.assigned_doctor as string | null) ?? null,
  };
}

export type ReceptionListQuery = { page?: number; pageSize?: number; search?: string };

function mapRegistrations(all: Record<string, unknown>[]): PatientListItem[] {
  const patients: PatientListItem[] = all.map((r) => {
      const full = String(r.full_name ?? "");
      const { first, last } = splitName(full);
      const isEmail = r.contact_type === "email";
      return {
        id: String(r.registration_id ?? ""),
        full_name: full,
        first_name: first,
        last_name: last,
        email: isEmail ? String(r.contact ?? "") : "",
        phone: isEmail ? undefined : (r.contact as string) ?? undefined,
        status: (r.status as string) ?? undefined,
        rejection_reason: (r.rejection_reason as string | null) ?? null,
        risk_flags: Array.isArray(r.risk_flags) ? (r.risk_flags as string[]) : [],
        created_at: (r.submitted_on as string) ?? undefined,
        registered_at: (r.submitted_on as string) ?? undefined,
        doctor_id: null,
        doctor_name: null,
      };
    });
  return patients;
}

export const receptionService = {
  /** Registration requires an explicit clinic_id in the body — resolved from
   * the receptionist's own /auth/me, same as the old generic-endpoint flow. */
  async resolveOwnClinicId(): Promise<string> {
    const { data } = await apiClient.get(ENDPOINTS.AUTH.ME);
    if (!data?.clinic_id) throw new Error("Your account has no assigned clinic — cannot register a patient.");
    return data.clinic_id as string;
  },

  // ─── Dashboard (§ API audit F-019) ───
  // One call: counts + first 5 actionable registrations, all computed
  // server-side. Used to download every patient and every pending
  // registration just to count them.
  async getDashboard(): Promise<StaffDashboard & { pending_preview: PatientListItem[] }> {
    const { data } = await apiClient.get(ENDPOINTS.RECEPTION.DASHBOARD);
    return {
      patient_count: data?.patient_count ?? 0,
      pending_count: data?.pending_count ?? 0,
      registered_today: data?.registered_today ?? 0,
      upcoming_sessions: [],
      recent_scores: [],
      pending_preview: mapRegistrations(Array.isArray(data?.pending_preview) ? data.pending_preview : []),
    };
  },

  // ─── Patients (§4.5) ───
  // One server page per call; search (name/phone/email/MRN/doctor), gender
  // and doctor (assigned doctor's full name) are applied in SQL (API audit
  // F-020/F-021). Used to loop every page and filter client-side.
  async getPatients(params?: ReceptionListQuery & { gender?: string; doctor?: string }): Promise<{
    patients: PatientListItem[];
    total: number;
    totalPages: number;
  }> {
    const { data } = await apiClient.get(ENDPOINTS.RECEPTION.PATIENTS, {
      params: {
        page: params?.page ?? 1,
        page_size: params?.pageSize ?? 100,
        search: params?.search || undefined,
        gender: params?.gender || undefined,
        doctor: params?.doctor || undefined,
      },
    });
    const items: Record<string, unknown>[] = Array.isArray(data?.items) ? data.items : [];
    return {
      patients: items.map(normalizePatientListItem),
      total: data?.pagination?.total_items ?? items.length,
      totalPages: data?.pagination?.total_pages ?? 1,
    };
  },

  // ─── Registrations / Approvals queue (§4.6-4.8) ───
  // One server page per call; status + search applied in SQL.
  async getRegistrations(params?: ReceptionListQuery & { status?: "pending" | "approved" | "rejected" }): Promise<{
    patients: PatientListItem[];
    total: number;
    totalPages: number;
  }> {
    const { data } = await apiClient.get(ENDPOINTS.RECEPTION.REGISTRATIONS, {
      params: {
        page: params?.page ?? 1,
        page_size: params?.pageSize ?? 100,
        status: params?.status,
        search: params?.search || undefined,
      },
    });
    const items: Record<string, unknown>[] = Array.isArray(data?.items) ? data.items : [];
    return {
      patients: mapRegistrations(items),
      total: data?.pagination?.total_items ?? items.length,
      totalPages: data?.pagination?.total_pages ?? 1,
    };
  },

  /** Pending self-registrations only — used by the Approvals screen. */
  async getPendingPatients(params?: ReceptionListQuery) {
    return this.getRegistrations({ ...params, status: "pending" });
  },

  /** Rejected self-registrations — the Approvals screen's Rejected tab, where they can be re-approved. */
  async getRejectedPatients(params?: ReceptionListQuery) {
    return this.getRegistrations({ ...params, status: "rejected" });
  },

  /** Sidebar badge: just the number (page_size=1, reads pagination.total_items). */
  async getPendingCount(): Promise<number> {
    return (await this.getRegistrations({ status: "pending", pageSize: 1 })).total;
  },

  async getPatient(patientId: string): Promise<PatientDetail> {
    const { data } = await apiClient.get(ENDPOINTS.RECEPTION.PATIENT(patientId));
    return normalizePatientProfile(data);
  },

  async approvePatient(registrationId: string): Promise<void> {
    await apiClient.post(ENDPOINTS.RECEPTION.APPROVE_REGISTRATION(registrationId));
  },

  async rejectPatient(registrationId: string, rejectionReason?: string): Promise<void> {
    await apiClient.post(ENDPOINTS.RECEPTION.REJECT_REGISTRATION(registrationId), {
      rejection_reason: rejectionReason || undefined,
    });
  },

  // ─── Registration wizard (§4.1-4.4) — real flow requires a Cognito OTP
  // round-trip; there is no way to register a patient in one call. ───
  async sendVerificationCode(payload: {
    channel: "phone" | "email";
    contact: string;
    first_name: string;
    last_name: string;
    dob?: string;
    gender?: string;
    /** Current flow: the patient's password goes in BEFORE the OTP. */
    password?: string;
  }): Promise<{ verification_id: string }> {
    const { data } = await apiClient.post(ENDPOINTS.RECEPTION.SEND_CODE, payload);
    return data;
  },

  async verifyCode(verificationId: string, code: string): Promise<{ registration_token: string }> {
    const { data } = await apiClient.post(ENDPOINTS.RECEPTION.VERIFY_CODE, { verification_id: verificationId, code });
    return data;
  },

  async getPasswordPolicy(): Promise<{ min_length: number }> {
    const { data } = await apiClient.get(ENDPOINTS.RECEPTION.PASSWORD_POLICY);
    return data;
  },

  /** registrationToken is the contact (email/phone). clinicId is resolved by
   *  the caller (receptionist's own clinic). With `code` (current flow) this
   *  verifies the OTP and registers the patient in ONE call
   *  (/reception/registrations/confirm); without it, the legacy two-call flow
   *  (verifyCode() first, then POST /reception/patients). */
  async registerPatient(
    registrationToken: string,
    clinicId: string,
    payload: RegisterPatientPayload,
    code?: string,
  ): Promise<PatientListItem> {
    const endpoint = code ? ENDPOINTS.RECEPTION.CONFIRM_REGISTRATION : ENDPOINTS.RECEPTION.REGISTER_PATIENT;
    const { data } = await apiClient.post(endpoint, {
      ...(code ? { code } : {}),
      registration_token: registrationToken,
      personal: {
        first_name: payload.first_name,
        last_name: payload.last_name || payload.first_name,
        gender: payload.gender,
        date_of_birth: payload.date_of_birth,
      },
      address: {
        street: payload.street || undefined,
        city: payload.city,
        state: payload.state,
        country: payload.country || "IN",
        pincode: payload.pincode || undefined,
      },
      clinic_id: clinicId,
      guardian: payload.guardian
        ? { name: payload.guardian.name, relation: payload.guardian.relation, contact_number: payload.guardian.contact_number }
        : undefined,
      password: payload.password,
      consent: { accepted: true, signature_captured: true },
    });

    // The reception response has no profile_id (only patient_id) — the
    // caller needs profile_id to sign the pending patient_onboarding
    // consent record PatientService.register() creates as a side effect.
    // Reused from the generic (non-reception) /patients/{id} endpoint,
    // which this adapter doesn't duplicate — see §4.9 of the guide.
    let profile_id: string | undefined;
    try {
      const detail = await apiClient.get(`/patients/${data.patient_id}`);
      profile_id = detail.data?.profile_id;
    } catch {
      // Non-fatal — registration itself already succeeded.
    }

    return {
      id: String(data.patient_id ?? ""),
      profile_id,
      full_name: data.full_name ?? `${payload.first_name} ${payload.last_name}`.trim(),
      first_name: payload.first_name,
      last_name: payload.last_name,
      email: payload.channel === "email" ? payload.contact : "",
      phone: payload.channel === "phone" ? payload.contact : undefined,
      status: data.registration_status,
    };
  },

  // ─── Doctors (§4.18) ───
  async getDoctors(): Promise<{ doctors: DoctorListItem[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.RECEPTION.DOCTORS);
    const items: Record<string, unknown>[] = Array.isArray(data?.items) ? data.items : [];
    const doctors: DoctorListItem[] = items.map((d) => {
      const { first, last } = splitName(String(d.name ?? ""));
      return {
        id: String(d.doctor_id ?? ""),
        first_name: first,
        last_name: last,
        specialization: (d.department as string) ?? undefined,
        availability_status: "available",
        patient_count: 0,
      };
    });
    return { doctors, total: doctors.length };
  },

  // ─── Enumerations (§4.19) ───
  async getEnums(): Promise<{ gender: { value: string; label: string }[]; relationship: { value: string; label: string }[] }> {
    const { data } = await apiClient.get(ENDPOINTS.RECEPTION.ENUMS);
    return { gender: data?.gender ?? [], relationship: data?.relationship ?? [] };
  },

  // ─── My Profile (§4.10-4.12) ───
  async getMyProfile(): Promise<Record<string, unknown>> {
    const { data } = await apiClient.get(ENDPOINTS.RECEPTION.ME);
    return data;
  },

  async updateMyProfile(payload: { first_name?: string; last_name?: string; email?: string; phone?: string }): Promise<Record<string, unknown>> {
    const { data } = await apiClient.patch(ENDPOINTS.RECEPTION.ME, payload);
    return data;
  },

  async changePassword(payload: { current_password: string; new_password: string; confirm_password: string }): Promise<void> {
    await apiClient.post(ENDPOINTS.RECEPTION.CHANGE_PASSWORD, payload);
  },

  // ─── Notifications (§4.14-4.17) ───
  async getUnreadCount(): Promise<number> {
    const { data } = await apiClient.get(ENDPOINTS.RECEPTION.NOTIFICATIONS_UNREAD_COUNT);
    return data?.total_unread ?? 0;
  },

  async getNotifications(unreadOnly = false): Promise<{ notifications: Notification[]; unread: number; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.RECEPTION.NOTIFICATIONS, { params: { unread_only: unreadOnly } });
    const items: Record<string, unknown>[] = Array.isArray(data?.items) ? data.items : [];
    const notifications: Notification[] = items.map((n) => ({
      id: String(n.notification_id ?? ""),
      user_id: "",
      title: (n.category as string) ?? "",
      message: (n.message as string) ?? "",
      type: (n.category as string) ?? "",
      is_read: !!n.is_read,
      created_at: (n.when as string) ?? "",
    }));
    return { notifications, unread: data?.counts?.unread ?? 0, total: data?.counts?.total ?? notifications.length };
  },

  async markNotificationRead(notificationId: string): Promise<void> {
    await apiClient.patch(ENDPOINTS.RECEPTION.NOTIFICATION_TOGGLE_READ(notificationId), { is_read: true });
  },

  async markAllNotificationsRead(): Promise<void> {
    await apiClient.post(ENDPOINTS.RECEPTION.NOTIFICATIONS_MARK_ALL_READ);
  },
};
