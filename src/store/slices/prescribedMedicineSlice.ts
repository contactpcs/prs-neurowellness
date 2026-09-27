/**
 * Prescribed Medicine — backed by core.prescribed_medicines (backend
 * SQL/v1/96). Kept in Redux so the clinical workspace and the patient summary
 * page share one copy; every change goes to the API first and the store is
 * updated from the server's response, so nothing is lost on reload.
 */
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
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

export type PrescribedMedicineForm = Omit<PrescribedMedicine, "id" | "started" | "status">;

interface PrescribedMedicineState {
  byPatientId: Record<string, PrescribedMedicine[]>;
}

const initialState: PrescribedMedicineState = { byPatientId: {} };

function formatStarted(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/** API row -> the shape the screens already render. */
function fromApi(r: Record<string, unknown>): PrescribedMedicine {
  return {
    id: String(r.medicine_id),
    name: String(r.medicine_name ?? ""),
    dose: (r.dose as string) ?? "",
    timing: (r.timing as string) ?? "",
    meal: (r.meal_instruction as string) ?? "",
    duration: (r.duration as string) ?? "",
    note: (r.note as string) ?? "",
    started: r.started_at ? formatStarted(String(r.started_at)) : "",
    status: r.status === "stopped" ? "Stopped" : "Active",
  };
}

export const fetchPatientMedicines = createAsyncThunk("prescribedMedicine/fetch", async (patientId: string) => {
  const { data } = await apiClient.get(ENDPOINTS.PATIENTS.PRESCRIBED_MEDICINES(patientId));
  return { patientId, medicines: (Array.isArray(data) ? data : []).map(fromApi) };
});

export const prescribeMedicine = createAsyncThunk(
  "prescribedMedicine/prescribe",
  async ({ patientId, medicine, appointmentId }: { patientId: string; medicine: PrescribedMedicineForm; appointmentId?: string | null }) => {
    const { data } = await apiClient.post(ENDPOINTS.PATIENTS.PRESCRIBED_MEDICINES(patientId), {
      medicine_name: medicine.name.trim(),
      dose: medicine.dose || null,
      timing: medicine.timing || null,
      meal_instruction: medicine.meal || null,
      duration: medicine.duration || null,
      note: medicine.note || null,
      appointment_id: appointmentId || null,
    });
    return { patientId, medicine: fromApi(data) };
  },
);

export const changeMedicineStatus = createAsyncThunk(
  "prescribedMedicine/status",
  async ({ patientId, medicineId, status }: { patientId: string; medicineId: string; status: "Active" | "Stopped" }) => {
    const { data } = await apiClient.patch(ENDPOINTS.PATIENTS.PRESCRIBED_MEDICINE(medicineId), {
      status: status === "Stopped" ? "stopped" : "active",
    });
    return { patientId, medicine: fromApi(data) };
  },
);

const prescribedMedicineSlice = createSlice({
  name: "prescribedMedicine",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPatientMedicines.fulfilled, (state, { payload }) => {
        state.byPatientId[payload.patientId] = payload.medicines;
      })
      .addCase(prescribeMedicine.fulfilled, (state, { payload }) => {
        state.byPatientId[payload.patientId] = [payload.medicine, ...(state.byPatientId[payload.patientId] ?? [])];
      })
      .addCase(changeMedicineStatus.fulfilled, (state, { payload }) => {
        const list = state.byPatientId[payload.patientId];
        if (!list) return;
        const i = list.findIndex((m) => m.id === payload.medicine.id);
        if (i >= 0) list[i] = payload.medicine;
      });
  },
});

export const selectPatientMedicines = (patientId: string) => (state: RootState) =>
  state.prescribedMedicine.byPatientId[patientId] ?? [];

export default prescribedMedicineSlice.reducer;
