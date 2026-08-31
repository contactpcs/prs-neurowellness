import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { Permission } from "@/types/domain.types";

/** PatientScaleAssignmentRead is scale-keyed (one row per scale) but now
 * also carries disease_id. */
function mapAssignment(a: Record<string, unknown>): Permission {
  return {
    permission_id: String(a.psa_id ?? ""),
    patient_id: String(a.patient_id ?? ""),
    granted_by: String(a.assigned_by ?? ""),
    disease_id: String(a.disease_id ?? ""),
    scale_ids: a.scale_id ? [String(a.scale_id)] : [],
    status: a.is_active === false ? "revoked" : "granted",
    granted_at: String(a.created_at ?? ""),
  };
}

export const permissionsService = {
  /** Real backend has no single "grant" call — POSTs one
   * patient-scale-assignment per scale_id. Returns the first created row. */
  async grantPermission(payload: { patient_id: string; disease_id: string; scale_ids?: string[] }): Promise<Permission> {
    const scaleIds = payload.scale_ids ?? [];
    const created = await Promise.all(
      scaleIds.map((scale_id) =>
        apiClient.post(ENDPOINTS.PRS.PERMISSIONS, {
          patient_id: payload.patient_id,
          scale_id,
          disease_id: payload.disease_id,
          assessment_stage: "main_clinical",
          assignment_reason: "doctor_override",
        })
      )
    );
    return mapAssignment(created[0]?.data ?? {});
  },

  // NOT AVAILABLE directly — resolved via the caller's own /patients record first.
  async getMyPermissions(): Promise<{ permissions: Permission[]; total: number }> {
    const patientsRes = await apiClient.get(ENDPOINTS.PATIENTS.DASHBOARD);
    const own = Array.isArray(patientsRes.data) ? patientsRes.data[0] : undefined;
    if (!own?.patient_id) return { permissions: [], total: 0 };
    return permissionsService.getPatientPermissions(own.patient_id as string);
  },

  async getPatientPermissions(patientId: string): Promise<{ permissions: Permission[]; total: number }> {
    // Scoped to main_clinical — this feeds the doctor's treatment-session
    // PRS/permissions view. Without this filter it also returned
    // general_registration-stage assignments (auto-assigned off the
    // patient's disease selection during registration), mixing registration
    // intake data into the doctor's ongoing-treatment assessment list. The
    // registration-stage data has its own separate "Registration Record" view.
    //
    // Assignments are per-scale rows. patient_scale_assignments has no
    // "which Assign click created this row" column, so a re-assign of the
    // same disease used to collapse into the SAME Permission as the first
    // one (grouped by disease_id alone) — the doctor's 2nd assignment was
    // silently absorbed into the 1st's already-"completed" card, no error,
    // nothing visibly new. Grouped by (disease_id, minute-truncated
    // created_at) instead — each Assign click's rows share a created_at
    // within the same minute (they're POSTed together), so each click is
    // its own round with its own granted_at, keyed by that round's first
    // row's psa_id (not the disease_id) so two rounds for the same disease
    // never collide into one Map slot.
    const [assignRes, diseasesRes, instancesRes] = await Promise.all([
      apiClient.get(ENDPOINTS.PRS.PATIENT_PERMISSIONS(patientId), {
        params: { assessment_stage: "main_clinical" },
      }),
      apiClient.get(ENDPOINTS.PRS.CONDITIONS).catch(() => ({ data: [] })),
      apiClient
        .get(ENDPOINTS.PRS.PATIENT_INSTANCES(patientId), {
          params: { assessment_stage: "main_clinical" },
        })
        .catch(() => ({ data: [] })),
    ]);
    const list: Record<string, unknown>[] = Array.isArray(assignRes.data) ? assignRes.data : [];
    const diseases: { disease_id?: string; disease_name?: string }[] = Array.isArray(diseasesRes.data)
      ? diseasesRes.data
      : [];
    const diseaseNameById = new Map(diseases.map((d) => [String(d.disease_id), d.disease_name]));
    const instances: { disease_id?: string; instance_id?: string; status?: string; started_at?: string; completed_at?: string }[] =
      Array.isArray(instancesRes.data) ? instancesRes.data : [];

    const minuteBucket = (iso: string) => iso.slice(0, 16); // "2026-07-15T10:23"

    // Group assignment rows into rounds: one per (disease_id, minute the
    // round was assigned in).
    const rounds = new Map<string, Permission>();
    const ungrouped: Permission[] = [];
    for (const row of list) {
      const p = mapAssignment(row);
      if (p.status === "revoked") continue;
      if (!p.disease_id) {
        ungrouped.push(p); // legacy rows created before disease_id existed
        continue;
      }
      const roundKey = `${p.disease_id}::${minuteBucket(p.granted_at)}`;
      const existing = rounds.get(roundKey);
      if (existing) {
        existing.scale_ids.push(...p.scale_ids);
        if (p.granted_at < existing.granted_at) existing.granted_at = p.granted_at; // earliest row in the round
      } else {
        rounds.set(roundKey, { ...p, disease_name: diseaseNameById.get(p.disease_id) ?? p.disease_id });
      }
    }

    // Match each round to the instance that actually belongs to it: the
    // instance whose started_at falls between this round's granted_at and
    // the NEXT round's granted_at for the same disease (so an old
    // instance from a prior round can never bleed into a later
    // re-assignment's round, which is exactly what silently happened before).
    const roundsByDisease = new Map<string, Permission[]>();
    for (const r of rounds.values()) {
      const arr = roundsByDisease.get(r.disease_id) ?? [];
      arr.push(r);
      roundsByDisease.set(r.disease_id, arr);
    }
    for (const [diseaseId, diseaseRounds] of roundsByDisease) {
      diseaseRounds.sort((a, b) => (a.granted_at < b.granted_at ? -1 : 1));
      const diseaseInstances = instances
        .filter((i) => String(i.disease_id) === diseaseId && i.started_at)
        .sort((a, b) => (a.started_at! < b.started_at! ? -1 : 1));
      diseaseRounds.forEach((round, idx) => {
        const windowEnd = diseaseRounds[idx + 1]?.granted_at ?? null;
        const match = diseaseInstances.find(
          (i) => i.started_at! >= round.granted_at && (windowEnd === null || i.started_at! < windowEnd),
        );
        if (match?.status === "completed") {
          round.status = "completed";
          round.completed_at = match.completed_at;
          round.instance_id = match.instance_id;
        } else if (match?.instance_id) {
          round.instance_id = match.instance_id; // in-progress — resumable, but not "completed"
        }
      });
    }

    const permissions = [...rounds.values(), ...ungrouped];
    return { permissions, total: permissions.length };
  },

  // NOT AVAILABLE — no revoke/delete endpoint on patient-scale-assignments.
  async revokePermission(): Promise<never> {
    throw new Error("Revoking a scale assignment isn't available yet.");
  },
};
