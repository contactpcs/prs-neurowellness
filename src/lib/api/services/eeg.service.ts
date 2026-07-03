import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { EEGReport, EEGReportListResponse, UploadEEGReportPayload } from "@/types/eeg.types";

/** FileRead (real backend) has file_id/file_name/file_size/checksum/status —
 * no session_id/report_type/sha256_checksum/version/deleted_at/updated_at.
 * Filled with the closest real field or a safe default. */
function mapFile(f: Record<string, unknown>): EEGReport {
  return {
    id: String(f.file_id ?? ""),
    patient_id: String(f.patient_id ?? ""),
    session_id: null,
    report_name: String(f.file_name ?? ""),
    file_size_bytes: Number(f.file_size ?? 0),
    report_type: "eeg",
    sha256_checksum: String(f.checksum ?? ""),
    version: 1,
    status: (f.status as EEGReport["status"]) ?? "COMPLETED",
    deleted_at: null,
    created_at: String(f.created_at ?? ""),
    updated_at: String(f.created_at ?? ""),
  };
}

export const eegService = {
  /** Real backend has no single-call multipart upload — it's a 3-step
   * presign -> PUT raw bytes -> confirm flow, and presign needs a clinic_id
   * the old payload never carried (resolved here via the patient's own record). */
  async uploadReport(payload: UploadEEGReportPayload): Promise<EEGReport> {
    const patientRes = await apiClient.get(ENDPOINTS.DOCTORS.PATIENT(payload.patient_id));
    const clinicId = patientRes.data?.primary_clinic_id;
    if (!clinicId) throw new Error("Could not resolve the patient's clinic to upload a file.");

    const presign = await apiClient.post(`/patients/${payload.patient_id}/files/presign-upload`, {
      doc_type: "eeg",
      file_name: payload.report_name,
      clinic_id: clinicId,
    });
    const { s3_key, upload_url } = presign.data;
    await apiClient.put(upload_url ?? `/files/upload/${s3_key}`, payload.file, {
      headers: { "Content-Type": "application/octet-stream" },
    });
    const confirm = await apiClient.post(`/patients/${payload.patient_id}/files`, {
      doc_type: "eeg",
      s3_key,
      file_name: payload.report_name,
      clinic_id: clinicId,
    });
    return mapFile(confirm.data);
  },

  // NOT AVAILABLE — no get-file-by-id-only endpoint (only list-by-patient + download-url).
  async getReport(_reportId: string): Promise<never> {
    throw new Error("Fetching a single report by id isn't available yet — list by patient instead.");
  },

  async getPatientReports(patientId: string, skip = 0, limit = 20): Promise<EEGReportListResponse> {
    const res = await apiClient.get(ENDPOINTS.EEG.PATIENT_REPORTS(patientId), { params: { doc_type: "eeg" } });
    const raw: Record<string, unknown>[] = Array.isArray(res.data) ? res.data : [];
    const data = raw.map(mapFile);
    return {
      success: true,
      message: "",
      data,
      meta: { total: data.length, skip, limit, has_more: false },
    };
  },

  async downloadReport(reportId: string, filename = "eeg_report.pdf"): Promise<void> {
    const res = await apiClient.get(ENDPOINTS.EEG.DOWNLOAD(reportId));
    const presignedUrl: string = res.data.download_url;
    const a = document.createElement("a");
    a.href = presignedUrl;
    a.download = filename;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },

  // NOT AVAILABLE — no delete endpoint on the files module.
  async deleteReport(_reportId: string): Promise<never> {
    throw new Error("File deletion isn't available yet.");
  },
};
