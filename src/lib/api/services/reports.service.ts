import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type {
  DiseasesOverviewResponse,
  PatientsOverviewResponse,
  ProtocolOutcomesResponse,
  ScaleTrajectoriesResponse,
  WeeklyTrendResponse,
} from "@/types/reports.types";

export const reportsService = {
  /** GET /reports/doctor/patients-overview?disease_id= — the doctor
   * analytics dashboard's KPI row + patient table, scoped server-side to
   * the calling doctor's own assigned patients (app/modules/reports). */
  async getDoctorPatientsOverview(diseaseId: string): Promise<PatientsOverviewResponse> {
    const { data } = await apiClient.get(ENDPOINTS.DOCTORS.PATIENTS_OVERVIEW, {
      params: { disease_id: diseaseId },
    });
    return data as PatientsOverviewResponse;
  },

  /** GET /reports/doctor/diseases-overview — the all-diseases cohort
   * landing view (every condition this doctor has patients tracked for,
   * with improving/stable/worsening counts per disease). */
  async getDoctorDiseasesOverview(): Promise<DiseasesOverviewResponse> {
    const { data } = await apiClient.get(ENDPOINTS.DOCTORS.DISEASES_OVERVIEW);
    return data as DiseasesOverviewResponse;
  },

  /** GET /reports/doctor/patients/{id}/scale-trajectories?disease_id= — the
   * per-scale history line-chart data for one patient (Section 5.4). */
  async getPatientScaleTrajectories(patientId: string, diseaseId: string): Promise<ScaleTrajectoriesResponse> {
    const { data } = await apiClient.get(ENDPOINTS.DOCTORS.SCALE_TRAJECTORIES(patientId), {
      params: { disease_id: diseaseId },
    });
    return data as ScaleTrajectoriesResponse;
  },

  /** GET /reports/doctor/weekly-trend?disease_id=&weeks= — the weekly
   * composite trend table, one row per patient (Section 5.7). */
  async getDoctorWeeklyTrend(diseaseId: string, weeks: number): Promise<WeeklyTrendResponse> {
    const { data } = await apiClient.get(ENDPOINTS.DOCTORS.WEEKLY_TREND, {
      params: { disease_id: diseaseId, weeks },
    });
    return data as WeeklyTrendResponse;
  },

  /** GET /reports/doctor/protocol-outcomes?disease_id= — Treatment Protocol
   * Outcomes + Protocol vs. Scale Outcomes heatmap (Sections 5.5/5.6). */
  async getDoctorProtocolOutcomes(diseaseId: string): Promise<ProtocolOutcomesResponse> {
    const { data } = await apiClient.get(ENDPOINTS.DOCTORS.PROTOCOL_OUTCOMES, {
      params: { disease_id: diseaseId },
    });
    return data as ProtocolOutcomesResponse;
  },
};
