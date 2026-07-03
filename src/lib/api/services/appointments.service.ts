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

/** AppointmentRead (real backend) has no patient_name/doctor_name (no
 * profiles join), no combined start_at/end_at, no reason/notes/complaint,
 * no booked_by/booked_by_role, no updated_at. Filled with the closest
 * derivable value or a safe default rather than left crashing on access. */
function mapAppointment(a: Record<string, unknown>): Appointment {
  const date = String(a.appointment_date ?? "");
  const start = String(a.start_time ?? "");
  const end = String(a.end_time ?? "");
  return {
    appointment_id: String(a.appointment_id ?? ""),
    clinic_id: String(a.clinic_id ?? ""),
    patient_id: String(a.patient_id ?? ""),
    doctor_id: String(a.doctor_id ?? ""),
    appointment_date: date,
    start_time: start,
    end_time: end,
    start_at: date && start ? `${date}T${start}` : "",
    end_at: date && end ? `${date}T${end}` : "",
    status: (a.status as AppointmentStatus) ?? "scheduled",
    appointment_type: (a.appointment_type as AppointmentType) ?? "consultation",
    booked_by: "",
    booked_by_role: "",
    created_at: String(a.created_at ?? ""),
    updated_at: String(a.created_at ?? ""),
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

  // NOT AVAILABLE as a server filter — filtered client-side from list().
  async getUpcoming(): Promise<Appointment[]> {
    const { appointments } = await appointmentsService.list();
    const now = new Date();
    return appointments.filter((a) => new Date(a.start_at) >= now);
  },

  async getToday(): Promise<Appointment[]> {
    const { appointments } = await appointmentsService.list();
    const today = new Date().toISOString().slice(0, 10);
    return appointments.filter((a) => a.appointment_date === today);
  },

  async getById(id: string): Promise<Appointment> {
    const { data } = await apiClient.get(ENDPOINTS.APPOINTMENTS.GET(id));
    return mapAppointment(data);
  },

  async create(payload: AppointmentCreatePayload): Promise<Appointment> {
    const { data } = await apiClient.post(ENDPOINTS.APPOINTMENTS.LIST, payload);
    return mapAppointment(data);
  },

  // NOT AVAILABLE — no generic field-patch endpoint (only reschedule/status exist).
  async update(_id: string, _payload: { notes?: string; patient_complaint?: string; appointment_type?: AppointmentType }): Promise<Appointment> {
    throw new Error("Editing appointment notes/type after booking isn't available yet.");
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

  // Real endpoint field is `change_reason`, and also requires `end_time`
  // (not part of the old payload) — will 422 without it, a genuine gap.
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
