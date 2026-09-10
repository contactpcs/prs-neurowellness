"use client";

import { useCallback, useEffect, useState } from "react";
import { appointmentsService } from "@/lib/api/services/appointments.service";
import type { Appointment } from "@/types/domain.types";

export interface ClinicalSessionTab {
  appointment: Appointment;
  /** "Consultation" for the initial appointment, "Follow-up N" / "Protocol
   * Follow-up N" counted separately per type, in booking order. */
  label: string;
  /** Position in the chronological list — 0 is always the Initial
   * Consultation. Only sessions that have actually been booked appear here,
   * so "Follow-up 2" can never show up before "Follow-up 1" is booked. */
  index: number;
}

// A Consultation / Follow-up / Protocol Follow-up only earns a tab once the
// doctor has clicked "Start Consultation" for it (status -> in_progress),
// or it is already completed. Check-in / No-Show / Reschedule / any other
// appointment-status flow does NOT create or activate a tab — the ONLY
// trigger is the doctor's "Start Consultation" action. Before that the tab
// does not exist and nothing on it is editable. No type is exempt: even the
// Initial Consultation tab stays inert until its consultation is started.
const VISIBLE_AFTER_START = new Set(["in_progress", "completed"]);

/** The patient's clinical review sessions — Initial Consultation, Follow-up,
 * Protocol Follow-up — in booking order. Device Sessions are excluded; they
 * are pure treatment delivery, reviewed from the Sessions panel instead.
 * Shared by the session tab bar and the patient workspace so both agree on
 * numbering and ordering. */
export function usePatientClinicalSessions(patientId: string) {
  const [sessions, setSessions] = useState<ClinicalSessionTab[]>([]);
  // True once the doctor has clicked "Start Consultation" on the Initial
  // Consultation (its appointment reached in_progress / completed). Until
  // then the whole clinical workspace is inert — no tab, nothing editable.
  const [hasStartedConsultation, setHasStartedConsultation] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(() => {
    setIsLoading(true);
    appointmentsService
      .list({ limit: 200 })
      .then(({ appointments }) => {
        const mine = appointments
          .filter(
            (a) =>
              (a.patient_public_id ?? a.patient_id) === patientId &&
              a.appointment_type !== "device_session" &&
              // status === "rescheduled" marks the OLD row a reschedule
              // replaced — it's superseded, not a session in its own right.
              // Without this, rescheduling twice left 3 "Consultation" tabs
              // (the original initial row plus both superseded reschedules)
              // all pointing at dead appointment_ids, and the doctor landed
              // on whichever one the tab bar happened to pick first — often
              // a frozen, no-longer-live row, which is why Anamnesis was
              // locked and unwritable even though a real open session existed.
              a.status !== "rescheduled" &&
              VISIBLE_AFTER_START.has(a.status)
          )
          .sort((a, b) => (a.appointment_date + a.start_time).localeCompare(b.appointment_date + b.start_time));

        let followUpN = 0;
        let protocolFollowUpN = 0;
        const tabs: ClinicalSessionTab[] = mine.map((appointment, index) => {
          if (appointment.appointment_type === "initial") return { appointment, label: "Consultation", index };
          if (appointment.appointment_type === "protocol_followup") {
            protocolFollowUpN += 1;
            return { appointment, label: `Protocol Follow-up ${protocolFollowUpN}`, index };
          }
          followUpN += 1;
          return { appointment, label: `Follow-up ${followUpN}`, index };
        });
        setSessions(tabs);
        setHasStartedConsultation(mine.some((a) => a.appointment_type === "initial"));
      })
      .catch(() => { setSessions([]); setHasStartedConsultation(false); })
      .finally(() => setIsLoading(false));
  }, [patientId]);

  useEffect(load, [load]);

  return { sessions, isLoading, hasStartedConsultation, reload: load };
}
