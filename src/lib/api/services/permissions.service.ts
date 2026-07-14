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
    // Assignments are per-scale rows; grouped here by disease_id (one
    // Permission per disease, scale_ids aggregated) with disease_name
    // resolved from /prs-catalog/diseases.
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
    const instances: { disease_id?: string; instance_id?: string; status?: string; completed_at?: string }[] =
      Array.isArray(instancesRes.data) ? instancesRes.data : [];
    // Latest completed instance per disease — flips the grouped Permission
    // to "completed" and carries the instance_id for results links.
    const completedByDisease = new Map<string, { instance_id?: string; completed_at?: string }>();
    for (const i of instances) {
      if (i.status === "completed" && i.disease_id) {
        completedByDisease.set(String(i.disease_id), i);
      }
    }

    const byDisease = new Map<string, Permission>();
    const ungrouped: Permission[] = [];
    for (const row of list) {
      const p = mapAssignment(row);
      if (p.status === "revoked") continue;
      if (!p.disease_id) {
        ungrouped.push(p); // legacy rows created before disease_id existed
        continue;
      }
      const existing = byDisease.get(p.disease_id);
      if (existing) {
        existing.scale_ids.push(...p.scale_ids);
      } else {
        const done = completedByDisease.get(p.disease_id);
        byDisease.set(p.disease_id, {
          ...p,
          disease_name: diseaseNameById.get(p.disease_id) ?? p.disease_id,
          ...(done
            ? { status: "completed" as const, completed_at: done.completed_at, instance_id: done.instance_id }
            : {}),
        });
      }
    }
    const permissions = [...byDisease.values(), ...ungrouped];
    return { permissions, total: permissions.length };
  },

  // NOT AVAILABLE — no revoke/delete endpoint on patient-scale-assignments.
  async revokePermission(): Promise<never> {
    throw new Error("Revoking a scale assignment isn't available yet.");
  },
};
