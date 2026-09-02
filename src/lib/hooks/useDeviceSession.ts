"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  // Serializes checklist writes on this session — the pre-session page fires
  // saveChecklist from several independent buttons (patient signature, CA
  // signature, Start Session), and clicking two close together used to race
  // the backend's lazy header-create: both calls see no header row yet, both
  // try to create it, the loser 409s (uq_ds_appointment). Chaining every
  // call onto the tail of the previous one closes that window without
  // touching the backend's per-request transaction.
  const checklistQueue = useRef<Promise<unknown>>(Promise.resolve());

  const reload = useCallback(async () => {
    if (!appointmentId) return;
    try {
      const data = await deviceSessionService.get(appointmentId);
      // get()'s own scales field is a plain read (repo.list_for_session) —
      // it never seeds device_session_scales from the protocol's scale
      // list. Only GET /device-sessions/{id}/scales (listScales) does that
      // seeding, and nothing was calling it, so every session showed "No
      // scales due this session" even when the protocol had scales
      // assigned. Call it here and merge in, so the Scales & Assessments
      // tab is populated as soon as the session loads instead of needing a
      // separate trigger nothing in the UI provides.
      try {
        data.scales = await deviceSessionService.listScales(appointmentId);
      } catch {
        // Session not started yet (_header_or_404 404s pre-checklist) or a
        // transient failure — keep get()'s scales as a fallback rather than
        // failing the whole reload over this one field.
      }
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
      // Chain onto the previous call rather than firing immediately — this
      // is what actually prevents the two-buttons-at-once race, not just a
      // best-effort catch after the fact.
      const run = checklistQueue.current.then(async () => {
        try {
          await deviceSessionService.saveChecklist(appointmentId, body);
        } catch (err: unknown) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status !== 409) throw err;
          // Lost the lazy-create race — the header exists now (another
          // queued call created it), so retry as a plain update instead of
          // surfacing a crash for a save that's actually fine.
          await deviceSessionService.saveChecklist(appointmentId, body);
        }
      });
      checklistQueue.current = run.catch(() => {}); // keep the queue alive even if this call ultimately failed
      await run;
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

    async complete(earlyCompletionOverrideReason?: string) {
      if (!appointmentId) return;
      await deviceSessionService.complete(appointmentId, earlyCompletionOverrideReason);
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
