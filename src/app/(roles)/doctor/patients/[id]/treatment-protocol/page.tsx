"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TreatmentProtocolPanel } from "@/components/doctor/TreatmentProtocolPanel";

export default function TreatmentProtocolPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  return (
    <div className="space-y-5 max-w-5xl">
      <button
        onClick={() => router.push(`/doctor/patients/${id}?section=treatment-protocol`)}
        className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to patient
      </button>
      <TreatmentProtocolPanel patientId={id} />
    </div>
  );
}
