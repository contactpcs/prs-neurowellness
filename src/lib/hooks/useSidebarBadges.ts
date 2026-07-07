"use client";

import { useCallback, useEffect, useState } from "react";
import { appointmentRequestsService } from "@/lib/api/services/appointmentRequests.service";
import { appointmentsService } from "@/lib/api/services/appointments.service";
import { staffService } from "@/lib/api/services/staff.service";
import { staffRequestsService } from "@/lib/api/services/staffRequests.service";
import { clinicRequestsService } from "@/lib/api/services/clinicRequests.service";

// Sidebar nav badges — one pending count per role's "needs your action"
// item, refreshed on mount and on every SSE push (AuthProvider's generic
// "sse:notification" dispatch covers appointment/staff_request/
// patient_approval alike, so one listener here handles them all instead of
// wiring a separate window event per badge type).
export type BadgeKey =
  | "appointmentRequests" | "patientApprovals" | "staffRequests"
  | "staffApprovals" | "clinicRequests" | "doctorPendingAppointments";

const FETCHERS: Record<BadgeKey, () => Promise<number>> = {
  appointmentRequests: async () => (await appointmentRequestsService.list({ status: "pending" })).total,
  patientApprovals: async () => (await staffService.getPendingPatients()).total,
  staffRequests: async () => (await staffRequestsService.list({ status: "pending" })).length,
  staffApprovals: async () => (await staffRequestsService.list({ status: "pending" })).length,
  clinicRequests: async () => (await clinicRequestsService.list({ status: "pending" })).length,
  doctorPendingAppointments: async () => (await appointmentsService.list({ status: "scheduled" })).total,
};

export function useSidebarBadges(keys: BadgeKey[]): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const keysSignature = keys.join(",");

  const refresh = useCallback(async () => {
    const results = await Promise.all(
      keys.map(async (k) => {
        try { return [k, await FETCHERS[k]()] as const; } catch { return [k, 0] as const; }
      }),
    );
    setCounts(Object.fromEntries(results));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysSignature]);

  useEffect(() => {
    if (keys.length === 0) return;
    refresh();
    window.addEventListener("sse:notification", refresh);
    return () => window.removeEventListener("sse:notification", refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysSignature, refresh]);

  return counts;
}
