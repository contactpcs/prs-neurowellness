"use client";

import { useParams, useSearchParams } from "next/navigation";
import { TreatmentProtocolWizard } from "@/components/doctor/TreatmentProtocolWizard";

// The wizard itself lives in components/ so the Final Report's edit pop-up
// can run the same steps without leaving the patient workspace.
export default function TreatmentProtocolWizardPage() {
  const { id: patientId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  return (
    <TreatmentProtocolWizard
      patientId={patientId}
      mode={searchParams.get("mode") === "modify" ? "modify" : "new"}
      priorProtocolId={searchParams.get("protocolId")}
    />
  );
}
