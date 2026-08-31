"use client";

import { useCallback, useEffect, useState } from "react";
import { doctorsService, type VisitSummary } from "@/lib/api/services/doctors.service";
import { withResponses } from "@/lib/api/services/anamnesis.service";

/** Everything tied to one visit (anamnesis/PRS/protocol), keyed by
 * appointment_id — not the patient-wide "latest" a plain patient-scoped
 * fetch would return. Refetches whenever the selected visit changes, so
 * switching toggles never shows a previous visit's cached data. */
export function usePatientVisitSummary(patientId: string, appointmentId: string | null) {
  const [summary, setSummary] = useState<VisitSummary | null>(null);
  const [isLoading, setIsLoading] = useState(!!appointmentId);

  const load = useCallback(() => {
    if (!patientId || !appointmentId) {
      setSummary(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    doctorsService
      .getVisitSummary(patientId, appointmentId)
      // The bundle's anamnesis is the bare assessment row (same shape GET
      // /patients/{id}/anamnesis returns) — saved answers live at a separate
      // endpoint. Without this hydration the form/read-only view always
      // shows "No assessment responses recorded" even when responses exist.
      .then(async (data) => (data.anamnesis ? { ...data, anamnesis: await withResponses(data.anamnesis) } : data))
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setIsLoading(false));
  }, [patientId, appointmentId]);

  useEffect(load, [load]);

  return { summary, isLoading, reload: load };
}
