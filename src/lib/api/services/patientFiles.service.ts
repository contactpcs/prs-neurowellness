import axios from "axios";
import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";

export interface PatientFile {
  file_id: string;
  file_name: string;
  file_size: number | null;
  document_type: string | null;
  description: string | null;
  created_at: string;
}

function mapFile(f: Record<string, unknown>): PatientFile {
  return {
    file_id: String(f.file_id ?? ""),
    file_name: String(f.file_name ?? ""),
    file_size: (f.file_size as number) ?? null,
    document_type: (f.document_type as string) ?? null,
    description: (f.description as string) ?? null,
    created_at: String(f.created_at ?? ""),
  };
}

/** Patient self-service uploads of their own past medical records — same
 * presign -> PUT -> confirm flow eeg.service.ts uses for staff-uploaded
 * EEG reports, scoped to doc_type "medical_history" (the only one a
 * patient is allowed to create, enforced server-side too). */
export const patientFilesService = {
  async upload(patientId: string, clinicId: string, file: File, documentType?: string): Promise<PatientFile> {
    const contentType = file.type || "application/octet-stream";
    const presign = await apiClient.post(`/patients/${patientId}/files/presign-upload`, {
      doc_type: "medical_history",
      file_name: file.name,
      clinic_id: clinicId,
      content_type: contentType,
    });
    const { s3_key, upload_url } = presign.data;
    // Presigned S3 URLs must be hit with a bare client — apiClient's
    // interceptor attaches this app's Cognito bearer token to every
    // request, and an Authorization header on a sigv4 presigned PUT
    // conflicts with the query-string signature (S3 rejects the whole
    // request with SignatureDoesNotMatch). The local-dev fallback path
    // IS our own backend and does need that token, so it still goes
    // through apiClient.
    if (upload_url) {
      await axios.put(upload_url, file, { headers: { "Content-Type": contentType } });
    } else {
      await apiClient.put(`/files/upload/${s3_key}`, file, { headers: { "Content-Type": contentType } });
    }
    const confirm = await apiClient.post(`/patients/${patientId}/files`, {
      doc_type: "medical_history",
      s3_key,
      file_name: file.name,
      clinic_id: clinicId,
      document_type: documentType || "other",
    });
    return mapFile(confirm.data);
  },

  async list(patientId: string): Promise<PatientFile[]> {
    const res = await apiClient.get(ENDPOINTS.EEG.PATIENT_REPORTS(patientId), { params: { doc_type: "medical_history" } });
    const raw: Record<string, unknown>[] = Array.isArray(res.data) ? res.data : [];
    return raw.map(mapFile);
  },

  async downloadUrl(fileId: string): Promise<string> {
    const res = await apiClient.get(`/files/medical_history/${fileId}/download-url`);
    return res.data.download_url;
  },
};
