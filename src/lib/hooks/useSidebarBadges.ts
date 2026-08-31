"use client";

import { useCallback, useEffect, useState } from "react";
import { appointmentsService } from "@/lib/api/services/appointments.service";
import { staffService } from "@/lib/api/services/staff.service";
import { receptionService } from "@/lib/api/services/reception.service";
import { staffRequestsService } from "@/lib/api/services/staffRequests.service";
import { clinicRequestsService } from "@/lib/api/services/clinicRequests.service";
import { notificationsService } from "@/lib/api/services/notifications.service";

// Sidebar nav badges — one pending count per role's "needs your action"
// item, refreshed on mount and on every SSE push (AuthProvider's generic
// "sse:notification" dispatch covers appointment/staff_request/
// patient_approval alike, so one listener here handles them all instead of
// wiring a separate window event per badge type).
//
// "patientApprovals" (clinical_assistant) and "receptionPatientApprovals"
// (receptionist) are deliberately separate keys even though they show the
// same concept — clinical_assistant stays on the generic /patients-based
// staffService, while receptionist reads from the role-restricted
// /api/v1/reception/* module, which 403s for clinical_assistant.
export type BadgeKey =
  | "patientApprovals" | "receptionPatientApprovals" | "staffRequests"
  | "staffApprovals" | "clinicRequests" | "doctorPendingAppointments" | "receptionUnreadNotifications"
  | "doctorUnreadNotifications" | "patientUnreadNotifications";

const FETCHERS: Record<BadgeKey, () => Promise<number>> = {
  patientApprovals: async () => (await staffService.getPendingPatients()).total,
  receptionPatientApprovals: async () => (await receptionService.getPendingPatients()).total,
  staffRequests: async () => (await staffRequestsService.list({ status: "pending" })).length,
  staffApprovals: async () => (await staffRequestsService.list({ status: "pending" })).length,
  clinicRequests: async () => (await clinicRequestsService.list({ status: "pending" })).length,
  doctorPendingAppointments: async () => (await appointmentsService.list({ status: "selected" })).total,
  receptionUnreadNotifications: async () => receptionService.getUnreadCount(),
  doctorUnreadNotifications: async () => (await notificationsService.getNotifications({ limit: 1 })).unread_count,
  patientUnreadNotifications: async () => (await notificationsService.getNotifications({ limit: 1 })).unread_count,
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
