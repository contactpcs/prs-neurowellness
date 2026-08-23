"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Stethoscope } from "lucide-react";
import { useAppointments } from "@/lib/hooks/useAppointments";
import { useAppDispatch } from "@/store/hooks";
import { completeAppointment } from "@/store/slices/appointmentsSlice";

const BRAND = "linear-gradient(135deg, #00A1E4 0%, #09172E 100%)";

function fmt12(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Floating bottom-right widget shown across the doctor portal whenever this
 * doctor has an in_progress consultation — lets them end it without
 * navigating back to the appointment detail page. A doctor's calendar is
 * exclusive (excl_doctor_overlap), so there is at most one at a time. */
export function ActiveConsultationBar() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { appointments, refresh } = useAppointments({ status: "in_progress" });
  const [ending, setEnding] = useState(false);

  // This widget stays mounted across every doctor page (rendered from the
  // doctor layout), so it needs its own live-update hook — the same
  // "sse:appointment" event other pages already dispatch on status changes
  // (see doctor/appointments/page.tsx, dashboard/page.tsx) — rather than
  // only refreshing on its own mount.
  useEffect(() => {
    const onAppointmentEvent = () => refresh();
    window.addEventListener("sse:appointment", onAppointmentEvent);
    return () => window.removeEventListener("sse:appointment", onAppointmentEvent);
  }, [refresh]);

  // A device_session has no treating doctor (scheduling/service.py
  // _authorize_transition) — only a clinical_assistant/super_admin may end
  // one. Skip it here too, or "End Consultation" would 403 for the doctor
  // the same way the detail page's "Start Consultation" did.
  const active = appointments.find((a) => a.appointment_type !== "device_session");
  if (!active) return null;

  const endConsultation = async () => {
    setEnding(true);
    try {
      await dispatch(completeAppointment(active.appointment_id)).unwrap();
      // Don't wait on the SSE round-trip to stop showing a now-completed
      // consultation as active — state.list still holds it (upsert patches
      // in place, it doesn't drop items that no longer match the filter
      // this widget fetched with).
      refresh();
    } catch {
      // The appointment detail page surfaces the real error if this fails;
      // this widget just retries on next click rather than owning its own
      // error banner.
    } finally {
      setEnding(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-40 w-72 bg-white rounded-2xl shadow-xl border border-neutral-200 overflow-hidden">
      <button
        onClick={() => router.push(`/doctor/appointments/${active.appointment_id}`)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-white text-xs font-semibold"
        style={{ background: BRAND }}
      >
        <Stethoscope className="w-3.5 h-3.5 flex-shrink-0" />
        Consultation in progress
      </button>
      <div className="px-4 py-3">
        <p className="text-sm font-bold text-neutral-900 truncate">{active.patient_name ?? "Patient"}</p>
        <p className="text-xs text-neutral-500 mt-0.5">Started {fmt12(active.start_time)}</p>
        <button
          disabled={ending}
          onClick={endConsultation}
          className="mt-3 w-full py-2 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 transition-colors"
        >
          {ending ? "Ending…" : "End Consultation"}
        </button>
      </div>
    </div>
  );
}
