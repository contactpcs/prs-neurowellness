import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type {
  FinalReport,
  FinalReportMeta,
  FinalReportPreview,
  FinalReportScope,
  FinalReportSignPayload,
} from "@/types/finalReport.types";

// Real (SQL/v1/117) — core.final_reports. A report exists only once the
// doctor signs it and can never be edited or deleted afterwards: a
// correction is a new report, older ones stay listed.
export const finalReportsService = {
  /** Doctor only. The sections as they would be signed right now, plus the
   * clinical notes the doctor can tick. Nothing is stored. */
  async preview(patientId: string, scope: FinalReportScope): Promise<FinalReportPreview> {
    const { data } = await apiClient.get(ENDPOINTS.FINAL_REPORTS.PREVIEW(patientId), { params: { scope } });
    return data as FinalReportPreview;
  },

  /** Doctor only. Signs, freezes and releases the report to the patient. */
  async sign(patientId: string, payload: FinalReportSignPayload): Promise<FinalReport> {
    const { data } = await apiClient.post(ENDPOINTS.FINAL_REPORTS.FOR_PATIENT(patientId), payload);
    return data as FinalReport;
  },

  /** Doctor + admins. Previous reports of one patient, newest first. */
  async listForPatient(patientId: string): Promise<FinalReportMeta[]> {
    const { data } = await apiClient.get(ENDPOINTS.FINAL_REPORTS.FOR_PATIENT(patientId));
    return Array.isArray(data) ? (data as FinalReportMeta[]) : [];
  },

  /** Patient. Their own signed reports — My Results > Final Reports. */
  async listMine(params?: {
    scope?: FinalReportScope;
    date_from?: string;
    date_to?: string;
    sort?: "newest" | "oldest";
  }): Promise<FinalReportMeta[]> {
    const { data } = await apiClient.get(ENDPOINTS.FINAL_REPORTS.MINE, { params });
    return Array.isArray(data) ? (data as FinalReportMeta[]) : [];
  },

  async get(reportId: string): Promise<FinalReport> {
    const { data } = await apiClient.get(ENDPOINTS.FINAL_REPORTS.ITEM(reportId));
    return data as FinalReport;
  },
};
