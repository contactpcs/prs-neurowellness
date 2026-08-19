import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type {
  DeviceSessionRead, DeviceSessionDetail, DeviceSessionChecklistUpdate,
  SymptomRecord, Symptom, Severity,
  AdverseEventRecord, AdverseEventType,
  NoteRecord, ActivityRecord, CognitiveActivity,
  DeviceSessionScale, ScaleDeliveryMode,
  SessionFeedback, MediaRecord, MediaType,
  SessionEvent, SosEvent, SosType, PauseStopReason,
} from "@/types/deviceSession.types";

/** tDCS Device Session module — backend/app/modules/device_sessions
 * (`/api/v1/device-sessions/{appointment_id}/*`). Keyed by appointment_id
 * throughout, not a separate session id — see endpoints.ts. */
export const deviceSessionService = {
  async get(appointmentId: string): Promise<DeviceSessionDetail> {
    const { data } = await apiClient.get(ENDPOINTS.DEVICE_SESSIONS.DETAIL(appointmentId));
    return data;
  },

  async saveChecklist(appointmentId: string, body: DeviceSessionChecklistUpdate): Promise<DeviceSessionRead> {
    const { data } = await apiClient.post(ENDPOINTS.DEVICE_SESSIONS.CHECKLIST(appointmentId), body);
    return data;
  },

  async start(appointmentId: string): Promise<DeviceSessionRead> {
    const { data } = await apiClient.post(ENDPOINTS.DEVICE_SESSIONS.START(appointmentId));
    return data;
  },

  async pause(appointmentId: string, reason: PauseStopReason, detail?: string): Promise<DeviceSessionRead> {
    const { data } = await apiClient.post(ENDPOINTS.DEVICE_SESSIONS.PAUSE(appointmentId), { reason, detail });
    return data;
  },

  async resume(appointmentId: string): Promise<DeviceSessionRead> {
    const { data } = await apiClient.post(ENDPOINTS.DEVICE_SESSIONS.RESUME(appointmentId));
    return data;
  },

  async stop(appointmentId: string, reason: PauseStopReason, detail?: string): Promise<DeviceSessionRead> {
    const { data } = await apiClient.post(ENDPOINTS.DEVICE_SESSIONS.STOP(appointmentId), { reason, detail });
    return data;
  },

  async complete(appointmentId: string): Promise<DeviceSessionRead> {
    const { data } = await apiClient.post(ENDPOINTS.DEVICE_SESSIONS.COMPLETE(appointmentId));
    return data;
  },

  async setDeviceFit(appointmentId: string, checklist: Record<string, boolean>, impedanceKohm?: number): Promise<DeviceSessionRead> {
    const { data } = await apiClient.post(ENDPOINTS.DEVICE_SESSIONS.DEVICE_FIT(appointmentId), {
      device_fit_checklist: checklist,
      impedance_kohm: impedanceKohm,
    });
    return data;
  },

  async recordSymptom(appointmentId: string, symptom: Symptom, severity: Severity, note?: string): Promise<SymptomRecord> {
    const { data } = await apiClient.post(ENDPOINTS.DEVICE_SESSIONS.SYMPTOMS(appointmentId), { symptom, severity, note });
    return data;
  },

  async listSymptoms(appointmentId: string): Promise<SymptomRecord[]> {
    const { data } = await apiClient.get(ENDPOINTS.DEVICE_SESSIONS.SYMPTOMS(appointmentId));
    return Array.isArray(data) ? data : [];
  },

  async recordAdverseEvent(
    appointmentId: string,
    body: { event_type: AdverseEventType; severity: Severity; description: string; action_taken?: string }
  ): Promise<AdverseEventRecord> {
    const { data } = await apiClient.post(ENDPOINTS.DEVICE_SESSIONS.ADVERSE_EVENTS(appointmentId), body);
    return data;
  },

  async listAdverseEvents(appointmentId: string): Promise<AdverseEventRecord[]> {
    const { data } = await apiClient.get(ENDPOINTS.DEVICE_SESSIONS.ADVERSE_EVENTS(appointmentId));
    return Array.isArray(data) ? data : [];
  },

  async addNote(appointmentId: string, noteText: string): Promise<NoteRecord> {
    const { data } = await apiClient.post(ENDPOINTS.DEVICE_SESSIONS.NOTES(appointmentId), { note_text: noteText });
    return data;
  },

  async listNotes(appointmentId: string): Promise<NoteRecord[]> {
    const { data } = await apiClient.get(ENDPOINTS.DEVICE_SESSIONS.NOTES(appointmentId));
    return Array.isArray(data) ? data : [];
  },

  async recordActivity(appointmentId: string, activities: CognitiveActivity[], freeText?: string, note?: string): Promise<ActivityRecord> {
    const { data } = await apiClient.post(ENDPOINTS.DEVICE_SESSIONS.ACTIVITIES(appointmentId), {
      activities, free_text: freeText, note,
    });
    return data;
  },

  async listActivities(appointmentId: string): Promise<ActivityRecord[]> {
    const { data } = await apiClient.get(ENDPOINTS.DEVICE_SESSIONS.ACTIVITIES(appointmentId));
    return Array.isArray(data) ? data : [];
  },

  async listScales(appointmentId: string): Promise<DeviceSessionScale[]> {
    const { data } = await apiClient.get(ENDPOINTS.DEVICE_SESSIONS.SCALES(appointmentId));
    return Array.isArray(data) ? data : [];
  },

  async setScaleDelivery(appointmentId: string, protocolScaleId: string, deliveryMode: ScaleDeliveryMode): Promise<DeviceSessionScale> {
    const { data } = await apiClient.patch(ENDPOINTS.DEVICE_SESSIONS.SCALE(appointmentId, protocolScaleId), { delivery_mode: deliveryMode });
    return data;
  },

  async recordFeedback(
    appointmentId: string,
    answers: SessionFeedback["answers"],
    quote?: string
  ): Promise<SessionFeedback> {
    const { data } = await apiClient.post(ENDPOINTS.DEVICE_SESSIONS.FEEDBACK(appointmentId), { answers, quote });
    return data;
  },

  async confirmMediaConsent(appointmentId: string): Promise<void> {
    await apiClient.post(ENDPOINTS.DEVICE_SESSIONS.MEDIA_CONSENT(appointmentId));
  },

  async addMedia(appointmentId: string, mediaType: MediaType, fileKey: string): Promise<MediaRecord> {
    const { data } = await apiClient.post(ENDPOINTS.DEVICE_SESSIONS.MEDIA(appointmentId), { media_type: mediaType, file_key: fileKey });
    return data;
  },

  async listMedia(appointmentId: string): Promise<MediaRecord[]> {
    const { data } = await apiClient.get(ENDPOINTS.DEVICE_SESSIONS.MEDIA(appointmentId));
    return Array.isArray(data) ? data : [];
  },

  async confirmNextSession(
    appointmentId: string,
    body: { patient_confirmed: boolean; requested_date?: string; requested_slot?: string; note?: string }
  ): Promise<DeviceSessionRead> {
    const { data } = await apiClient.post(ENDPOINTS.DEVICE_SESSIONS.NEXT_SESSION(appointmentId), body);
    return data;
  },

  async listEvents(appointmentId: string): Promise<SessionEvent[]> {
    const { data } = await apiClient.get(ENDPOINTS.DEVICE_SESSIONS.EVENTS(appointmentId));
    return Array.isArray(data) ? data : [];
  },

  async raiseSos(appointmentId: string, sosType: SosType, note?: string): Promise<SosEvent> {
    const { data } = await apiClient.post(ENDPOINTS.DEVICE_SESSIONS.SOS(appointmentId), { sos_type: sosType, note });
    return data;
  },

  async acknowledgeSos(appointmentId: string, sosId: string): Promise<SosEvent> {
    const { data } = await apiClient.patch(ENDPOINTS.DEVICE_SESSIONS.SOS_ACK(appointmentId, sosId));
    return data;
  },

  async listSos(appointmentId: string): Promise<SosEvent[]> {
    const { data } = await apiClient.get(ENDPOINTS.DEVICE_SESSIONS.SOS(appointmentId));
    return Array.isArray(data) ? data : [];
  },
};
