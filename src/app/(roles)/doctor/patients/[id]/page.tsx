"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { PageLoader } from "@/components/ui";
import { DUMMY_PATIENTS } from "../../dashboard/page";
import conditionMap from "@/data/conditionMap.json";
import {
  prsAssessmentService,
  type PrsAssessmentQuestion,
  type PrsConditionDetails,
  type PrsQuestionOptionsResult,
} from "@/lib/api/services/prsAssessment.service";

interface PatientDetails {
  id: string;
  name: string;
  age: number;
  gender?: string;
  condition: string;
  status: "new" | "paid" | "pending" | "assessment";
  email?: string;
  phone?: string;
  lastVisit?: string;
}

interface Assessment {
  id: string;
  icon: string;
  name: string;
  status: "done" | "start" | "locked";
  statusColor?: string;
}

type PrsDisease = {
  id: string;
  name: string;
  description?: string;
  scales?: string[];
};

type QuestionWithOptions = PrsAssessmentQuestion & {
  optionsPayload?: PrsQuestionOptionsResult;
};

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [patient, setPatient] = useState<PatientDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedDiseaseId, setSelectedDiseaseId] = useState<string | null>(null);
  const [conditionDetails, setConditionDetails] = useState<PrsConditionDetails | null>(null);
  const [questions, setQuestions] = useState<QuestionWithOptions[]>([]);
  const [isPrsLoading, setIsPrsLoading] = useState(false);
  const [prsError, setPrsError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const prsDiseases: PrsDisease[] = useMemo(() => {
    const conditions = (conditionMap as any)?.conditions || {};
    return Object.entries(conditions).map(([key, value]: any) => ({
      id: String(key),
      name: String(value?.label || key),
      description: value?.description ? String(value.description) : undefined,
      scales: Array.isArray(value?.scales) ? value.scales.map((s: any) => String(s)) : undefined,
    }));
  }, []);

  useEffect(() => {
    setIsLoading(true);
    
    // Load patient from dummy data or create one
    const dummyPatient = Array.isArray(DUMMY_PATIENTS)
      ? (DUMMY_PATIENTS as any[]).find((p) => String(p?.id) === String(id))
      : (DUMMY_PATIENTS as any)?.[id];

    setPatient(
      dummyPatient
        ? { id, ...dummyPatient }
        : {
            id,
            name: "Patient",
            age: 25,
            gender: "Unknown",
            condition: "General",
            status: "new",
          }
    );

    setIsLoading(false);
  }, [id]);

  const handleSelectDisease = async (diseaseId: string) => {
    setSelectedDiseaseId(diseaseId);
    setConditionDetails(null);
    setQuestions([]);
    setPrsError(null);

    const seq = ++requestSeq.current;
    setIsPrsLoading(true);

    try {
      const details = await prsAssessmentService.getConditionDetails(diseaseId);
      if (requestSeq.current !== seq) return;
      setConditionDetails(details);

      const firstScale = Array.isArray(details?.scales) ? details.scales[0] : undefined;
      if (!firstScale?.scale_id) {
        setQuestions([]);
        return;
      }

      const start = await prsAssessmentService.startAssessment({
        scale_id: firstScale.scale_id,
        disease_id: diseaseId,
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f7f6f2] to-[#f4f0ef]">
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-full px-8 py-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            <ChevronRight className="w-6 h-6 rotate-180" />
            <span>Back</span>
          </button>

          <div className="text-sm text-neutral-500">Patient ID: {id}</div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-full px-8 py-8">
        {/* Patient info panel */}
        <div className="grid grid-cols-3 gap-5 mb-8">
          {/* Patient card */}
          <div className="col-span-2 bg-white rounded-lg shadow-md p-7 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white font-bold text-2xl border-2 border-[#f47920]">
                  {patient?.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-neutral-900">{patient?.name}</h1>
                    <span className="text-neutral-600">({patient?.id})</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-neutral-900">{patient?.age} Yrs · {patient?.gender || "Unknown"}</span>
                    {patient?.status === "new" && (
                      <span className="px-3 py-1 bg-[#f7f4fe] text-[#7343ea] text-sm font-semibold rounded-lg">New</span>
                    )}
                    {patient?.status === "paid" && (
                      <span className="px-3 py-1 bg-[#f0fbf6] text-[#06c270] text-sm font-semibold rounded-lg">Paid</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="px-5 py-3 border border-neutral-500 text-neutral-900 rounded-full hover:bg-neutral-50 transition-colors font-medium">
                  Prev. Patient
                </button>
                <button className="px-5 py-3 border border-neutral-500 text-neutral-900 rounded-full hover:bg-neutral-50 transition-colors font-medium">
                  Next Patient
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-5">
            <p className="text-neutral-600 text-sm">Condition</p>
            <p className="text-neutral-900 font-semibold text-lg">{patient?.condition || "—"}</p>
            <p className="text-neutral-600 text-sm mt-3">Status</p>
            <p className="text-neutral-900 font-semibold text-lg capitalize">{patient?.status || "—"}</p>
          </div>
        </div>

        {/* PRS (only) */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-neutral-900 mb-1">PRS</h2>
              <p className="text-neutral-600 text-sm">PRS diseases for this patient</p>
            </div>
          </div>

          {prsDiseases.length === 0 ? (
            <div className="text-neutral-600 text-sm">
              No PRS disease data yet. (Waiting for your dataset.)
            </div>
          ) : (
            <div className="space-y-3">
              {prsDiseases.map((disease) => {
                const isSelected = selectedDiseaseId === disease.id;
                return (
                  <button
                    type="button"
                    key={disease.id}
                    onClick={() => handleSelectDisease(disease.id)}
                    className={
                      "w-full text-left flex items-center justify-between border rounded-lg px-4 py-3 transition-colors " +
                      (isSelected
                        ? "border-neutral-400 bg-neutral-50"
                        : "border-neutral-200 hover:bg-neutral-50")
                    }
                  >
                    <div>
                      <div className="font-medium text-neutral-900">{disease.name}</div>
                      {disease.description ? (
                        <div className="text-sm text-neutral-600">{disease.description}</div>
                      ) : null}
                    </div>
                    <div className="text-sm text-neutral-500">View</div>
                  </button>
                );
              })}

              {prsError ? <div className="text-sm text-red-600">{prsError}</div> : null}

              {isPrsLoading ? (
                <div className="text-sm text-neutral-600">Loading PRS questions…</div>
              ) : selectedDiseaseId ? (
                <div className="pt-4">
                  <div className="text-sm text-neutral-600 mb-3">
                    {conditionDetails?.scales?.length
                      ? `Loaded ${conditionDetails.scales.length} scale(s). Showing questions for the first scale.`
                      : "No scales found for this disease."}
                  </div>

                  {questions.length ? (
                    <div className="space-y-3">
                      {questions.map((q) => (
                        <div
                          key={q.question_id}
                          className="border border-neutral-200 rounded-lg px-4 py-3"
                        >
                          <div className="font-medium text-neutral-900">
                            {typeof q.question_index === "number" ? q.question_index + 1 : ""}. {q.question_text}
                          </div>
                          <div className="text-xs text-neutral-500 mt-1">Type: {q.answer_type}</div>

                          {q.optionsPayload?.options?.length ? (
                            <div className="mt-2 space-y-1">
                              {q.optionsPayload.options
                                .slice()
                                .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
                                .map((opt) => (
                                  <div key={opt.option_id} className="text-sm text-neutral-700">
                                    {opt.label}
                                  </div>
                                ))}
                            </div>
                          ) : (q.optionsPayload?.answer_type === "number" || q.optionsPayload?.answer_type === "slider") ? (
                            <div className="mt-2 text-sm text-neutral-700">
                              Range: {q.optionsPayload.min} - {q.optionsPayload.max}
                            </div>
                          ) : (
                            <div className="mt-2 text-sm text-neutral-600">Options not available.</div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
