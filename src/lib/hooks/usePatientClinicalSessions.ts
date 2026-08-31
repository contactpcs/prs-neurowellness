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

// A Follow-up / Protocol Follow-up only earns a tab once the patient has
// actually checked in for it — a booked-but-not-yet-arrived follow-up isn't
// a session the doctor can do anything with yet, and showing it early just
// invites clicking into an empty screen. Initial Consultation is exempt: it
// is the base workspace itself, reachable regardless of check-in status.
const VISIBLE_AFTER_CHECKIN = new Set(["checked_in", "in_progress", "completed"]);

/** The patient's clinical review sessions — Initial Consultation, Follow-up,
 * Protocol Follow-up — in booking order. Device Sessions are excluded; they
 * are pure treatment delivery, reviewed from the Sessions panel instead.
 * Shared by the session tab bar and the patient workspace so both agree on
 * numbering and ordering. */
export function usePatientClinicalSessions(patientId: string) {
  const [sessions, setSessions] = useState<ClinicalSessionTab[]>([]);
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
              (a.appointment_type === "initial" || VISIBLE_AFTER_CHECKIN.has(a.status))
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
      })
      .catch(() => setSessions([]))
      .finally(() => setIsLoading(false));
  }, [patientId]);

  useEffect(load, [load]);

  return { sessions, isLoading, reload: load };
}
