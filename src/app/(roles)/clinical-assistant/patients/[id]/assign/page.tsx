"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSessions } from "@/lib/hooks";
import { Button, Card, CardContent, PageLoader } from "@/components/ui";
import { ConditionSelector } from "@/components/assessment";
import { permissionsService } from "@/lib/api/services/permissions.service";
import { Clock, AlertCircle } from "lucide-react";

export default function CAAssignAssessmentPage() {
  const { id: patientId } = useParams<{ id: string }>();
  const router = useRouter();
  const { conditions, currentCondition, loadConditions, loadConditionDetail, resetConditionDetail } = useSessions();
  const [selectedCondition, setSelectedCondition] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadConditions(); }, [loadConditions]);

  const safeConditions = Array.isArray(conditions) ? conditions : [];

  const handleSelectCondition = (conditionId: string) => {
    setSelectedCondition(conditionId); // composite id used for session creation
    // use UUID (id field) for the detail API path to avoid slashes in composite condition_ids
    const cond = safeConditions.find((c) => c.condition_id === conditionId);
    loadConditionDetail(cond?.id ?? conditionId);
  };

  useEffect(() => {
    return () => { resetConditionDetail(); };
  }, [resetConditionDetail]);

  if (safeConditions.length === 0) return <PageLoader />;

  const handleAssign = async () => {
    if (!selectedCondition || !currentCondition?.scales?.length) return;
    setIsSubmitting(true);
    setError(null);
    try {
      // Real backend has no single "assign a condition" call — one
      // patient_scale_assignments row per scale, same as the doctor
      // portal's grant flow (permissions.service.ts). The old assignSession/
      // createSession path this used to call was a stub that always threw
      // NOT_AVAILABLE (prs.service.ts) — every Assign click here silently
      // failed with nothing shown, only a console.error.
      await permissionsService.grantPermission({
        patient_id: patientId,
        disease_id: selectedCondition,
        scale_ids: currentCondition.scales.map((s) => s.scale_id),
      });
      router.push(`/clinical-assistant/patients/${patientId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign assessment — please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-neutral-900">Assign Assessment</h1>

      <section>
        <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Select Condition</h2>
        <ConditionSelector conditions={safeConditions} selectedId={selectedCondition} onSelect={handleSelectCondition} />
      </section>

      {selectedCondition && currentCondition?.scales && currentCondition.scales.length > 0 && (
        <Card>
          <CardContent className="space-y-3">
            <h3 className="font-medium text-neutral-900">Included Scales</h3>
            <p className="text-xs text-neutral-500">
              {currentCondition.scales.length} scale{currentCondition.scales.length !== 1 ? "s" : ""} will be administered for this assessment
            </p>
            <div className="divide-y divide-neutral-100">
              {currentCondition.scales.map((scale) => (
                <div key={scale.scale_id} className="flex items-start justify-between py-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-neutral-800">{scale.full_name}</p>
                    <p className="text-xs text-neutral-500">{scale.short_name} · {scale.category}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-neutral-400 shrink-0 ml-4">
                    <Clock className="h-3.5 w-3.5" />
                    <span>~{scale.estimated_minutes} min</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {selectedCondition && (
        <>
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}
          <Button size="lg" className="w-full" onClick={handleAssign} isLoading={isSubmitting}>
            Assign Assessment to Patient
          </Button>
        </>
      )}
    </div>
  );
}
