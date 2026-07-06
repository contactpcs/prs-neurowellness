"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brain } from "lucide-react";
import { useAuth } from "@/lib/hooks";
import { Button } from "@/components/ui";
import { ROUTES } from "@/lib/constants";
import { ConditionSelector } from "@/components/assessment/ConditionSelector";
import { prsService } from "@/lib/api/services/prs.service";
import { patientsService } from "@/lib/api/services/patients.service";
import type { ConditionBattery } from "@/types/prs.types";

export default function DiseaseSelectionPage() {
  const { user, isRestoring, logout } = useAuth();
  const router = useRouter();

  const [conditions, setConditions] = useState<ConditionBattery[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isRestoring) return;
    if (!user) { router.replace(ROUTES.LOGIN); return; }
    // Both self- and staff-registered patients go through this same wizard
    // (gated on registration_status, not self_registered) — only
    // requirement is being a patient with a resolved patient_id.
    if (!user.roles.includes("patient") || !user.patient_id) { router.replace(ROUTES.LOGIN); return; }

    prsService.getConditions()
      .then((res) => setConditions(res.conditions))
      .catch(() => setError("Could not load conditions. Try refreshing."))
      .finally(() => setLoading(false));
  }, [isRestoring, user, router]);

  async function handleContinue() {
    if (!selectedId || !user?.patient_id) return;
    setSubmitting(true);
    setError(null);
    try {
      await patientsService.selectDisease(user.patient_id, selectedId);
      // Cached client-side only so the PRS step (later in the wizard) knows
      // which disease to start an assessment instance for — the server's
      // own record of the selection is what actually matters for
      // registration_status; this is just a UX convenience.
      localStorage.setItem("pcs_registration_disease_id", selectedId);
      router.push("/consent");
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.detail || "Failed to save your selection.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isRestoring || loading) {
    return <div className="min-h-screen flex items-center justify-center text-neutral-400 text-sm">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-card border border-neutral-200/80 p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-lg bg-brand-gradient flex items-center justify-center">
            <Brain className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-accent-dark">Anava PRS</span>
        </div>

        <h1 className="text-lg font-bold text-neutral-900 mb-1">What brings you in?</h1>
        <p className="text-sm text-neutral-500 mb-6">
          Step 1 of 3 — select the condition closest to what you'd like help with. If you're not sure, pick the closest match; your doctor will confirm at your first visit.
        </p>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>}

        {conditions.length === 0 ? (
          <p className="text-sm text-neutral-400">No conditions available right now — please contact your clinic.</p>
        ) : (
          <ConditionSelector conditions={conditions} selectedId={selectedId} onSelect={setSelectedId} />
        )}

        <div className="flex justify-between items-center mt-6">
          <button onClick={logout} className="text-xs text-neutral-400 hover:text-neutral-600">Log out</button>
          <Button disabled={!selectedId || submitting} onClick={handleContinue}>
            {submitting ? "Saving…" : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
