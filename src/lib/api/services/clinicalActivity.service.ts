import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";

export type ClinicalActivityAction =
  | "protocol_created"
  | "protocol_amended"
  | "protocol_updated"
  | "protocol_activated"
  | "protocol_cancelled"
  | "protocol_completed"
  | "prs_taken"
  | "anamnesis_taken"
  | "device_session_run"
  | "consultation_checked_in"
  | "consultation_started"
  | "consultation_completed";

export type ClinicalActivityEntry = {
  occurred_at: string;
  action: ClinicalActivityAction;
  actor_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
  entity_type: string;
  entity_id: string;
  /** protocol_amended / protocol_updated carry `changes: { field: { from, to } }` for doctor/admin only. */
  details: Record<string, unknown>;
};

// Real (SQL/v1/106) — who took the PRS / anamnesis, who ran each device
// session, who issued or changed each protocol, and when. The backend picks
// the view from the caller's role: a clinical assistant gets no protocol
// lifecycle steps (updated/activated/cancelled/completed) and no diffs.
export const clinicalActivityService = {
  /** Newest first. `actorId` (profiles.id) narrows to one staff member's actions. */
  async getForPatient(patientId: string, params?: { actorId?: string; limit?: number }): Promise<ClinicalActivityEntry[]> {
    const { data } = await apiClient.get(ENDPOINTS.PATIENTS.CLINICAL_ACTIVITY(patientId), {
      params: { actor_id: params?.actorId, limit: params?.limit },
    });
    return Array.isArray(data) ? data : [];
  },
};
