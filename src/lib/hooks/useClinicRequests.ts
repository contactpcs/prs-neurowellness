"use client";

import { useState, useCallback } from "react";
import { clinicRequestsService, type ClinicRequest, type CreateClinicRequestPayload } from "@/lib/api/services/clinicRequests.service";

export function useClinicRequests() {
  const [requests, setRequests] = useState<ClinicRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (params?: { region_id?: string; status?: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      setRequests(await clinicRequestsService.list(params));
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Failed to load clinic requests");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createRequest = useCallback(async (payload: CreateClinicRequestPayload) => {
    const created = await clinicRequestsService.create(payload);
    setRequests((prev) => [created, ...prev]);
    return created;
  }, []);

  const decideRequest = useCallback(async (id: string, decision: "approved" | "rejected", review_notes?: string) => {
    const updated = await clinicRequestsService.decide(id, decision, review_notes);
    setRequests((prev) => prev.map((r) => (r.request_id === id ? updated : r)));
    return updated;
  }, []);

  return { requests, isLoading, error, fetch, createRequest, decideRequest };
}
