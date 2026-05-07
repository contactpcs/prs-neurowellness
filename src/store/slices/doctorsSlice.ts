/**
 * Doctors slice — caches doctor-scoped data: patients list, individual patient
 * detail, and assessment results. TTL is moderate (5 min) since this data
 * changes more frequently than static refs but less than transactional data.
 */
import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { doctorsService } from "@/lib/api/services";
import type { PatientListItem } from "@/types/domain.types";
import type { RootState } from "../store";

const DOCTORS_TTL_MS = 5 * 60 * 1000; // 5 min

type LoadStatus = "idle" | "loading" | "succeeded" | "failed";

interface DoctorsState {
  patients: PatientListItem[];
  patientsStatus: LoadStatus;
  patientsLoadedAt: number | null;
  patientsError: string | null;

  patientDetail: Record<string, any>;
  patientDetailStatus: LoadStatus;
  patientDetailError: string | null;

  results: Record<string, any>;
}

const initialState: DoctorsState = {
  patients: [],
  patientsStatus: "idle",
  patientsLoadedAt: null,
  patientsError: null,

  patientDetail: {},
  patientDetailStatus: "idle",
  patientDetailError: null,

  results: {},
};

function isFresh(loadedAt: number | null): boolean {
  return loadedAt !== null && Date.now() - loadedAt < DOCTORS_TTL_MS;
}

export const fetchDoctorPatients = createAsyncThunk<
  PatientListItem[],
  void,
  { state: RootState }
>(
  "doctors/fetchPatients",
  async () => {
    const { patients } = await doctorsService.getPatients();
    return patients;
  },
  {
    condition: (_, { getState }) => {
      const { patientsStatus, patientsLoadedAt } = getState().doctors;
      if (patientsStatus === "loading") return false;
      if (patientsStatus === "succeeded" && isFresh(patientsLoadedAt)) return false;
      return true;
    },
  },
);

export const fetchDoctorPatient = createAsyncThunk<any, string>(
  "doctors/fetchPatient",
  async (id: string) => doctorsService.getPatient(id),
);

export const fetchPatientResult = createAsyncThunk<
  any,
  { patientId: string; instanceId: string }
>(
  "doctors/fetchPatientResult",
  async ({ patientId, instanceId }) =>
    doctorsService.getPatientResult(patientId, instanceId),
);

const doctorsSlice = createSlice({
  name: "doctors",
  initialState,
  reducers: {
    invalidateDoctorPatients: (state) => {
      state.patientsLoadedAt = null;
      state.patientsStatus = "idle";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDoctorPatients.pending, (state) => {
        state.patientsStatus = "loading";
        state.patientsError = null;
      })
      .addCase(
        fetchDoctorPatients.fulfilled,
        (state, action: PayloadAction<PatientListItem[]>) => {
          state.patientsStatus = "succeeded";
          state.patients = action.payload;
          state.patientsLoadedAt = Date.now();
        }
      )
      .addCase(fetchDoctorPatients.rejected, (state, action) => {
        state.patientsStatus = "failed";
        state.patientsError = action.error.message ?? "Failed to load patients";
      })
      .addCase(fetchDoctorPatient.pending, (state) => {
        state.patientDetailStatus = "loading";
        state.patientDetailError = null;
      })
      .addCase(
        fetchDoctorPatient.fulfilled,
        (state, action: PayloadAction<any>) => {
          state.patientDetailStatus = "succeeded";
          state.patientDetail[action.payload.id || "current"] = action.payload;
        }
      )
      .addCase(fetchDoctorPatient.rejected, (state, action) => {
        state.patientDetailStatus = "failed";
        state.patientDetailError = action.error.message ?? "Failed to load patient";
      })
      .addCase(
        fetchPatientResult.fulfilled,
        (state, action: PayloadAction<any>) => {
          state.results[action.payload.instance_id || "current"] = action.payload;
        }
      );
  },
});

export const { invalidateDoctorPatients } = doctorsSlice.actions;
export default doctorsSlice.reducer;

export const selectDoctorPatients  = (s: RootState) => s.doctors.patients;
export const selectDoctorPatientsStatus = (s: RootState) => s.doctors.patientsStatus;
export const selectDoctorPatientDetail = (s: RootState) => s.doctors.patientDetail;
export const selectPatientResults = (s: RootState) => s.doctors.results;
