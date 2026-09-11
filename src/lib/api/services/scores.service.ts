import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { AssessmentInstance } from "@/types/domain.types";

export type ScaleResultDetail = {
  scale_result_id: string;
  scale_id: string;
  scale_name?: string;
  scale_code?: string;
  calculated_value?: number;
  max_possible?: number;
  percentage?: number;
  severity_level?: string;
  severity_label?: string;
  subscale_scores?: Record<string, unknown>;
  risk_flags?: unknown[];
};

export type InstanceScoreDetail = {
  instance: {
    instance_id: string;
    disease_id?: string;
    disease_name?: string;
    status?: string;
    started_at?: string;
    completed_at?: string;
    initiated_by?: string;
  };
  disease_result?: {
    disease_score?: number;
    severity_level?: string;
    severity_label?: string;
    percentage?: number;
  };
  weighted_result?: {
    disease_score?: number;
    severity_level?: string;
    severity_label?: string;
    scale_breakdown?: Record<string, unknown>;
  };
  scale_results: ScaleResultDetail[];
};

function parseJsonField<T>(v: unknown, fallback: T): T {
  if (typeof v !== "string") return (v as T) ?? fallback;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

/** Backend GET /prs-assessment-instances/{id}/results returns
 * { scale_results, final_result } with subscale_scores/risk_flags/
 * scale_summaries as raw JSON strings, and no instance record. Compose the
 * InstanceScoreDetail the results pages render: instance fetched
 * separately (disease_name resolved from the catalog), final_result mapped
 * to disease_result, scale names matched from final_result.scale_summaries. */
/** patientId (optional): the public patients.patient_id (the role-table id
 * used everywhere as GET /patients/{id}), needed ONLY for the disease-
 * composite fetch below — /patients/{patient_id}/disease-composite resolves
 * it to a profile id server-side the same way every sibling /patients/{id}/
 * ... route in prs/router.py does. Pass it whenever the caller already has
 * it (the doctor results page gets it from the URL). When omitted (the
 * patient's own "my scores" flow has no patient_id in scope), this resolves
 * the caller's own patient_id from GET /patients first — the same fallback
 * anamnesisService.getMyAnamnesis() uses. */
export async function fetchInstanceScoreDetail(instanceId: string, patientId?: string): Promise<InstanceScoreDetail> {
  const [resultsRes, instanceRes, diseasesRes] = await Promise.all([
    apiClient.get(ENDPOINTS.PRS.INSTANCE_SCORE(instanceId)),
    apiClient.get(ENDPOINTS.PRS.ASSESSMENT_INSTANCE(instanceId)).catch(() => ({ data: null })),
    apiClient.get(ENDPOINTS.PRS.CONDITIONS).catch(() => ({ data: [] })),
  ]);

  const raw = resultsRes.data as { scale_results?: Record<string, unknown>[]; final_result?: Record<string, unknown> | null };
  const inst = (instanceRes.data ?? {}) as Record<string, unknown>;
  const diseases: { disease_id?: string; disease_name?: string }[] = Array.isArray(diseasesRes.data) ? diseasesRes.data : [];

  const final = raw.final_result ?? null;
  const summaries = parseJsonField<{ scale_code?: string; scale_name?: string }[]>(final?.scale_summaries, []);
  const nameByCode = new Map(summaries.map((s) => [s.scale_code, s.scale_name]));

  // NOTE: inst.patient_id here is a PROFILE id (prs_assessment_instances.
  // patient_id references profiles(id) directly, per this codebase's own
  // convention) — NOT the patients.patient_id role-table id the /patients/
  // {patient_id}/... routes expect. Passing it straight through 404s with
  // "Patient not found" (caught below, this was verified against the real
  // backend). Resolve the real patients.patient_id instead of guessing.
  const instDiseaseId = inst.disease_id != null ? String(inst.disease_id) : undefined;
  const resolvedPatientId =
    patientId ??
    (await apiClient
      .get(ENDPOINTS.PATIENTS.DASHBOARD)
      .then((r) => (Array.isArray(r.data) ? r.data[0]?.patient_id : undefined))
      .catch(() => undefined));

  // final_result.composite_score (prs_final_results) stopped being written
  // once the as-of-latest-per-scale composite model landed — it's a disease-
  // level, not per-instance, number now, computed across whichever scales
  // are most recently completed (possibly from other instances too). Fetch
  // it separately from core.disease_composite_scores instead of reading the
  // now-permanently-null old column.
  const composite =
    resolvedPatientId && instDiseaseId
      ? await apiClient
          .get(ENDPOINTS.PRS.DISEASE_COMPOSITE(resolvedPatientId), { params: { disease_id: instDiseaseId } })
          .then((r) => r.data as { calculated_value?: number | null; severity_level?: string | null; severity_label?: string | null })
          .catch(() => null)
      : null;

  const scale_results: ScaleResultDetail[] = (Array.isArray(raw.scale_results) ? raw.scale_results : []).map((sr) => {
    const scaleId = String(sr.scale_id ?? "");
    const scaleCode = scaleId.split("/")[0];
    return {
      ...(sr as object),
      scale_result_id: String(sr.scale_result_id ?? scaleId),
      scale_id: scaleId,
      scale_code: scaleCode,
      scale_name: nameByCode.get(scaleCode) ?? scaleCode,
      subscale_scores: parseJsonField<Record<string, unknown>>(sr.subscale_scores, {}),
      risk_flags: parseJsonField<unknown[]>(sr.risk_flags, []),
    } as ScaleResultDetail;
  });

  return {
    instance: {
      instance_id: instanceId,
      disease_id: instDiseaseId,
      disease_name: diseases.find((d) => d.disease_id === instDiseaseId)?.disease_name ?? instDiseaseId,
      status: inst.status as string | undefined,
      started_at: inst.started_at as string | undefined,
      completed_at: inst.completed_at as string | undefined,
      initiated_by: inst.initiated_by as string | undefined,
    },
    // The current as-of disease composite (core.disease_composite_scores),
    // fetched separately above — final.composite_score (prs_final_results)
    // is a retired per-instance column, permanently null since the as-of-
    // latest-per-scale model landed. final.percentage is a stale,
    // never-populated flat-sum ratio, and overall_severity/_label is the
    // worst SINGLE scale's severity, not the disease-level one — neither is
    // a substitute.
    //
    // Always an object, never undefined: the card renders on `disease_result`
    // being truthy and falls back to "—" internally when disease_score is
    // null — an undefined disease_result hides the whole card instead,
    // which reads as "no results at all" rather than "no composite yet".
    disease_result: {
      disease_score: composite?.calculated_value != null ? Number(composite.calculated_value) : undefined,
      percentage: composite?.calculated_value != null ? Number(composite.calculated_value) : undefined,
      severity_level: composite?.severity_level ?? undefined,
      severity_label: composite?.severity_label ?? undefined,
    },
    scale_results,
  };
}

/** Composed: resolve own patient_id via /patients (RLS-scoped, same call
 * patientsService.getMyAssessments() uses), list every prs-instance for
 * that patient, then hydrate scale_summaries for the completed ones via
 * fetchInstanceScoreDetail (same /results call the instance-detail page
 * uses). AssessmentInstanceRead.final_result is just a pointer string
 * ("{instance_id}/{disease_id}"), not the scored breakdown — this was
 * previously a hardcoded stub returning empty, which made the dashboard's
 * "PRS Assessment" progress card read every scale as still-pending: it
 * matches instances by disease_id and reads completedScaleIds off
 * scale_summaries, so an empty instances list meant "0 of N completed"
 * forever regardless of what the patient actually finished. */
async function composeMyScoresSummary(): Promise<{ instances: AssessmentInstance[]; total: number; diseases: number }> {
  const patientsRes = await apiClient.get(ENDPOINTS.PATIENTS.DASHBOARD);
  const own = Array.isArray(patientsRes.data) ? patientsRes.data[0] : undefined;
  if (!own?.patient_id) return { instances: [], total: 0, diseases: 0 };
  const patientId = String(own.patient_id);

  const instancesRes = await apiClient.get(ENDPOINTS.PRS.PATIENT_INSTANCES(patientId), {
    params: { assessment_stage: "main_clinical" },
  });
  type InstanceRow = { instance_id?: string; disease_id?: string; status?: string; completed_at?: string };
  const rows: InstanceRow[] = Array.isArray(instancesRes.data) ? instancesRes.data : [];

  const instances: AssessmentInstance[] = await Promise.all(
    rows.map(async (r): Promise<AssessmentInstance> => {
      const instanceId = String(r.instance_id ?? "");
      // in_progress instances have no final_result yet — /results 404s or
      // returns nothing scoreable for them, so only fetch it for completed
      // ones. Their scale_summaries end up empty, which is correct: an
      // in_progress instance genuinely has no completed scales to show.
      if (r.status !== "completed" || !instanceId) {
        return {
          instance_id: instanceId,
          disease_id: String(r.disease_id ?? ""),
          completed_at: r.completed_at,
        };
      }
      try {
        const detail = await fetchInstanceScoreDetail(instanceId);
        return {
          instance_id: instanceId,
          disease_id: detail.instance.disease_id ?? String(r.disease_id ?? ""),
          disease_name: detail.instance.disease_name,
          disease_score: detail.disease_result?.disease_score,
          severity_level: detail.disease_result?.severity_level,
          severity_label: detail.disease_result?.severity_label,
          percentage: detail.disease_result?.percentage,
          completed_at: r.completed_at,
          scale_summaries: detail.scale_results,
        };
      } catch {
        return { instance_id: instanceId, disease_id: String(r.disease_id ?? ""), completed_at: r.completed_at };
      }
    }),
  );

  const diseases = new Set(instances.map((i) => i.disease_id)).size;
  return { instances, total: instances.length, diseases };
}

export const scoresService = {
  async getMyScores(_params?: { skip?: number; limit?: number }): Promise<{ instances: AssessmentInstance[]; total: number }> {
    const { instances, total } = await composeMyScoresSummary();
    return { instances, total };
  },

  async getMyScoresSummary(): Promise<{ instances: AssessmentInstance[]; total: number; diseases: number }> {
    return composeMyScoresSummary();
  },

  async getInstanceScore(instanceId: string): Promise<InstanceScoreDetail> {
    return fetchInstanceScoreDetail(instanceId);
  },

  async getPatientScores(_patientId: string, _params?: { skip?: number; limit?: number }): Promise<{ instances: AssessmentInstance[]; total: number }> {
    return { instances: [], total: 0 };
  },

  async getPatientScoresSummary(_patientId: string): Promise<{ instances: AssessmentInstance[]; total: number; diseases: number }> {
    return { instances: [], total: 0, diseases: 0 };
  },
};
