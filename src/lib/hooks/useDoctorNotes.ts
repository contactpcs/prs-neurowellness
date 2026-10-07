"use client";

import { useCallback, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchPatientNotes,
  addPatientNote,
  selectPatientNotes,
} from "@/store/slices/doctorNotesSlice";

export function usePatientNotes(patientId: string) {
  const dispatch = useAppDispatch();
  const entry    = useAppSelector(selectPatientNotes(patientId));

  useEffect(() => {
    if (patientId) dispatch(fetchPatientNotes(patientId));
  }, [dispatch, patientId]);

  const addNote = useCallback(
    (category: string, noteText: string, appointmentId?: string | null) =>
      dispatch(addPatientNote({ patientId, category, noteText, appointmentId })).unwrap(),
    [dispatch, patientId],
  );

  const notes = entry?.notes ?? [];
  return {
    notes,
    // Most recent note — convenience for a summary view that only wants one.
    latestNote: notes[0] ?? null,
    isLoading: entry?.status === "loading" || !entry,
    isReady: entry?.status === "succeeded",
    addNote,
  };
}
