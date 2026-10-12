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
  const [dashboard, setDashboard] = useState<(StaffDashboard & { pending_preview: PatientListItem[] }) | null>(null);
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

/** One server page of the clinic's patients. Search is debounced (300 ms)
 * so typing doesn't fire a request per keystroke. */
export function useReceptionPatients(query: { page?: number; pageSize?: number; search?: string; gender?: string; doctor?: string } = {}) {
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState(query.search ?? "");
  const { page, pageSize, gender, doctor } = query;

  useEffect(() => {
    const t = setTimeout(() => setSearch(query.search ?? ""), 300);
    return () => clearTimeout(t);
  }, [query.search]);

  const refresh = useCallback(() => {
    setIsLoading(true);
    return receptionService.getPatients({ page, pageSize, search, gender, doctor })
      .then((r) => { setPatients(r.patients); setTotal(r.total); setTotalPages(r.totalPages); })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [page, pageSize, search, gender, doctor]);

  useEffect(() => { refresh(); }, [refresh]);

  return { patients, total, totalPages, isLoading, refresh };
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
