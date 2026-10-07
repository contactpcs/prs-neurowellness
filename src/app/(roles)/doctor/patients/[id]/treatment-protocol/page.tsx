"use client";

import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TreatmentProtocolPanel } from "@/components/doctor/TreatmentProtocolPanel";
import { PatientClinicalSnapshot } from "@/components/doctor/PatientClinicalSnapshot";
import { useGoBack } from "@/lib/hooks";

export default function TreatmentProtocolPage() {
  const { id } = useParams<{ id: string }>();
  const goBack = useGoBack(`/doctor/patients/${id}?section=treatment-protocol`);

  return (
    <div className="space-y-5 max-w-5xl">
      <button
        onClick={goBack}
        className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <PatientClinicalSnapshot patientId={id} />
      <TreatmentProtocolPanel patientId={id} />
    </div>
  );
}