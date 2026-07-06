import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { AppointmentRequest, TimeWindow, Urgency } from "@/types/domain.types";

export interface AppointmentRequestListParams {
  status?: string;
  skip?: number;
  limit?: number;
}

export interface CreateRequestPayload {
  preferred_date_1: string;
  preferred_date_2?: string;
  preferred_date_3?: string;
  preferred_time_window: TimeWindow;
  patient_complaint: string;
  urgency: Urgency;
  reason?: string;
}

export interface ApproveRequestPayload {
  appointment_date: string;
  start_time: string;
  appointment_type: string;
  notes?: string;
}

function mapRequest(r: Record<string, unknown>): AppointmentRequest {
  return {
    request_id: String(r.request_id ?? ""),
    patient_id: String(r.patient_id ?? ""),
    doctor_id: r.doctor_id ? String(r.doctor_id) : null,
    clinic_id: String(r.clinic_id ?? ""),
    patient_name: r.patient_name ? String(r.patient_name) : undefined,
    doctor_name: r.doctor_name ? String(r.doctor_name) : undefined,
    request_type: r.request_type as AppointmentRequest["request_type"],
    parent_appointment_id: r.parent_appointment_id ? String(r.parent_appointment_id) : null,
    approved_appointment_id: r.approved_appointment_id ? String(r.approved_appointment_id) : null,
    preferred_date_1: String(r.preferred_date_1 ?? ""),
    preferred_date_2: r.preferred_date_2 ? String(r.preferred_date_2) : null,
    preferred_date_3: r.preferred_date_3 ? String(r.preferred_date_3) : null,
    preferred_time_window: (r.preferred_time_window as AppointmentRequest["preferred_time_window"]) ?? "any",
    patient_complaint: String(r.patient_complaint ?? ""),
    urgency: (r.urgency as AppointmentRequest["urgency"]) ?? "normal",
    reason: r.reason ? String(r.reason) : null,
    review_notes: r.review_notes ? String(r.review_notes) : null,
    status: (r.status as AppointmentRequest["status"]) ?? "pending",
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? r.created_at ?? ""),
  };
}

export const appointmentRequestsService = {
  list: async (params?: AppointmentRequestListParams) => {
    const res = await apiClient.get(ENDPOINTS.APPOINTMENT_REQUESTS.LIST, { params });
    const items: Record<string, unknown>[] = Array.isArray(res.data) ? res.data : [];
    const requests = items.map(mapRequest);
    return { requests, total: requests.length };
  },

  /** Old payload has no clinic_id/patient_id (self-service, patient-role
   * only) — resolved here from the caller's own /patients record. */
  create: async (payload: CreateRequestPayload): Promise<AppointmentRequest> => {
    const [meRes, patientsRes] = await Promise.all([
      apiClient.get(ENDPOINTS.AUTH.ME),
      apiClient.get(ENDPOINTS.PATIENTS.DASHBOARD),
    ]);
    const me = meRes.data as { clinic_id?: string | null };
    const own = Array.isArray(patientsRes.data) ? patientsRes.data[0] : undefined;
    if (!me.clinic_id || !own?.patient_id) throw new Error("Could not resolve your patient/clinic record to create a request.");
    const res = await apiClient.post(ENDPOINTS.APPOINTMENT_REQUESTS.CREATE, {
      clinic_id: me.clinic_id,
      patient_id: own.patient_id,
      preferred_date_1: payload.preferred_date_1,
      preferred_date_2: payload.preferred_date_2,
      preferred_date_3: payload.preferred_date_3,
      preferred_time_window: payload.preferred_time_window,
      patient_complaint: payload.patient_complaint,
      urgency: payload.urgency,
    });
    return mapRequest(res.data);
  },

  approve: async (id: string, payload: ApproveRequestPayload): Promise<AppointmentRequest> => {
    const res = await apiClient.patch(ENDPOINTS.APPOINTMENT_REQUESTS.APPROVE(id), {
      decision: "approved",
      appointment_date: payload.appointment_date,
      start_time: payload.start_time,
      appointment_type: payload.appointment_type,
      review_notes: payload.notes,
    });
    return mapRequest(res.data);
  },

  reject: async (id: string, review_notes: string): Promise<AppointmentRequest> => {
    const res = await apiClient.patch(ENDPOINTS.APPOINTMENT_REQUESTS.REJECT(id), { decision: "rejected", review_notes });
    return mapRequest(res.data);
  },

  cancel: async (id: string): Promise<AppointmentRequest> => {
    const res = await apiClient.patch(ENDPOINTS.APPOINTMENT_REQUESTS.CANCEL(id), { decision: "cancelled_by_patient" });
    return mapRequest(res.data);
  },
};
