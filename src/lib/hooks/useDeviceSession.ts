"use client";

import { useCallback, useEffect, useState } from "react";
import { deviceSessionService } from "@/lib/api/services/deviceSession.service";
import type {
  DeviceSessionDetail, DeviceSessionChecklistUpdate, Symptom, Severity, AdverseEventType,
  CognitiveActivity, ScaleDeliveryMode, SessionFeedback, PauseStopReason, SosType,
} from "@/types/deviceSession.types";

/** Local-state hook for one device session's live record — not a Redux slice
 * like useSessions/useAppointments, because this state is almost entirely
 * ephemeral to the screen it's rendered on (which of the 9 live-session
 * sections is open, the ticking countdown) rather than something other
 * screens need to read. Every write re-fetches the full detail rather than
 * patching local state piecemeal, since the backend recomputes session_status
 * and hydrated child lists server-side — trying to keep a local mirror in
 * sync with 10 child tables is more surface area than one extra round trip. */
export function useDeviceSession(appointmentId: string | undefined) {
  const [session, setSession] = useState<DeviceSessionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!appointmentId) return;
    try {
      const data = await deviceSessionService.get(appointmentId);
      setSession(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load device session");
    } finally {
      setIsLoading(false);
    }
  }, [appointmentId]);

  useEffect(() => {
    setIsLoading(true);
    reload();
  }, [reload]);

  // Countdown derived from started_at/paused_at + the prescribed duration,
  // not stored server-side — the header only carries anchors, not a ticking
  // clock. Callers pass the prescribed duration (from the protocol) since
  // actual_duration_min may not be set yet at session start.
  const remainingSeconds = useCallback(
    (prescribedDurationMin: number, rampUpSec = 0, rampDownSec = 0): number => {
      if (!session?.started_at) return (prescribedDurationMin * 60) + rampUpSec + rampDownSec;
      const totalMs = ((prescribedDurationMin * 60) + rampUpSec + rampDownSec) * 1000;
      const anchor = session.session_status === "paused" && session.paused_at ? session.paused_at : session.started_at;
      const elapsedMs = session.session_status === "paused"
        ? new Date(session.paused_at ?? anchor).getTime() - new Date(session.started_at).getTime()
        : Date.now() - new Date(session.started_at).getTime();
      return Math.max(0, Math.round((totalMs - elapsedMs) / 1000));
    },
    [session]
  );

  return {
    session,
    isLoading,
    error,
    reload,

    async saveChecklist(body: DeviceSessionChecklistUpdate) {
      if (!appointmentId) return;
      await deviceSessionService.saveChecklist(appointmentId, body);
      await reload();
    },

    async start() {
      if (!appointmentId) return;
      await deviceSessionService.start(appointmentId);
      await reload();
    },

    async pause(reason: PauseStopReason, detail?: string) {
      if (!appointmentId) return;
      await deviceSessionService.pause(appointmentId, reason, detail);
      await reload();
    },

    async resume() {
      if (!appointmentId) return;
      await deviceSessionService.resume(appointmentId);
      await reload();
    },

    async stop(reason: PauseStopReason, detail?: string) {
      if (!appointmentId) return;
      await deviceSessionService.stop(appointmentId, reason, detail);
      await reload();
    },

    async complete() {
      if (!appointmentId) return;
      await deviceSessionService.complete(appointmentId);
      await reload();
    },

    async setDeviceFit(checklist: Record<string, boolean>, impedanceKohm?: number) {
      if (!appointmentId) return;
      await deviceSessionService.setDeviceFit(appointmentId, checklist, impedanceKohm);
      await reload();
    },

    async recordSymptom(symptom: Symptom, severity: Severity, note?: string) {
      if (!appointmentId) return;
      await deviceSessionService.recordSymptom(appointmentId, symptom, severity, note);
      await reload();
    },

    async recordAdverseEvent(body: { event_type: AdverseEventType; severity: Severity; description: string; action_taken?: string }) {
      if (!appointmentId) return;
      await deviceSessionService.recordAdverseEvent(appointmentId, body);
      await reload();
    },

    async addNote(noteText: string) {
      if (!appointmentId) return;
      await deviceSessionService.addNote(appointmentId, noteText);
      await reload();
    },

    async recordActivity(activities: CognitiveActivity[], freeText?: string, note?: string) {
      if (!appointmentId) return;
      await deviceSessionService.recordActivity(appointmentId, activities, freeText, note);
      await reload();
    },

    async setScaleDelivery(protocolScaleId: string, deliveryMode: ScaleDeliveryMode) {
      if (!appointmentId) return;
      await deviceSessionService.setScaleDelivery(appointmentId, protocolScaleId, deliveryMode);
      await reload();
    },

    async recordFeedback(answers: SessionFeedback["answers"], quote?: string) {
      if (!appointmentId) return;
      await deviceSessionService.recordFeedback(appointmentId, answers, quote);
      await reload();
    },

    async confirmNextSession(body: { patient_confirmed: boolean; requested_date?: string; requested_slot?: string; note?: string }) {
      if (!appointmentId) return;
      await deviceSessionService.confirmNextSession(appointmentId, body);
      await reload();
    },

    async raiseSos(sosType: SosType, note?: string) {
      if (!appointmentId) return;
      await deviceSessionService.raiseSos(appointmentId, sosType, note);
      await reload();
    },

    remainingSeconds,
  };
}
