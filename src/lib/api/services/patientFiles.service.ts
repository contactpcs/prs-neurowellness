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
  /** scanning (malware scan running) | unverified (scan passed, not yet
   * confirmed by a clinician) | verified | rejected (failed the scan).
   * Only unverified and verified files can be downloaded. */
  status: string | null;
}

interface PresignedUpload {
  s3_key: string;
  upload_url: string;
  upload_fields?: Record<string, string> | null;
}

/** Sends the bytes where presign-upload said to. Real S3: a multipart POST
 * of upload_fields + the file straight to the bucket. S3 enforces the size
 * limit and content type signed into those fields, and ignores every field
 * after the file, so the file goes last. It must be a bare axios call:
 * apiClient attaches this app's bearer token, and S3 rejects a presigned
 * request that also carries an Authorization header. Local dev (no
 * upload_fields): PUT to our own backend, which does need the token. */
export async function sendFile(presign: PresignedUpload, file: File, contentType: string): Promise<void> {
  if (presign.upload_fields) {
    const form = new FormData();
    Object.entries(presign.upload_fields).forEach(([name, value]) => form.append(name, value));
    form.append("file", file);
    await axios.post(presign.upload_url, form);
  } else {
    await apiClient.put(`/files/upload/${presign.s3_key}`, file, { headers: { "Content-Type": contentType } });
  }
}

function mapFile(f: Record<string, unknown>): PatientFile {
  return {
    file_id: String(f.file_id ?? ""),
    file_name: String(f.file_name ?? ""),
    file_size: (f.file_size as number) ?? null,
    document_type: (f.document_type as string) ?? null,
    description: (f.description as string) ?? null,
    created_at: String(f.created_at ?? ""),
    status: (f.status as string) ?? null,
  };
}

/** Medical history documents, uploaded by staff or by the patient.
 *
 * Staff: presign -> upload -> confirm, the same flow eeg.service.ts uses.
 * Patient: presign -> upload, and that is all. The backend creates the file
 * row at the presign step (status "scanning") and returns it as `file`; the
 * bytes go to a quarantine bucket, and a malware scan (about a minute) moves
 * the row to "unverified" or "rejected". The backend picks the flow from the
 * caller's role, so this code only checks whether `file` came back. */
export const patientFilesService = {
  async upload(patientId: string, clinicId: string, file: File, documentType?: string): Promise<PatientFile> {
    const contentType = file.type || "application/octet-stream";
    const presign = await apiClient.post(`/patients/${patientId}/files/presign-upload`, {
      doc_type: "medical_history",
      file_name: file.name,
      clinic_id: clinicId,
      content_type: contentType,
      document_type: documentType || "other",
    });
    await sendFile(presign.data, file, contentType);
    if (presign.data.file) return mapFile(presign.data.file);
    const confirm = await apiClient.post(`/patients/${patientId}/files`, {
      doc_type: "medical_history",
      s3_key: presign.data.s3_key,
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

  /** Clinician (doctor / clinical assistant) confirms a patient-uploaded
   * file after opening it: unverified -> verified. */
  async verify(fileId: string): Promise<PatientFile> {
    const res = await apiClient.patch(`/files/medical_history/${fileId}/verify`);
    return mapFile(res.data);
  },
};
