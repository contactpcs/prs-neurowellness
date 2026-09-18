/**
 * Prescribed Medicine — no backend table/endpoints exist for this yet (see
 * doctorNotes.service.ts for the same situation with clinical notes), so
 * this is kept in Redux purely to share it across routes in the same
 * session (the clinical workspace page and the patient summary page both
 * need to read it). It resets on reload — nothing here is persisted.
 */
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../store";

export type PrescribedMedicine = {
  id: string;
  name: string;
  dose: string;
  timing: string;
  meal: string;
  duration: string;
  note: string;
  started: string;
  status: "Active" | "Stopped";
};

interface PrescribedMedicineState {
  byPatientId: Record<string, PrescribedMedicine[]>;
}

const initialState: PrescribedMedicineState = { byPatientId: {} };

const prescribedMedicineSlice = createSlice({
  name: "prescribedMedicine",
  initialState,
  reducers: {
    addMedicine: (state, action: PayloadAction<{ patientId: string; medicine: PrescribedMedicine }>) => {
      const { patientId, medicine } = action.payload;
      const list = state.byPatientId[patientId] ?? [];
      state.byPatientId[patientId] = [medicine, ...list];
    },
    setMedicineStatus: (state, action: PayloadAction<{ patientId: string; medicineId: string; status: "Active" | "Stopped" }>) => {
      const { patientId, medicineId, status } = action.payload;
      const list = state.byPatientId[patientId];
      if (!list) return;
      const med = list.find((m) => m.id === medicineId);
      if (med) med.status = status;
    },
  },
});

export const { addMedicine, setMedicineStatus } = prescribedMedicineSlice.actions;

export const selectPatientMedicines = (patientId: string) => (state: RootState) =>
  state.prescribedMedicine.byPatientId[patientId] ?? [];

export default prescribedMedicineSlice.reducer;
