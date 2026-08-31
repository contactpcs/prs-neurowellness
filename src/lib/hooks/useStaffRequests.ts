"use client";

import { useState, useCallback } from "react";
import { staffRequestsService, type StaffRequest, type CreateStaffRequestPayload } from "@/lib/api/services/staffRequests.service";

export function useStaffRequests() {
  const [requests, setRequests] = useState<StaffRequest[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (params?: { clinic_id?: string; status?: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      setRequests(await staffRequestsService.list(params));
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Failed to load staff requests");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createRequest = useCallback(async (payload: CreateStaffRequestPayload) => {
    const created = await staffRequestsService.create(payload);
    setRequests((prev) => [created, ...prev]);
    return created;
  }, []);

  const decideRequest = useCallback(async (id: string, decision: "approved" | "rejected", review_notes?: string) => {
    const updated = await staffRequestsService.decide(id, decision, review_notes);
    setRequests((prev) => prev.map((r) => (r.request_id === id ? updated : r)));
    return updated;
  }, []);

  return { requests, isLoading, error, fetch, createRequest, decideRequest };
}
