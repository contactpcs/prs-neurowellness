"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { PageLoader, Button } from "@/components/ui";
import { doctorsService } from "@/lib/api/services/doctors.service";
import { prsService } from "@/lib/api/services/prs.service";
import { prsAssessmentService } from "@/lib/api/services/prsAssessment.service";
import type { PatientDetail } from "@/types/domain.types";
import type { ConditionBattery } from "@/types/prs.types";
import type { PrsAssessmentQuestion, PrsQuestionOptionsResult } from "@/lib/api/services/prsAssessment.service";

type QuestionWithOptions = PrsAssessmentQuestion & {
  optionsPayload?: PrsQuestionOptionsResult;
};

function extractConditionsFromResponse(payload: unknown): ConditionBattery[] {
  if (Array.isArray(payload)) return payload as ConditionBattery[];
  if (payload && typeof payload === "object" && "conditions" in payload) {
    const conds = (payload as { conditions?: unknown }).conditions;
    return Array.isArray(conds) ? (conds as ConditionBattery[]) : [];
  }
  return [];
}

function getScaleCount(cond: ConditionBattery): number {
  const scaleIds = (cond as unknown as { scale_ids?: unknown }).scale_ids;
  return Array.isArray(scaleIds) ? scaleIds.length : 0;
}

export default function DoctorPatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [conditions, setConditions] = useState<ConditionBattery[]>([]);
  const [selectedDiseaseId, setSelectedDiseaseId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuestionWithOptions[]>([]);
  const [isPrsLoading, setIsPrsLoading] = useState(false);
  const [prsError, setPrsError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  // Load patient detail and conditions in parallel
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [patientData, conditionsResponse] = await Promise.all([
          doctorsService.getPatient(id),
          prsService.getConditions(),
        ]);

        if (cancelled) return;

        const safeConditions = extractConditionsFromResponse(conditionsResponse);

        setPatient(patientData);
        setConditions(safeConditions);
      } catch {
        if (cancelled) return;
        setPatient(null);
        setConditions([]);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleSelectDisease = async (conditionId: string) => {
    setSelectedDiseaseId(conditionId);
    setQuestions([]);
    setPrsError(null);

    const seq = ++requestSeq.current;
    setIsPrsLoading(true);

    // Use the UUID (id field) for the API path to avoid slashes in composite condition_ids
    const conditionObj = conditions.find((c) => c.condition_id === conditionId);
    const conditionUuid = conditionObj?.id ?? conditionId;

    try {
      const details = await prsAssessmentService.getConditionDetails(conditionUuid);
      if (requestSeq.current !== seq) return;

      const firstScale = Array.isArray(details?.scales) ? details.scales[0] : undefined;
      if (!firstScale?.scale_id) {
        setQuestions([]);
        return;
      }

      const start = await prsAssessmentService.startAssessment({
        scale_id: firstScale.scale_id,
        disease_id: conditionUuid,
        taken_by: "doctor_on_behalf",
        patient_id: String(id),
      });

      if (requestSeq.current !== seq) return;
      const baseQuestions = start?.scale?.questions || [];

      const withOptions = await Promise.all(
        baseQuestions.map(async (q) => {
          try {
            const optionsPayload = await prsAssessmentService.getQuestionOptions(q.question_id);
            return { ...q, optionsPayload };
          } catch {
            return { ...q };
          }
        })
      );

      if (requestSeq.current !== seq) return;
      setQuestions(withOptions);
    } catch (e: any) {
      if (requestSeq.current !== seq) return;
      const msg =
        e?.response?.data?.message || e?.response?.data?.detail || e?.message || "Failed to load PRS assessment";
      setPrsError(String(msg));
    } finally {
      if (requestSeq.current === seq) setIsPrsLoading(false);
    }
  };

  if (isLoading) return <PageLoader />;

  const fullName = patient ? `${patient.first_name} ${patient.last_name}` : "Patient";
  const age = patient?.date_of_birth
    ? new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()
    : null;

  const safeConditions = Array.isArray(conditions) ? conditions : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f7f6f2] to-[#f4f0ef]">
      {/* Sub-header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-full px-8 py-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            <ChevronRight className="w-6 h-6 rotate-180" />
            <span>Back</span>
          </button>
          <Link href={`/doctor/patients/${id}/assign`}>
            <Button size="sm">
              <Plus className="h-4 w-4" /> Assign Assessment
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-full px-8 py-8">
        {/* Patient info */}
        <div className="grid grid-cols-3 gap-5 mb-8">
          <div className="col-span-2 bg-white rounded-lg shadow-md p-7">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white font-bold text-2xl border-2 border-[#f47920]">
                {patient?.first_name?.[0]?.toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-neutral-900">{fullName}</h1>
                  {patient?.mrn && <span className="text-neutral-500 text-sm">MRN: {patient.mrn}</span>}
                </div>
                <div className="flex items-center gap-3 mt-2 text-neutral-600 text-sm">
                  {age && <span>{age} Yrs</span>}
                  {patient?.gender && <span className="capitalize">{patient.gender}</span>}
                  {patient?.email && <span>{patient.email}</span>}
                  {patient?.phone && <span>{patient.phone}</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-5 space-y-4">
            {patient?.condition && (
              <div>
                <p className="text-neutral-500 text-sm">Condition</p>
                <p className="text-neutral-900 font-semibold">{patient.condition}</p>
              </div>
            )}
            {patient?.status && (
              <div>
                <p className="text-neutral-500 text-sm">Status</p>
                <p className="text-neutral-900 font-semibold capitalize">{patient.status}</p>
              </div>
            )}
          </div>
        </div>

        {/* PRS Section */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-neutral-900 mb-1">PRS Assessment</h2>
            <p className="text-neutral-500 text-sm">Select a condition to view its questions</p>
          </div>

          {safeConditions.length === 0 ? (
            <p className="text-neutral-500 text-sm">No conditions available.</p>
          ) : (
            <div className="space-y-3">
              {safeConditions.map((cond) => {
                const isSelected = selectedDiseaseId === cond.condition_id;
                const scaleCount = getScaleCount(cond);
                return (
                  <button
                    type="button"
                    key={cond.condition_id}
                    onClick={() => handleSelectDisease(cond.condition_id)}
                    className={
                      "w-full text-left flex items-center justify-between border rounded-lg px-4 py-3 transition-colors " +
                      (isSelected
                        ? "border-primary-400 bg-primary-50"
                        : "border-neutral-200 hover:bg-neutral-50")
                    }
                  >
                    <div>
                      <div className="font-medium text-neutral-900">{cond.label}</div>
                      {cond.description && (
                        <div className="text-sm text-neutral-500">{cond.description}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-neutral-400">
                      <span>{scaleCount} scale{scaleCount !== 1 ? "s" : ""}</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </button>
                );
              })}

              {prsError && <div className="text-sm text-red-600 mt-2">{prsError}</div>}

              {isPrsLoading && (
                <div className="text-sm text-neutral-500 mt-4">Loading questions…</div>
              )}

              {!isPrsLoading && selectedDiseaseId && questions.length > 0 && (
                <div className="pt-4 space-y-3">
                  <p className="text-sm font-medium text-neutral-700">
                    {questions.length} question{questions.length !== 1 ? "s" : ""} found
                  </p>
                  {questions.map((q) => (
                    <div
                      key={q.question_id}
                      className="border border-neutral-200 rounded-lg px-4 py-3"
                    >
                      <div className="font-medium text-neutral-900">
                        {typeof q.question_index === "number" ? q.question_index + 1 : ""}. {q.question_text}
                      </div>
                      <div className="text-xs text-neutral-400 mt-0.5">Type: {q.answer_type}</div>

                      {q.optionsPayload?.options?.length ? (
                        <div className="mt-2 space-y-1">
                          {q.optionsPayload.options
                            .slice()
                            .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
                            .map((opt) => (
                              <div key={opt.option_id} className="text-sm text-neutral-600">
                                • {opt.label}
                              </div>
                            ))}
                        </div>
                      ) : (q.optionsPayload?.answer_type === "number" || q.optionsPayload?.answer_type === "slider") ? (
                        <div className="mt-2 text-sm text-neutral-600">
                          Range: {q.optionsPayload.min} – {q.optionsPayload.max}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              {!isPrsLoading && selectedDiseaseId && !prsError && questions.length === 0 && (
                <div className="text-sm text-neutral-500 pt-2">No questions found for this condition.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
