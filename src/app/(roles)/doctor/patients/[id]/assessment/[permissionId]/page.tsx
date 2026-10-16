"use client";

import { useParams, useSearchParams } from "next/navigation";
import { DoctorPrsAssessment } from "@/components/assessment/DoctorPrsAssessment";

// The assessment itself lives in components/ so the Final Report's edit
// pop-up can run the same PRS without leaving the patient workspace.
export default function DoctorOnBehalfAssessmentPage() {
  const { id: patientId, permissionId } = useParams<{ id: string; permissionId: string }>();
  const searchParams = useSearchParams();
  // Forwarded from the visit-toggle strip on the patient page (?session=).
  return <DoctorPrsAssessment patientId={patientId} permissionId={permissionId} sessionId={searchParams.get("session")} />;
}
