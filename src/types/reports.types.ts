// Mirrors backend-v2's app/modules/reports/schemas.py — the doctor
// analytics dashboard's endpoints. See Documents/Anava_Doctor_Portal_
// Analytics_Dashboard_Backend_Design_v1.docx for the full data design.

export interface VisitScore {
  composite_id: string;
  date: string | null;
  score: number;
  severity_level: string | null;
  severity_label: string | null;
  is_provisional: boolean;
}

export type Trend = "improving" | "stable" | "worsening" | "insufficient_data";

export interface PatientOverviewRow {
  patient_id: string;
  name: string;
  first_assessment_date: string | null;
  assessment_count: number;
  overall_change: number | null;
  trend: Trend;
  visits: VisitScore[];
}

export interface DashboardKPIs {
  patients: number;
  improving: number;
  stable: number;
  worsening: number;
  insufficient_data: number;
  avg_assessments: number;
  avg_score_change: number | null;
  responders_pct: number | null;
  remitters_pct: number;
  provisional_pct: number;
}

export interface PatientsOverviewResponse {
  kpis: DashboardKPIs;
  patients: PatientOverviewRow[];
}

export interface DiseaseOverviewRow {
  disease_id: string;
  disease_name: string;
  total: number;
  improving: number;
  stable: number;
  worsening: number;
  insufficient_data: number;
}

export interface DiseasesOverviewResponse {
  diseases: DiseaseOverviewRow[];
}

export interface ScaleTrajectoryPoint {
  date: string | null;
  score: number;
  severity_level: string | null;
  severity_label: string | null;
}

export interface ScaleTrajectory {
  scale_code: string;
  scale_name: string;
  points: ScaleTrajectoryPoint[];
}

export interface ScaleTrajectoriesResponse {
  scales: ScaleTrajectory[];
}

export interface WeeklyTrendPatientRow {
  patient_id: string;
  name: string;
  scores: (number | null)[];
}

export interface WeeklyTrendResponse {
  weeks: string[];
  patients: WeeklyTrendPatientRow[];
}

export interface ProtocolOutcomeRow {
  protocol_label: string;
  total: number;
  improving: number;
  stable: number;
  worsening: number;
  insufficient_data: number;
}

export interface ProtocolScaleHeatmapCell {
  protocol_label: string;
  scale_code: string;
  scale_name: string;
  avg_change: number;
  n: number;
}

export interface ProtocolOutcomesResponse {
  protocols: ProtocolOutcomeRow[];
  heatmap: ProtocolScaleHeatmapCell[];
}
