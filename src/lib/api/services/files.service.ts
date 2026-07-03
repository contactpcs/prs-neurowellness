import apiClient from "../client";

export interface PatientFile {
  file_id: string;
  doc_type: "eeg" | "medical_history";
  patient_id: string;
  file_name: string;
  status: string | null;
  created_at: string;
}

export const filesService = {
  async listPatientFiles(patientId: string, docType?: "eeg" | "medical_history"): Promise<PatientFile[]> {
    const { data } = await apiClient.get(`/patients/${patientId}/files`, { params: { doc_type: docType } });
    return Array.isArray(data) ? data : [];
  },
};
