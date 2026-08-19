import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type {
  DeviceCompanyRead, DeviceRead, ConditionRead, DiagnosisRead, DiagnosisResolution,
  PlacementRead, ElectrodeValidationRequest, ElectrodeValidationResult,
  DosingRead, ScaleRead, SchedulePreviewRequest, SchedulePreview,
  ProtocolCreate, ProtocolUpdate, ProtocolRead, ProtocolDetail, ProtocolSessionRead,
  DeviceSessionPrsCreate, FollowUpPrsCreate, PrsResponseRead,
  TreatmentCycleRead, TreatmentPlanRead,
  DeviceScheduleRead, DeviceOverrideRead, DeviceSlotRead,
  DeviceScheduleReplace, DeviceOverrideCreate, ClinicDeviceScheduleOverview,
} from "@/types/treatmentProtocol.types";

/** Treatment Protocol wizard — backend/app/modules/treatment_protocols
 * (`/api/v1/neuromod/*`, `/api/v1/treatment-protocols/*`). All 22 endpoints,
 * 1:1 with the real Pydantic schemas — no field renaming needed, this
 * module's shapes are used as-is. */
export const treatmentProtocolService = {
  // ─── Step 1 — Device ───
  async listDeviceCompanies(activeOnly = true): Promise<DeviceCompanyRead[]> {
    const { data } = await apiClient.get(ENDPOINTS.NEUROMOD.DEVICE_COMPANIES, { params: { active_only: activeOnly } });
    return Array.isArray(data) ? data : [];
  },

  /** clinicId should ALWAYS be passed when prescribing — without it this
   * returns the whole superadmin catalogue, including devices the doctor's
   * clinic doesn't own. The DB trigger rejects a mismatched device at
   * create time regardless, but sending clinic_id keeps the picker honest
   * up front instead of failing the doctor at step 8. */
  async listDevices(params?: { clinicId?: string; phase?: 1 | 2; activeOnly?: boolean }): Promise<DeviceRead[]> {
    const { data } = await apiClient.get(ENDPOINTS.NEUROMOD.DEVICES, {
      params: { clinic_id: params?.clinicId, phase: params?.phase, active_only: params?.activeOnly ?? true },
    });
    return Array.isArray(data) ? data : [];
  },

  async getDevice(deviceId: string): Promise<DeviceRead> {
    const { data } = await apiClient.get(ENDPOINTS.NEUROMOD.DEVICE(deviceId));
    return data;
  },

  // ─── Step 2 — Condition ───
  async listConditions(deviceId?: string): Promise<ConditionRead[]> {
    const { data } = await apiClient.get(ENDPOINTS.NEUROMOD.CONDITIONS, { params: { device_id: deviceId } });
    return Array.isArray(data) ? data : [];
  },

  // ─── Step 3 — Diagnosis ───
  async listDiagnoses(params: { conditionIds?: string[]; deviceId?: string; q?: string; skip?: number; limit?: number }): Promise<DiagnosisRead[]> {
    const { data } = await apiClient.get(ENDPOINTS.NEUROMOD.DIAGNOSES, {
      params: {
        condition_id: params.conditionIds?.length ? params.conditionIds : undefined,
        device_id: params.deviceId,
        q: params.q || undefined,
        skip: params.skip ?? 0,
        limit: params.limit ?? 200,
      },
      paramsSerializer: { indexes: null }, // condition_id repeats as ?condition_id=a&condition_id=b
    });
    return Array.isArray(data) ? data : [];
  },

  async resolveDiagnoses(deviceId: string, diagnosisIds: string[]): Promise<DiagnosisResolution> {
    const { data } = await apiClient.post(ENDPOINTS.NEUROMOD.DIAGNOSES_RESOLVE, { device_id: deviceId, diagnosis_ids: diagnosisIds });
    return data;
  },

  // ─── Step 4 — Placement ───
  async listPlacements(deviceId: string, conditionId?: string): Promise<PlacementRead[]> {
    const { data } = await apiClient.get(ENDPOINTS.NEUROMOD.PLACEMENTS, { params: { device_id: deviceId, condition_id: conditionId } });
    return Array.isArray(data) ? data : [];
  },

  async validatePlacement(body: ElectrodeValidationRequest): Promise<ElectrodeValidationResult> {
    const { data } = await apiClient.post(ENDPOINTS.NEUROMOD.PLACEMENTS_VALIDATE, body);
    return data;
  },

  // ─── Step 5 — Dosing ───
  async listDosing(deviceId: string, conditionId?: string, placementId?: string): Promise<DosingRead[]> {
    const { data } = await apiClient.get(ENDPOINTS.NEUROMOD.DOSING, {
      params: { device_id: deviceId, condition_id: conditionId, placement_id: placementId },
    });
    return Array.isArray(data) ? data : [];
  },

  // ─── Step 6 — Scales ───
  async listScales(conditionIds?: string[]): Promise<ScaleRead[]> {
    const { data } = await apiClient.get(ENDPOINTS.NEUROMOD.SCALES, {
      params: { condition_id: conditionIds?.length ? conditionIds : undefined },
      paramsSerializer: { indexes: null },
    });
    return Array.isArray(data) ? data : [];
  },

  // ─── Step 7 — Schedule preview (pure date arithmetic, no DB) ───
  async previewSchedule(body: SchedulePreviewRequest): Promise<SchedulePreview> {
    const { data } = await apiClient.post(ENDPOINTS.TREATMENT_PROTOCOLS.SCHEDULE_PREVIEW, body);
    return data;
  },

  // ─── Step 8 — Protocol lifecycle ───
  async createProtocol(body: ProtocolCreate): Promise<ProtocolRead> {
    const { data } = await apiClient.post(ENDPOINTS.TREATMENT_PROTOCOLS.CREATE, body);
    return data;
  },

  async listProtocols(params?: { planId?: string; patientId?: string; status?: string; skip?: number; limit?: number }): Promise<ProtocolRead[]> {
    const { data } = await apiClient.get(ENDPOINTS.TREATMENT_PROTOCOLS.LIST, {
      params: { plan_id: params?.planId, patient_id: params?.patientId, status: params?.status, skip: params?.skip ?? 0, limit: params?.limit ?? 50 },
    });
    return Array.isArray(data) ? data : [];
  },

  async getProtocolDetail(protocolId: string): Promise<ProtocolDetail> {
    const { data } = await apiClient.get(ENDPOINTS.TREATMENT_PROTOCOLS.DETAIL(protocolId));
    return data;
  },

  async updateProtocol(protocolId: string, body: ProtocolUpdate): Promise<ProtocolRead> {
    const { data } = await apiClient.patch(ENDPOINTS.TREATMENT_PROTOCOLS.UPDATE(protocolId), body);
    return data;
  },

  async listProtocolSessions(protocolId: string, appointmentType?: string): Promise<ProtocolSessionRead[]> {
    const { data } = await apiClient.get(ENDPOINTS.TREATMENT_PROTOCOLS.SESSIONS(protocolId), { params: { appointment_type: appointmentType } });
    return Array.isArray(data) ? data : [];
  },

  async activateProtocol(protocolId: string): Promise<ProtocolRead> {
    const { data } = await apiClient.post(ENDPOINTS.TREATMENT_PROTOCOLS.ACTIVATE(protocolId));
    return data;
  },

  async cancelProtocol(protocolId: string, reason: string): Promise<ProtocolRead> {
    const { data } = await apiClient.post(ENDPOINTS.TREATMENT_PROTOCOLS.CANCEL(protocolId), { reason });
    return data;
  },

  async completeProtocol(protocolId: string): Promise<ProtocolRead> {
    const { data } = await apiClient.post(ENDPOINTS.TREATMENT_PROTOCOLS.COMPLETE(protocolId));
    return data;
  },

  // ─── PRS responses ───
  async recordDeviceSessionPrs(protocolId: string, body: DeviceSessionPrsCreate): Promise<PrsResponseRead> {
    const { data } = await apiClient.post(ENDPOINTS.TREATMENT_PROTOCOLS.PRS_DEVICE_SESSION(protocolId), body);
    return data;
  },

  async recordFollowUpPrs(protocolId: string, body: FollowUpPrsCreate): Promise<PrsResponseRead> {
    const { data } = await apiClient.post(ENDPOINTS.TREATMENT_PROTOCOLS.PRS_FOLLOW_UP(protocolId), body);
    return data;
  },

  async listProtocolPrs(protocolId: string): Promise<PrsResponseRead[]> {
    const { data } = await apiClient.get(ENDPOINTS.TREATMENT_PROTOCOLS.PRS_LIST(protocolId));
    return Array.isArray(data) ? data : [];
  },

  // ─── protocol instances ───

  async listProtocolInstances(params: { patientId?: string; cycleId?: string; status?: string } = {}) {
    const { data } = await apiClient.get(ENDPOINTS.PROTOCOL_INSTANCES.LIST, {
      params: { patient_id: params.patientId, cycle_id: params.cycleId, status: params.status },
    });
    return Array.isArray(data) ? data : [];
  },

  /** Resolves the CYCLE for a patient, then opens a protocol instance on it.
   *
   *  A treatment CYCLE is the episode of care — one active per patient, and
   *  long-lived. A protocol INSTANCE is one course of device treatment, and a
   *  cycle can have several over time. "Start New Treatment Protocol" means a
   *  new instance, never a new cycle; creating a cycle each time is what
   *  produced "Patient already has an active treatment cycle".
   *
   *  A cycle is only created when the patient genuinely has none.
   */
  async resolveOrCreateInstanceId(opts: {
    patientId: string;
    doctorId: string;
    clinicId: string;
  }): Promise<string> {
    const { data: cycles } = await apiClient.get<TreatmentCycleRead[]>(ENDPOINTS.CLINICAL.CYCLES, {
      params: { patient_id: opts.patientId },
    });
    let cycle = (Array.isArray(cycles) ? cycles : []).find((c) => c.status !== "completed" && c.status !== "cancelled");
    if (!cycle) {
      const { data } = await apiClient.post(ENDPOINTS.CLINICAL.CYCLES, {
        patient_id: opts.patientId,
        doctor_id: opts.doctorId,
        clinic_id: opts.clinicId,
        cycle_type: "initial",
        cycle_number: 1,
      });
      cycle = data;
    }

    // uq_protocol_instances_one_active allows one draft/active instance per
    // cycle, so reuse the open one rather than colliding with it.
    const open = await this.listProtocolInstances({ cycleId: cycle!.cycle_id });
    const existing = open.find((i: any) => i.status === "draft" || i.status === "active");
    if (existing) return existing.instance_id;

    const { data: created } = await apiClient.post(ENDPOINTS.PROTOCOL_INSTANCES.CREATE, {
      cycle_id: cycle!.cycle_id,
    });
    return created.instance_id;
  },

  // ─── plan_id resolution — KEPT for the amend path and for anything still
  // creating a protocol against a plan. Since 45 a protocol hangs off an
  // instance and plan_id is optional, so new pushes use
  // resolveOrCreateInstanceId above instead. ───
  async resolveOrCreatePlanId(opts: {
    patientId: string;
    doctorId: string;
    clinicId: string;
    deviceType: string;
    sessionCount: number;
  }): Promise<string> {
    const { data: cycles } = await apiClient.get<TreatmentCycleRead[]>(ENDPOINTS.CLINICAL.CYCLES, { params: { patient_id: opts.patientId } });
    let cycle = (Array.isArray(cycles) ? cycles : []).find((c) => c.status !== "completed" && c.status !== "cancelled");
    if (!cycle) {
      const { data } = await apiClient.post(ENDPOINTS.CLINICAL.CYCLES, {
        patient_id: opts.patientId,
        doctor_id: opts.doctorId,
        clinic_id: opts.clinicId,
        cycle_type: "initial",
        cycle_number: 1,
      });
      cycle = data;
    }

    const { data: plans } = await apiClient.get<TreatmentPlanRead[]>(ENDPOINTS.CLINICAL.PLANS, {
      params: { patient_id: opts.patientId, cycle_id: cycle!.cycle_id },
    });
    const existingPlan = (Array.isArray(plans) ? plans : []).find((p) => p.status === "active" && p.cycle_id === cycle!.cycle_id);
    if (existingPlan) return existingPlan.plan_id;

    const { data: plan } = await apiClient.post<TreatmentPlanRead>(ENDPOINTS.CLINICAL.PLANS, {
      patient_id: opts.patientId,
      doctor_id: opts.doctorId,
      cycle_id: cycle!.cycle_id,
      device_type: opts.deviceType,
      sessions_prescribed: opts.sessionCount,
      standard_sessions: opts.sessionCount,
    });
    return plan.plan_id;
  },

  // ─── Clinic device schedule — one pool per DEVICE the clinic owns, not one
  // blanket number for the whole clinic (backend SQL/v1/41_device_capacity_per_device.sql) ───
  async listDeviceScheduleOverview(clinicId: string): Promise<ClinicDeviceScheduleOverview[]> {
    const { data } = await apiClient.get(ENDPOINTS.CLINIC_DEVICE.OVERVIEW(clinicId));
    return Array.isArray(data) ? data : [];
  },

  async listDeviceSchedule(clinicId: string, clinicDeviceId: string): Promise<DeviceScheduleRead[]> {
    const { data } = await apiClient.get(ENDPOINTS.CLINIC_DEVICE.SCHEDULE(clinicId, clinicDeviceId));
    return Array.isArray(data) ? data : [];
  },

  async listDeviceOverrides(clinicId: string, clinicDeviceId: string, fromDate?: string): Promise<DeviceOverrideRead[]> {
    const { data } = await apiClient.get(ENDPOINTS.CLINIC_DEVICE.OVERRIDES(clinicId, clinicDeviceId), { params: { from_date: fromDate } });
    return Array.isArray(data) ? data : [];
  },

  async listDeviceAvailability(
    clinicId: string, clinicDeviceId: string, fromDate: string, toDate?: string, onlyAvailable = false
  ): Promise<DeviceSlotRead[]> {
    const { data } = await apiClient.get(ENDPOINTS.CLINIC_DEVICE.AVAILABILITY(clinicId, clinicDeviceId), {
      params: { from_date: fromDate, to_date: toDate || fromDate, only_available: onlyAvailable },
    });
    return Array.isArray(data) ? data : [];
  },

  // ─── Settings → Device Schedule (clinic-admin CRUD) ───
  async replaceDeviceSchedule(clinicId: string, clinicDeviceId: string, body: DeviceScheduleReplace): Promise<DeviceScheduleRead[]> {
    const { data } = await apiClient.put(ENDPOINTS.CLINIC_DEVICE.SCHEDULE(clinicId, clinicDeviceId), body);
    return Array.isArray(data) ? data : [];
  },

  async addDeviceOverride(clinicId: string, clinicDeviceId: string, body: DeviceOverrideCreate): Promise<DeviceOverrideRead> {
    const { data } = await apiClient.post(ENDPOINTS.CLINIC_DEVICE.OVERRIDES(clinicId, clinicDeviceId), body);
    return data;
  },

  async deleteDeviceOverride(clinicId: string, clinicDeviceId: string, overrideId: string): Promise<void> {
    await apiClient.delete(ENDPOINTS.CLINIC_DEVICE.DELETE_OVERRIDE(clinicId, clinicDeviceId, overrideId));
  },
};
