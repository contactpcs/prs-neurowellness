// The doctor-authored "Treatment Plan" (goal, session/frequency targets,
// medication plan, CA instructions, free notes) plus its append-only
// finalise log. There is no backend table for this yet — a `TreatmentPlanRead`
// type exists in treatmentProtocol.types.ts but nothing calls it, and the
// SQL comment says plan_id was actually dropped from protocol_plan in
// migration 48. Until a real `treatment_plans` table + endpoints exist
// (see CLINICAL_SESSION_BACKEND_CHANGES.md), this is persisted client-side
// only, keyed by the active protocol's id — exactly like finalReportLock.ts.
// That means it does not sync across devices/browsers/staff and is lost if
// the doctor clears site data. Flagged clearly in the UI for that reason.
export type TreatmentPlanLogEntry = {
  n: number;
  status: "In effect" | "Superseded";
  at: string;
  by: string;
  assessmentLabel: string;
  lines: string[];
};

export type TreatmentPlanData = {
  status: "draft" | "set";
  setBy: string | null;
  setAt: string | null;
  goal: string;
  totalSessions: number | string;
  perWeek: number | string;
  reviewEvery: number | string;
  nextReview: string;
  medicationPlan: string;
  caInstructions: string;
  notes: string;
  log: TreatmentPlanLogEntry[];
};

const KEY_PREFIX = "treatment_plan_v1_";

export function loadTreatmentPlan(protocolId: string, defaults: TreatmentPlanData): TreatmentPlanData {
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(KEY_PREFIX + protocolId);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export function saveTreatmentPlan(protocolId: string, plan: TreatmentPlanData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY_PREFIX + protocolId, JSON.stringify(plan));
}
