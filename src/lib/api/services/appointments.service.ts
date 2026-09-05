import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { Appointment, AppointmentHistoryEntry, AppointmentStatus, AppointmentType, AvailabilitySlot, DeviceSlot, DeviceDayAvailability } from "@/types/domain.types";

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

export interface MyBookPayload {
  appointment_date: string;
  start_time: string;
  reason?: string;
  patient_complaint?: string;
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
    doctor_public_id: a.doctor_public_id ? String(a.doctor_public_id) : null,
    patient_public_id: a.patient_public_id ? String(a.patient_public_id) : null,
    appointment_date: date,
    start_time: start,
    end_time: end,
    start_at: date && start ? `${date}T${start}` : "",
    end_at: date && end ? `${date}T${end}` : "",
    status: (a.status as AppointmentStatus) ?? "planned",
    appointment_type: (a.appointment_type as AppointmentType) ?? "follow_up",
    reason: a.reason ? String(a.reason) : undefined,
    notes: a.notes ? String(a.notes) : undefined,
    patient_complaint: a.patient_complaint ? String(a.patient_complaint) : undefined,
    cancellation_reason: a.cancellation_reason ? String(a.cancellation_reason) : null,
    booked_by: String(a.booked_by ?? ""),
    booked_by_role: String(a.booked_by_role ?? ""),
    created_at: String(a.created_at ?? ""),
    updated_at: String(a.updated_at ?? a.created_at ?? ""),
    protocol_id: a.protocol_id ? String(a.protocol_id) : null,
    clinic_device_id: a.clinic_device_id ? String(a.clinic_device_id) : null,
    session_number: typeof a.session_number === "number" ? a.session_number : null,
    checked_in_at: a.checked_in_at ? String(a.checked_in_at) : null,
    started_at: a.started_at ? String(a.started_at) : null,
    completed_at: a.completed_at ? String(a.completed_at) : null,
  };
}

function extractList(data: unknown): Appointment[] {
  return Array.isArray(data) ? data.map(mapAppointment) : [];
}

function mapAppointmentHistory(a: Record<string, unknown>): AppointmentHistoryEntry {
  return {
    ...mapAppointment(a),
    payment_id: a.payment_id ? String(a.payment_id) : null,
    payment_status: (a.payment_status as AppointmentHistoryEntry["payment_status"]) ?? null,
    payment_amount: typeof a.payment_amount === "number" ? a.payment_amount : a.payment_amount ? Number(a.payment_amount) : null,
    payment_currency: a.payment_currency ? String(a.payment_currency) : null,
    payment_method: a.payment_method ? String(a.payment_method) : null,
    paid_at: a.paid_at ? String(a.paid_at) : null,
  };
}

async function setStatus(id: string, status: AppointmentStatus, extra?: Record<string, unknown>): Promise<Appointment> {
  const { data } = await apiClient.patch(ENDPOINTS.APPOINTMENTS.CHECK_IN(id), { status, ...extra });
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

  // ── patient self-service — the real booking flow (select → pay) ──────────
  // Clinic, doctor and patient are all resolved server-side from the
  // caller's own record (scheduling/router.py "/me/appointments/*"); these
  // never take an id or send ownership fields.

  async myList(includePast = false): Promise<Appointment[]> {
    const { data } = await apiClient.get(ENDPOINTS.APPOINTMENTS.MY_LIST, { params: { include_past: includePast } });
    return extractList(data);
  },

  // The appointment section's history feed — every appointment ever, newest
  // first, each with its most recent payment folded in (pending hold,
  // abandoned/failed, paid, or none). One call instead of joining myList()
  // with a separate payments fetch client-side.
  async myHistory(): Promise<AppointmentHistoryEntry[]> {
    const { data } = await apiClient.get(ENDPOINTS.APPOINTMENTS.MY_HISTORY);
    return Array.isArray(data) ? data.map(mapAppointmentHistory) : [];
  },

  async myAvailability(fromDate: string, toDate: string): Promise<AvailabilitySlot[]> {
    const { data } = await apiClient.get(ENDPOINTS.APPOINTMENTS.MY_AVAILABILITY, {
      params: { from_date: fromDate, to_date: toDate },
    });
    return Array.isArray(data) ? data : [];
  },

  async bookInitial(payload: MyBookPayload): Promise<Appointment> {
    const { data } = await apiClient.post(ENDPOINTS.APPOINTMENTS.MY_BOOK_INITIAL, payload);
    return mapAppointment(data);
  },

  async bookFollowUp(payload: MyBookPayload): Promise<Appointment> {
    const { data } = await apiClient.post(ENDPOINTS.APPOINTMENTS.MY_BOOK_FOLLOWUP, payload);
    return mapAppointment(data);
  },

  async myCancel(id: string, reason: string): Promise<Appointment> {
    const { data } = await apiClient.patch(ENDPOINTS.APPOINTMENTS.MY_CANCEL(id), { reason });
    return mapAppointment(data);
  },

  // Claiming a slot for an already-existing 'planned' protocol/device
  // session — distinct from bookInitial/bookFollowUp, which create a new
  // appointment. This just gives a planned row a time (planned -> selected).
  async claimSlot(id: string, payload: { start_time: string; appointment_date?: string }): Promise<Appointment> {
    const { data } = await apiClient.patch(ENDPOINTS.APPOINTMENTS.CLAIM_SLOT(id), payload);
    return mapAppointment(data);
  },

  async deviceAvailability(appointmentId: string, fromDate: string, toDate: string): Promise<DeviceSlot[]> {
    const { data } = await apiClient.get(ENDPOINTS.APPOINTMENTS.MY_DEVICE_AVAILABILITY(appointmentId), {
      params: { from_date: fromDate, to_date: toDate },
    });
    return Array.isArray(data) ? data : [];
  },

  // Continuous booked/free view for the timeline picker — always the
  // appointment's own planned date, no date param.
  async deviceDayAvailability(appointmentId: string): Promise<DeviceDayAvailability> {
    const { data } = await apiClient.get(ENDPOINTS.APPOINTMENTS.DEVICE_DAY_AVAILABILITY(appointmentId));
    return data;
  },
};
