"use client";

import { useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "@/store/store";
import { fetchMySessions, fetchSession, fetchConditions, fetchScales, fetchPatientSessions, createSession } from "@/store/slices/sessionSlice";

export function useSessions() {
  const dispatch = useDispatch<AppDispatch>();
  const { sessions, currentSession, conditions, scales, isLoading, error } = useSelector((s: RootState) => s.session);

  const loadMySessions = useCallback(() => { dispatch(fetchMySessions()); }, [dispatch]);
  const loadSession = useCallback((id: string) => { dispatch(fetchSession(id)); }, [dispatch]);
  const loadConditions = useCallback(() => { dispatch(fetchConditions()); }, [dispatch]);
  const loadScales = useCallback(() => { dispatch(fetchScales()); }, [dispatch]);
  const loadPatientSessions = useCallback((patientId: string) => { dispatch(fetchPatientSessions(patientId)); }, [dispatch]);

  const assignSession = useCallback(async (payload: Parameters<typeof createSession>[0]) => {
    return dispatch(createSession(payload));
  }, [dispatch]);

  const pendingSessions = sessions.filter(s => s.status === "assigned");
  const inProgressSessions = sessions.filter(s => s.status === "in_progress");
  const completedSessions = sessions.filter(s => s.status === "completed");

  return {
    sessions, currentSession, conditions, scales, isLoading, error,
    pendingSessions, inProgressSessions, completedSessions,
    loadMySessions, loadSession, loadConditions, loadScales, loadPatientSessions,
    assignSession,
  };
}
