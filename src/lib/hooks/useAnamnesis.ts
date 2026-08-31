"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import type { AnamnesisStage } from "@/lib/api/services/anamnesis.service";
import {
  fetchAnamnesisQuestions,
  fetchMyAnamnesis,
  fetchPatientAnamnesis,
  selectAnamnesisQuestions,
  selectAnamnesisQuestionsStatus,
  selectMyAnamnesis,
  selectMyAnamnesisStatus,
  selectPatientAnamnesis,
} from "@/store/slices/anamnesisSlice";

export function useAnamnesisQuestions(stage: AnamnesisStage) {
  const dispatch  = useAppDispatch();
  const questions = useAppSelector(selectAnamnesisQuestions(stage));
  const status    = useAppSelector(selectAnamnesisQuestionsStatus(stage));

  useEffect(() => {
    dispatch(fetchAnamnesisQuestions(stage));
  }, [dispatch, stage]);

  return { questions, isLoading: status === "loading", isReady: status === "succeeded" };
}

export function useMyAnamnesis(stage: AnamnesisStage) {
  const dispatch = useAppDispatch();
  const record   = useAppSelector(selectMyAnamnesis(stage));
  const status   = useAppSelector(selectMyAnamnesisStatus(stage));

  useEffect(() => {
    dispatch(fetchMyAnamnesis(stage));
  }, [dispatch, stage]);

  return { record, isLoading: status === "loading", isReady: status === "succeeded" };
}

export function usePatientAnamnesis(patientId: string, stage: AnamnesisStage) {
  const dispatch = useAppDispatch();
  const entry    = useAppSelector(selectPatientAnamnesis(patientId, stage));

  useEffect(() => {
    if (patientId) dispatch(fetchPatientAnamnesis({ patientId, stage }));
  }, [dispatch, patientId, stage]);

  return {
    record: entry?.record ?? null,
    isLoading: entry?.status === "loading" || !entry,
    isReady: entry?.status === "succeeded",
  };
}
