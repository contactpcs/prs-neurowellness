import apiClient, { getDiseaseCatalog, getMyPatientId } from "../client";
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
export async function fetchInstanceScoreDetail(instanceId: string, _patientId?: string): Promise<InstanceScoreDetail> {
  // /results now carries the instance row and the current as-of disease
  // composite (backend F-014) — one call instead of three. _patientId is no
  // longer needed (kept so existing callers compile unchanged).
  const [resultsRes, diseasesRes] = await Promise.all([
    apiClient.get(ENDPOINTS.PRS.INSTANCE_SCORE(instanceId)),
    getDiseaseCatalog().catch(() => ({ data: [] })),
  ]);

  const raw = resultsRes.data as {
    scale_results?: Record<string, unknown>[];
    final_result?: Record<string, unknown> | null;
    instance?: Record<string, unknown> | null;
    disease_composite?: { calculated_value?: number | null; severity_level?: string | null; severity_label?: string | null } | null;
  };
  const inst = (raw.instance ?? {}) as Record<string, unknown>;
  const diseases: { disease_id?: string; disease_name?: string }[] = Array.isArray(diseasesRes.data) ? diseasesRes.data : [];

  const final = raw.final_result ?? null;
  const summaries = parseJsonField<{ scale_code?: string; scale_name?: string }[]>(final?.scale_summaries, []);
  const nameByCode = new Map(summaries.map((s) => [s.scale_code, s.scale_name]));

  const instDiseaseId = inst.disease_id != null ? String(inst.disease_id) : undefined;
  const composite = raw.disease_composite ?? null;

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
  const patientId = await getMyPatientId();
  if (!patientId) return { instances: [], total: 0, diseases: 0 };
  return composePatientScoresSummary(patientId, "main_clinical");
}

/** Same summary for an explicit patients.patient_id (doctor/CA views).
 * assessment_stage omitted → every stage. One call: the backend composes
 * what this used to build from /prs-instances plus 4 calls per completed
 * instance (/results, instance, disease catalog, disease-composite) — API
 * audit fix F-002. Score fields are the current as-of disease composite,
 * same values as before; in_progress instances carry no scores. */
async function composePatientScoresSummary(
  patientId: string,
  assessmentStage?: string,
): Promise<{ instances: AssessmentInstance[]; total: number; diseases: number }> {
  const { data } = await apiClient.get(ENDPOINTS.PRS.PATIENT_SCORES_SUMMARY(patientId), {
    params: assessmentStage ? { assessment_stage: assessmentStage } : undefined,
  });
  const orUndef = <T,>(v: T | null | undefined): T | undefined => (v ?? undefined);
  const rows: Record<string, any>[] = Array.isArray(data?.instances) ? data.instances : [];
  const instances: AssessmentInstance[] = rows.map((r) => ({
    instance_id: String(r.instance_id ?? ""),
    disease_id: String(r.disease_id ?? ""),
    disease_name: orUndef(r.disease_name),
    disease_score: orUndef(r.disease_score),
    severity_level: orUndef(r.severity_level),
    severity_label: orUndef(r.severity_label),
    percentage: orUndef(r.percentage),
    completed_at: orUndef(r.completed_at),
    scale_summaries: r.status === "completed" ? (r.scale_summaries ?? []) : undefined,
    appointment_id: r.appointment_id,
  }));
  return { instances, total: instances.length, diseases: Number(data?.diseases ?? 0) };
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

  async getPatientScoresSummary(patientId: string): Promise<{ instances: AssessmentInstance[]; total: number; diseases: number }> {
    return composePatientScoresSummary(patientId);
  },
};
