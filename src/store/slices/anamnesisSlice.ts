/**
 * Anamnesis slice — caches:
 * - the static questions catalog, per stage (long TTL: questions are reference data)
 * - the current user's anamnesis record, per stage
 * - per-patient anamnesis records (keyed by patientId + stage, used by doctors)
 */
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { anamnesisService, type AnamnesisQuestion, type AnamnesisStage } from "@/lib/api/services/anamnesis.service";
import type { AnamnesisRecord } from "@/types/domain.types";
import type { RootState } from "../store";

const QUESTIONS_TTL_MS = 30 * 60 * 1000; // 30 min — static reference data
const RECORD_TTL_MS    = 2 * 60 * 1000;  // 2 min — anamnesis records change as patient/doctor edits

type LoadStatus = "idle" | "loading" | "succeeded" | "failed";

interface QuestionsEntry {
  questions: AnamnesisQuestion[];
  status: LoadStatus;
  loadedAt: number | null;
}

interface RecordEntry {
  record: AnamnesisRecord | null;
  status: LoadStatus;
  loadedAt: number | null;
}

function emptyQuestionsEntry(): QuestionsEntry {
  return { questions: [], status: "idle", loadedAt: null };
}

function emptyRecordEntry(): RecordEntry {
  return { record: null, status: "idle", loadedAt: null };
}

interface AnamnesisState {
  questionsByStage: Record<AnamnesisStage, QuestionsEntry>;
  myAnamnesisByStage: Record<AnamnesisStage, RecordEntry>;
  byPatientIdAndStage: Record<string, RecordEntry>; // key: `${patientId}:${stage}`
}

const initialState: AnamnesisState = {
  questionsByStage: { registration: emptyQuestionsEntry(), main: emptyQuestionsEntry() },
  myAnamnesisByStage: { registration: emptyRecordEntry(), main: emptyRecordEntry() },
  byPatientIdAndStage: {},
};

function isFresh(loadedAt: number | null, ttl: number): boolean {
  return loadedAt !== null && Date.now() - loadedAt < ttl;
}

function patientStageKey(patientId: string, stage: AnamnesisStage): string {
  return `${patientId}:${stage}`;
}

export const fetchAnamnesisQuestions = createAsyncThunk<
  { stage: AnamnesisStage; questions: AnamnesisQuestion[] },
  AnamnesisStage,
  { state: RootState }
>(
  "anamnesis/fetchQuestions",
  async (stage) => ({ stage, questions: await anamnesisService.getQuestions(stage) }),
  {
    condition: (stage, { getState }) => {
      const entry = getState().anamnesis.questionsByStage[stage];
      if (entry.status === "loading") return false;
      if (entry.status === "succeeded" && isFresh(entry.loadedAt, QUESTIONS_TTL_MS)) return false;
      return true;
    },
  },
);

export const fetchMyAnamnesis = createAsyncThunk<
  { stage: AnamnesisStage; record: AnamnesisRecord },
  AnamnesisStage,
  { state: RootState }
>(
  "anamnesis/fetchMine",
  async (stage) => ({ stage, record: await anamnesisService.getMyAnamnesis(stage) }),
  {
    condition: (stage, { getState }) => {
      const entry = getState().anamnesis.myAnamnesisByStage[stage];
      if (entry.status === "loading") return false;
      if (entry.status === "succeeded" && isFresh(entry.loadedAt, RECORD_TTL_MS)) return false;
      return true;
    },
  },
);

export const fetchPatientAnamnesis = createAsyncThunk<
  { patientId: string; stage: AnamnesisStage; record: AnamnesisRecord | null },
  { patientId: string; stage: AnamnesisStage },
  { state: RootState }
>(
  "anamnesis/fetchForPatient",
  async ({ patientId, stage }) => {
    const record = await anamnesisService.getForPatient(patientId, stage);
    return { patientId, stage, record };
  },
  {
    condition: ({ patientId, stage }, { getState }) => {
      const entry = getState().anamnesis.byPatientIdAndStage[patientStageKey(patientId, stage)];
      if (!entry) return true;
      if (entry.status === "loading") return false;
      if (entry.status === "succeeded" && isFresh(entry.loadedAt, RECORD_TTL_MS)) return false;
      return true;
    },
  },
);

const anamnesisSlice = createSlice({
  name: "anamnesis",
  initialState,
  reducers: {
    invalidateMyAnamnesis: (state, action: { payload: AnamnesisStage }) => {
      state.myAnamnesisByStage[action.payload] = emptyRecordEntry();
    },
    invalidatePatientAnamnesis: (state, action: { payload: { patientId: string; stage: AnamnesisStage } }) => {
      delete state.byPatientIdAndStage[patientStageKey(action.payload.patientId, action.payload.stage)];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAnamnesisQuestions.pending, (s, a) => {
        s.questionsByStage[a.meta.arg].status = "loading";
      })
      .addCase(fetchAnamnesisQuestions.fulfilled, (s, a) => {
        s.questionsByStage[a.payload.stage] = {
          questions: a.payload.questions,
          status: "succeeded",
          loadedAt: Date.now(),
        };
      })
      .addCase(fetchAnamnesisQuestions.rejected, (s, a) => {
        s.questionsByStage[a.meta.arg].status = "failed";
      })

      .addCase(fetchMyAnamnesis.pending, (s, a) => {
        s.myAnamnesisByStage[a.meta.arg].status = "loading";
      })
      .addCase(fetchMyAnamnesis.fulfilled, (s, a) => {
        s.myAnamnesisByStage[a.payload.stage] = {
          record: a.payload.record,
          status: "succeeded",
          loadedAt: Date.now(),
        };
      })
      .addCase(fetchMyAnamnesis.rejected, (s, a) => {
        s.myAnamnesisByStage[a.meta.arg].status = "failed";
      })

      .addCase(fetchPatientAnamnesis.pending, (s, a) => {
        const key = patientStageKey(a.meta.arg.patientId, a.meta.arg.stage);
        s.byPatientIdAndStage[key] = { ...(s.byPatientIdAndStage[key] || emptyRecordEntry()), status: "loading" };
      })
      .addCase(fetchPatientAnamnesis.fulfilled, (s, a) => {
        const key = patientStageKey(a.payload.patientId, a.payload.stage);
        s.byPatientIdAndStage[key] = { record: a.payload.record, status: "succeeded", loadedAt: Date.now() };
      })
      .addCase(fetchPatientAnamnesis.rejected, (s, a) => {
        const key = patientStageKey(a.meta.arg.patientId, a.meta.arg.stage);
        s.byPatientIdAndStage[key] = { ...(s.byPatientIdAndStage[key] || emptyRecordEntry()), status: "failed" };
      });
  },
});

export const { invalidateMyAnamnesis, invalidatePatientAnamnesis } = anamnesisSlice.actions;
export default anamnesisSlice.reducer;

export const selectAnamnesisQuestions = (stage: AnamnesisStage) => (s: RootState) => s.anamnesis.questionsByStage[stage].questions;
export const selectAnamnesisQuestionsStatus = (stage: AnamnesisStage) => (s: RootState) => s.anamnesis.questionsByStage[stage].status;
export const selectMyAnamnesis = (stage: AnamnesisStage) => (s: RootState) => s.anamnesis.myAnamnesisByStage[stage].record;
export const selectMyAnamnesisStatus = (stage: AnamnesisStage) => (s: RootState) => s.anamnesis.myAnamnesisByStage[stage].status;
export const selectPatientAnamnesis = (patientId: string, stage: AnamnesisStage) => (s: RootState) =>
  s.anamnesis.byPatientIdAndStage[patientStageKey(patientId, stage)];
