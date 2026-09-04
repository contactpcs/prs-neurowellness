"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks";
import { PageLoader } from "@/components/ui";
import { ROUTES } from "@/lib/constants";

const AnamnesisForm = dynamic(
  () => import("@/components/assessment/AnamnesisForm").then((m) => ({ default: m.AnamnesisForm })),
  { loading: () => <PageLoader />, ssr: false },
);

export default function SelfRegistrationAnamnesisPage() {
  const { user, isRestoring } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isRestoring) return;
    if (!user) { router.replace(ROUTES.LOGIN); return; }
    // Both self- and staff-registered patients go through this same wizard
    // (gated on registration_status, not self_registered) — only
    // requirement is being a patient with a resolved patient_id.
    if (!user.roles.includes("patient") || !user.patient_id) { router.replace(ROUTES.LOGIN); return; }
  }, [isRestoring, user, router]);

  if (isRestoring || !user) return <PageLoader />;

  return (
    <div className="min-h-screen bg-neutral-50 py-8 px-6">
      <div className="max-w-3xl mx-auto space-y-2">
        <div className="mb-2">
          <h1 className="text-xl font-bold text-neutral-900">Medical History Intake</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Step 2 of 3 — please complete this before your assessment. It's submitted once and can't be edited after submission.
          </p>
        </div>
        <AnamnesisForm
          patientId={user.patient_id!}
          mode="patient"
          assessmentStage="registration"
          onSubmitted={() => router.push("/patient-registration/assessment")}
        />
      </div>
    </div>
  );
}
