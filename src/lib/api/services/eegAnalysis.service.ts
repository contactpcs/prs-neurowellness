import { ENDPOINTS } from "@/lib/api/endpoints";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const PREFIX = "/api/v1";

export interface AnalysisJob {
  status: "queued" | "running" | "done" | "failed";
  step: string;
  file: string;
  outputs: string[];
  uploaded_report_ids: string[];
  warnings: string[];
  error: string | null;
}

export const eegAnalysisService = {
  async submitAnalysis(params: {
    file: File;
    patient_id: string;
    session_id?: string;
    report_name: string;
  }): Promise<string> {
    const form = new FormData();
    form.append("file", params.file);
    form.append("patient_id", params.patient_id);
    form.append("report_name", params.report_name);
    if (params.session_id) form.append("session_id", params.session_id);

    const res = await fetch(`${API_BASE}${PREFIX}${ENDPOINTS.EEG.ANALYZE}`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.detail ?? `HTTP ${res.status}`);
    }
    const data = await res.json();
    return data.job_id as string;
  },

  async getStatus(jobId: string): Promise<AnalysisJob> {
    const res = await fetch(
      `${API_BASE}${PREFIX}${ENDPOINTS.EEG.ANALYSIS_STATUS(jobId)}`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
};
