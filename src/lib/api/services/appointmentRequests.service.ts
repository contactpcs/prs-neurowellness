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

/** AppointmentRequestRead (real backend) has no patient_name/doctor_name (no
 * profiles join), no preferred_date_2/3 echoed back, no time_window/urgency/
 * review_notes/updated_at on read. Filled with safe defaults. */
function mapRequest(r: Record<string, unknown>): AppointmentRequest {
  return {
    request_id: String(r.request_id ?? ""),
    patient_id: String(r.patient_id ?? ""),
    doctor_id: String(r.doctor_id ?? ""),
    clinic_id: String(r.clinic_id ?? ""),
    preferred_date_1: String(r.preferred_date_1 ?? ""),
    preferred_time_window: "any",
    patient_complaint: "",
    urgency: "normal",
    status: (r.status as AppointmentRequest["status"]) ?? "pending",
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.created_at ?? ""),
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
