import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { Permission } from "@/types/domain.types";

/** PatientScaleAssignmentRead (real backend) is scale-keyed, not
 * disease-keyed — no disease_id/disease_name field exists on it at all
 * (confirmed against app/modules/prs/schemas.py). disease_id is left blank
 * rather than guessed. */
function mapAssignment(a: Record<string, unknown>): Permission {
  return {
    permission_id: String(a.psa_id ?? ""),
    patient_id: String(a.patient_id ?? ""),
    granted_by: String(a.assigned_by ?? ""),
    disease_id: "",
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
    const { data } = await apiClient.get(ENDPOINTS.PRS.PATIENT_PERMISSIONS(patientId), {
      params: { assessment_stage: "main_clinical" },
    });
    const list: Record<string, unknown>[] = Array.isArray(data) ? data : [];
    const permissions = list.map(mapAssignment);
    return { permissions, total: permissions.length };
  },

  // NOT AVAILABLE — no revoke/delete endpoint on patient-scale-assignments.
  async revokePermission(): Promise<never> {
    throw new Error("Revoking a scale assignment isn't available yet.");
  },
};
