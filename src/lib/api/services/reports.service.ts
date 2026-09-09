import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { PatientsOverviewResponse } from "@/types/reports.types";

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
};
