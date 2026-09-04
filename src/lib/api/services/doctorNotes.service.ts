export type DoctorNote = {
  id?: string;
  patient_id: string;
  doctor_id: string;
  note_text: string;
  created_at?: string;
  updated_at?: string;
};

// NOT AVAILABLE — real backend only has POST /doctor-session-notes (keyed to
// a specific session/cycle, many required fields the old patient-keyed
// upsert model never had) and GET by note_id. No list-by-patient, no update.
export const doctorNotesService = {
  async getForPatient(_patientId: string): Promise<DoctorNote | null> {
    return null;
  },

  async upsertForPatient(_patientId: string, _noteText: string): Promise<never> {
    throw new Error("Doctor notes can't be saved per-patient — the real endpoint needs a session_id/cycle_id and several other required fields this form doesn't collect.");
  },

  async getMyNotes(): Promise<DoctorNote[]> {
    return [];
  },
};
