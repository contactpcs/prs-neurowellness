/**
 * Doctor's clinical notes — backed by core.patient_clinical_notes (backend
 * SQL/v1/99). Per-patient chronological list, kept in Redux so every screen
 * that shows a patient's notes shares one copy and nothing is lost on
 * reload (previously this was pure client-side fake state).
 */
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { doctorNotesService, type DoctorNote } from "@/lib/api/services/doctorNotes.service";
import type { RootState } from "../store";

const TTL_MS = 2 * 60 * 1000; // 2 minutes

type LoadStatus = "idle" | "loading" | "succeeded" | "failed";

interface PatientNotesEntry {
  notes: DoctorNote[];
  status: LoadStatus;
  loadedAt: number | null;
}

interface DoctorNotesState {
  byPatientId: Record<string, PatientNotesEntry>;
}

const initialState: DoctorNotesState = { byPatientId: {} };

function isFresh(loadedAt: number | null): boolean {
  return loadedAt !== null && Date.now() - loadedAt < TTL_MS;
}

export const fetchPatientNotes = createAsyncThunk<
  { patientId: string; notes: DoctorNote[] },
  string,
  { state: RootState }
>(
  "doctorNotes/fetchForPatient",
  async (patientId) => {
    const notes = await doctorNotesService.getForPatient(patientId);
    return { patientId, notes };
  },
  {
    condition: (patientId, { getState }) => {
      const entry = getState().doctorNotes.byPatientId[patientId];
      if (!entry) return true;
      if (entry.status === "loading") return false;
      if (entry.status === "succeeded" && isFresh(entry.loadedAt)) return false;
      return true;
    },
  },
);

export const addPatientNote = createAsyncThunk<
  { patientId: string; note: DoctorNote },
  { patientId: string; category: string; noteText: string; appointmentId?: string | null }
>(
  "doctorNotes/addForPatient",
  async ({ patientId, category, noteText, appointmentId }) => {
    const note = await doctorNotesService.addForPatient(patientId, {
      category,
      note_text: noteText,
      appointment_id: appointmentId ?? null,
    });
    return { patientId, note };
  },
);

const doctorNotesSlice = createSlice({
  name: "doctorNotes",
  initialState,
  reducers: {
    invalidatePatientNotes: (state, action: { payload: string }) => {
      delete state.byPatientId[action.payload];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPatientNotes.pending, (s, a) => {
        s.byPatientId[a.meta.arg] = {
          ...(s.byPatientId[a.meta.arg] || { notes: [], loadedAt: null, status: "idle" }),
          status: "loading",
        };
      })
      .addCase(fetchPatientNotes.fulfilled, (s, a) => {
        s.byPatientId[a.payload.patientId] = {
          notes: a.payload.notes,
          status: "succeeded",
          loadedAt: Date.now(),
        };
      })
      .addCase(fetchPatientNotes.rejected, (s, a) => {
        s.byPatientId[a.meta.arg] = {
          ...(s.byPatientId[a.meta.arg] || { notes: [], loadedAt: null }),
          status: "failed",
        } as PatientNotesEntry;
      })

      .addCase(addPatientNote.fulfilled, (s, a) => {
        // Cache-through on save: avoid an extra GET after POST.
        const entry = s.byPatientId[a.payload.patientId];
        const notes = [a.payload.note, ...(entry?.notes ?? [])];
        s.byPatientId[a.payload.patientId] = { notes, status: "succeeded", loadedAt: Date.now() };
      });
  },
});

export const { invalidatePatientNotes } = doctorNotesSlice.actions;
export default doctorNotesSlice.reducer;

export const selectPatientNotes = (patientId: string) => (s: RootState) => s.doctorNotes.byPatientId[patientId];
