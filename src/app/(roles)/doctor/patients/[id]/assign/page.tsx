"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSessions, useGoBack } from "@/lib/hooks";
import { doctorsService } from "@/lib/api/services";
import { Button, Card, CardContent, PageLoader } from "@/components/ui";
import { ConditionSelector } from "@/components/assessment";
import { Clock, ChevronLeft } from "lucide-react";
import { useAppDispatch } from "@/store/hooks";
import { invalidatePatientPermissions, fetchPatientPermissions } from "@/store/slices/permissionsSlice";
import { invalidateDoctorPatients, fetchDoctorPatients, fetchDoctorPatient } from "@/store/slices/doctorsSlice";

export default function AssignAssessmentPage() {
  const { id: patientId } = useParams<{ id: string }>();
  const router = useRouter();
  const goBack = useGoBack(`/doctor/patients/${patientId}?section=prs`);
  const dispatch = useAppDispatch();
  const { conditions, currentCondition, loadConditions, loadConditionDetail, resetConditionDetail } = useSessions();
  const [selectedCondition, setSelectedCondition] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  useEffect(() => { loadConditions(); }, [loadConditions]);

  const handleSelectCondition = (conditionId: string) => {
    setSelectedCondition(conditionId); // composite id used for session creation
    // use UUID (id field) for the detail API path to avoid slashes in composite condition_ids
    const cond = safeConditions.find((c) => c.condition_id === conditionId);
    loadConditionDetail(cond?.id ?? conditionId);
  };

  useEffect(() => {
    return () => { resetConditionDetail(); };
  }, [resetConditionDetail]);

  const safeConditions = Array.isArray(conditions) ? conditions : [];
  if (safeConditions.length === 0) return <PageLoader />;

  const handleAssign = async () => {
    if (!selectedCondition) return;
    setIsSubmitting(true);
    setAssignError(null);
    try {
      await doctorsService.grantAssessment(patientId, {
        disease_id: selectedCondition,
      });
      dispatch(invalidatePatientPermissions(patientId));
      dispatch(invalidateDoctorPatients());
      await Promise.all([
        dispatch(fetchPatientPermissions(patientId)),
        dispatch(fetchDoctorPatient(patientId)),
        dispatch(fetchDoctorPatients()),
      ]);
      router.push(`/doctor/patients/${patientId}?section=prs`);
      router.refresh();
    } catch (err) {
      console.error("Assign error:", err);
      const detail =
        (err as { response?: { data?: { error?: { message?: string }; detail?: string } } })?.response?.data;
      setAssignError(
        detail?.error?.message ?? detail?.detail ?? (err as { message?: string })?.message ?? "Failed to assign assessment.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={goBack}
          className="flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
      </div>

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
          {assignError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{assignError}</p>
          )}
          <Button size="lg" className="w-full" onClick={handleAssign} isLoading={isSubmitting}>
            Assign Assessment to Patient
          </Button>
        </>
      )}
    </div>
  );
}
