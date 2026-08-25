"use client";

import { useCallback, useEffect, useState } from "react";
import { doctorsService, type VisitSummary } from "@/lib/api/services/doctors.service";

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
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setIsLoading(false));
  }, [patientId, appointmentId]);

  useEffect(load, [load]);

  return { summary, isLoading, reload: load };
}
