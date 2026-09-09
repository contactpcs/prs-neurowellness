// Mirrors backend-v2's app/modules/reports/schemas.py — the doctor
// analytics dashboard's patient-list-with-scores endpoint.

export interface VisitScore {
  instance_id: string;
  date: string | null;
  score: number;
  severity_level: string | null;
  severity_label: string | null;
}

export interface PatientOverviewRow {
  patient_id: string;
  name: string;
  first_assessment_date: string | null;
  assessment_count: number;
  overall_change: number | null;
  visits: VisitScore[];
}

export interface DashboardKPIs {
  patients: number;
  avg_assessments: number;
  avg_score_change: number | null;
  responders_pct: number | null;
  remitters_pct: number;
}

export interface PatientsOverviewResponse {
  kpis: DashboardKPIs;
  patients: PatientOverviewRow[];
}
