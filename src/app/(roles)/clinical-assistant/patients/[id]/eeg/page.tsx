"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { EEGReportList, EEGUploadForm } from "@/components/eeg";
import { useGoBack } from "@/lib/hooks";

export default function ClinicalAssistantPatientEEGPage() {
  const { id: patientId } = useParams<{ id: string }>();
  const goBack = useGoBack(`/clinical-assistant/patients/${patientId}`);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showUpload, setShowUpload] = useState(false);

  function handleUploaded() {
    setRefreshKey((k) => k + 1);
    setShowUpload(false);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={goBack}
            className="text-sm text-blue-600 hover:underline"
          >
            &larr; Back
          </button>
          <h1 className="text-2xl font-bold text-neutral-900 mt-1">EEG Reports</h1>
          <p className="text-sm text-neutral-500">Brain mapping and analysis reports</p>
        </div>
        <button
          onClick={() => setShowUpload((v) => !v)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          {showUpload ? "Cancel" : "Upload Report"}
        </button>
      </div>

      {/* Upload form */}
      {showUpload && (
        <EEGUploadForm
          patientId={patientId}
          onUploaded={handleUploaded}
        />
      )}

      {/* Report list (clinical assistants can delete too) */}
      <EEGReportList
        patientId={patientId}
        canDelete={true}
        refreshTrigger={refreshKey}
      />
    </div>
  );
}
