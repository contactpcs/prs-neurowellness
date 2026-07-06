import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { Appointment, AppointmentStatus, AppointmentType } from "@/types/domain.types";

export interface AppointmentListParams {
  date_from?: string;
  date_to?: string;
  status?: AppointmentStatus;
  clinic_id?: string; // real server-side filter (list_appointments), unlike date_from/date_to below
  doctor_id?: string;
  patient_id?: string;
  page?: number;
  page_size?: number;
  limit?: number;
}

export interface AppointmentCreatePayload {
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  appointment_type?: AppointmentType;
  reason?: string;
  notes?: string;
  patient_complaint?: string;
}

export interface AppointmentReschedulePayload {
  appointment_date: string;
  start_time: string;
  reason?: string;
}

export interface AppointmentCancelPayload {
  cancellation_reason: string;
}

/** AppointmentRead now includes patient_name/doctor_name (profiles join) and
 * booked_by/booked_by_role/updated_at — this just synthesizes start_at/
 * end_at (combined date+time) since nothing downstream needs to re-derive
 * that from appointment_date+start_time itself. */
function mapAppointment(a: Record<string, unknown>): Appointment {
  const date = String(a.appointment_date ?? "");
  const start = String(a.start_time ?? "");
  const end = String(a.end_time ?? "");
  return {
    appointment_id: String(a.appointment_id ?? ""),
    clinic_id: String(a.clinic_id ?? ""),
    patient_id: String(a.patient_id ?? ""),
    patient_name: a.patient_name ? String(a.patient_name) : undefined,
    doctor_id: String(a.doctor_id ?? ""),
    doctor_name: a.doctor_name ? String(a.doctor_name) : undefined,
    appointment_date: date,
    start_time: start,
    end_time: end,
    start_at: date && start ? `${date}T${start}` : "",
    end_at: date && end ? `${date}T${end}` : "",
    status: (a.status as AppointmentStatus) ?? "scheduled",
    appointment_type: (a.appointment_type as AppointmentType) ?? "doctor_consultation",
    reason: a.reason ? String(a.reason) : undefined,
    notes: a.notes ? String(a.notes) : undefined,
    patient_complaint: a.patient_complaint ? String(a.patient_complaint) : undefined,
    cancellation_reason: a.cancellation_reason ? String(a.cancellation_reason) : null,
    booked_by: String(a.booked_by ?? ""),
    booked_by_role: String(a.booked_by_role ?? ""),
    created_at: String(a.created_at ?? ""),
    updated_at: String(a.updated_at ?? a.created_at ?? ""),
  };
}

function extractList(data: unknown): Appointment[] {
  return Array.isArray(data) ? data.map(mapAppointment) : [];
}

async function setStatus(id: string, status: AppointmentStatus, extra?: Record<string, unknown>): Promise<Appointment> {
  const { data } = await apiClient.patch(ENDPOINTS.APPOINTMENTS.CONFIRM(id), { status, ...extra });
  return mapAppointment(data);
}

export const appointmentsService = {
  async list(params?: AppointmentListParams): Promise<{ appointments: Appointment[]; total: number }> {
    const { data } = await apiClient.get(ENDPOINTS.APPOINTMENTS.LIST, { params });
    const appointments = extractList(data);
    return { appointments, total: appointments.length };
  },

  async getUpcoming(): Promise<Appointment[]> {
    const { data } = await apiClient.get(ENDPOINTS.APPOINTMENTS.UPCOMING);
    return extractList(data);
  },

  async getToday(): Promise<Appointment[]> {
    const { data } = await apiClient.get(ENDPOINTS.APPOINTMENTS.TODAY);
    return extractList(data);
  },

  async getById(id: string): Promise<Appointment> {
    const { data } = await apiClient.get(ENDPOINTS.APPOINTMENTS.GET(id));
    return mapAppointment(data);
  },

  async create(payload: AppointmentCreatePayload): Promise<Appointment> {
    const { data } = await apiClient.post(ENDPOINTS.APPOINTMENTS.LIST, payload);
    return mapAppointment(data);
  },

  async update(id: string, payload: { notes?: string; patient_complaint?: string; appointment_type?: AppointmentType }): Promise<Appointment> {
    const { data } = await apiClient.patch(ENDPOINTS.APPOINTMENTS.UPDATE(id), payload);
    return mapAppointment(data);
  },

  async confirm(id: string): Promise<Appointment> {
    return setStatus(id, "confirmed");
  },

  async checkIn(id: string): Promise<Appointment> {
    return setStatus(id, "checked_in");
  },

  async start(id: string): Promise<Appointment> {
    return setStatus(id, "in_progress");
  },

  async complete(id: string): Promise<Appointment> {
    return setStatus(id, "completed");
  },

  async cancel(id: string, payload: AppointmentCancelPayload): Promise<Appointment> {
    return setStatus(id, "cancelled", { cancellation_reason: payload.cancellation_reason });
  },

  // end_time is optional server-side (derived from the doctor's slot
  // duration at the target start_time) — this payload never needs to send it.
  async reschedule(id: string, payload: AppointmentReschedulePayload): Promise<Appointment> {
    const { data } = await apiClient.patch(ENDPOINTS.APPOINTMENTS.RESCHEDULE(id), {
      appointment_date: payload.appointment_date,
      start_time: payload.start_time,
      change_reason: payload.reason,
    });
    return mapAppointment(data);
  },

  async markNoShow(id: string): Promise<Appointment> {
    return setStatus(id, "no_show");
  },

  async getHistory(id: string): Promise<unknown[]> {
    const { data } = await apiClient.get(ENDPOINTS.APPOINTMENTS.HISTORY(id));
    return Array.isArray(data) ? data : [];
  },
};
