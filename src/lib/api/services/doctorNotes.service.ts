import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";

export type DoctorNote = {
  id: string;
  patient_id: string;
  doctor_id: string;
  doctor_name?: string | null;
  appointment_id?: string | null;
  category: string;
  note_text: string;
  created_at: string;
};

function fromApi(r: Record<string, unknown>): DoctorNote {
  return {
    id: String(r.note_id),
    patient_id: String(r.patient_id),
    doctor_id: String(r.doctor_id),
    doctor_name: (r.doctor_name as string) ?? null,
    appointment_id: (r.appointment_id as string) ?? null,
    category: String(r.category),
    note_text: String(r.note_text),
    created_at: String(r.created_at),
  };
}

// Real (SQL/v1/99) — core.patient_clinical_notes. Append-only: no update or
// delete endpoint, matches how the doctor workspace's note log behaves (a
// new note is always a new row, never an edit of a past one).
export const doctorNotesService = {
  /** Full chronological list (newest first) for one patient. */
  async getForPatient(patientId: string): Promise<DoctorNote[]> {
    const { data } = await apiClient.get(ENDPOINTS.PATIENTS.CLINICAL_NOTES(patientId));
    return (Array.isArray(data) ? data : []).map(fromApi);
  },

  async addForPatient(
    patientId: string,
    payload: { category: string; note_text: string; appointment_id?: string | null },
  ): Promise<DoctorNote> {
    const { data } = await apiClient.post(ENDPOINTS.PATIENTS.CLINICAL_NOTES(patientId), payload);
    return fromApi(data);
  },
};
