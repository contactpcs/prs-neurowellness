"use client";

import { useCallback, useEffect, useState } from "react";
import { receptionService } from "@/lib/api/services/reception.service";
import type { PatientListItem, PatientDetail, StaffDashboard } from "@/types/domain.types";

/**
 * Receptionist-only data hooks against the dedicated /api/v1/reception/*
 * module. Deliberately independent of staffSlice (Redux) — that slice is
 * shared with clinical-assistant screens, which stay on the generic
 * /patients-based staffService and must not be pointed at reception's
 * role-restricted endpoints.
 */

export function useReceptionDashboard() {
  const [dashboard, setDashboard] = useState<StaffDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    receptionService.getDashboard()
      .then((d) => { if (!cancelled) setDashboard(d); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { dashboard, isLoading };
}

export function useReceptionPatients() {
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    setIsLoading(true);
    return receptionService.getPatients()
      .then(({ patients: p }) => setPatients(p))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { patients, isLoading, refresh };
}

export function useReceptionPendingPatients() {
  const [pending, setPending] = useState<PatientListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    setIsLoading(true);
    return receptionService.getPendingPatients()
      .then(({ patients: p }) => setPending(p))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { pending, isLoading, refresh };
}

export function useReceptionPatient(id: string) {
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    setIsLoading(true);
    return receptionService.getPatient(id)
      .then(setPatient)
      .catch(() => setPatient(null))
      .finally(() => setIsLoading(false));
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  return { patient, isLoading, refresh };
}
