"use client";

import { useRouter } from "next/navigation";
import { GitCompareArrows } from "lucide-react";
import { usePatientClinicalSessions, type ClinicalSessionTab } from "@/lib/hooks/usePatientClinicalSessions";

function fmtDate(d: string): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Consultation / Follow-up / Protocol Follow-up session switcher — sits
 * above the Clinical Journey ("Basic") sidebar on the patient workspace.
 * Every tab, including this one, always resolves to the SAME patient
 * workspace route (/doctor/patients/{id}[?session={appointmentId}]) — there
 * is no separate "follow-up page"; a follow-up session is the same Basic
 * sidebar, just scoped to that session's context. Only sessions that have
 * actually been booked ever appear as a tab. */
export function SessionTabsBar({
  patientId, activeSessionId, onCompare,
}: { patientId: string; activeSessionId?: string | null; onCompare?: () => void }) {
  const router = useRouter();
  const { sessions, isLoading } = usePatientClinicalSessions(patientId);

  if (isLoading || sessions.length === 0) return null;

  function openTab(t: ClinicalSessionTab) {
    if (t.appointment.appointment_type === "initial") {
      router.push(`/doctor/patients/${patientId}`);
    } else {
      router.push(`/doctor/patients/${patientId}?session=${t.appointment.appointment_id}`);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-md flex items-stretch overflow-x-auto">
      <div className="flex items-stretch flex-1 min-w-0">
        {sessions.map((t) => {
          const isActive = t.appointment.appointment_type === "initial" ? !activeSessionId : t.appointment.appointment_id === activeSessionId;
          return (
            <button
              key={t.appointment.appointment_id}
              onClick={() => openTab(t)}
              className={`px-5 py-3 text-left border-b-2 flex-shrink-0 transition-colors ${
                isActive ? "border-b-blue-500 bg-blue-50/60" : "border-b-transparent hover:bg-neutral-50"
              }`}
            >
              <p className={`text-sm font-semibold ${isActive ? "text-blue-700" : "text-neutral-800"}`}>{t.label}</p>
              <p className="text-[11px] text-neutral-400 mt-0.5">{fmtDate(t.appointment.appointment_date)}</p>
            </button>
          );
        })}
      </div>
      {onCompare && sessions.length >= 2 && (
        <button
          onClick={onCompare}
          className="flex items-center gap-1.5 px-4 text-xs font-semibold text-neutral-500 hover:text-neutral-800 flex-shrink-0 border-l border-neutral-100"
        >
          <GitCompareArrows className="w-3.5 h-3.5" /> View Changes
        </button>
      )}
    </div>
  );
}
