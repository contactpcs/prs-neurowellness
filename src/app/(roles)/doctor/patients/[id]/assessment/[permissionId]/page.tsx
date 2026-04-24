"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Send, UserCheck, Mic, MicOff, RotateCcw } from "lucide-react";
import { AssessmentSkeleton, Button, ProgressBar } from "@/components/ui";
import { QuestionRenderer } from "@/components/questionnaire/QuestionRenderer";
import { ProgressSidebar } from "@/components/questionnaire/ProgressSidebar";
import { STTBar } from "@/components/questionnaire/STTBar";
import { useAssessmentSTT } from "@/lib/hooks/useAssessmentSTT";
import { permissionsService } from "@/lib/api/services/permissions.service";
import { prsAssessmentService } from "@/lib/api/services/prsAssessment.service";
import type { ScaleQuestion, QuestionOption } from "@/types/prs.types";
import type { PrsAssessmentQuestion, PrsAssessmentScaleResult } from "@/lib/api/services/prsAssessment.service";

// ─── Type helpers ───────────────────────────────────────────────────────────

type LoadedScale = {
  scale_id: string;
  scale_name: string;
  instance_id: string;
  questions: ScaleQuestion[];
  question_ids: string[];
  question_required: boolean[];
};

// ─── Conversion helpers ──────────────────────────────────────────────────────

function mapAnswerType(raw: string): ScaleQuestion["type"] {
  switch (raw) {
    case "radio":
    case "likert":
    case "checkbox":
    case "multiple_choice":
      return "likert";
    case "slider":
    case "vas":
    case "nrs":
      return "vas";
    case "number":
    case "integer":
    case "numeric":
      return "numeric";
    case "time":
      return "time";
    default:
      return "text";
  }
}

function toLoadedScale(scale: PrsAssessmentScaleResult, instanceId: string): LoadedScale {
  return {
    scale_id: scale.scale_id,
    scale_name: scale.scale_name ?? scale.scale_code ?? scale.scale_id,
    instance_id: instanceId,
    questions: scale.questions.map(toPrsScaleQuestion),
    question_ids: scale.questions.map((q) => q.question_id),
    question_required: scale.questions.map((q) => q.is_required ?? true),
  };
}

function toPrsScaleQuestion(q: PrsAssessmentQuestion): ScaleQuestion {
  const type = mapAnswerType(q.answer_type);
  const options: QuestionOption[] | undefined = q.options?.length
    ? q.options
        .slice()
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .map((o) => ({ value: Number(o.value), label: o.label, points: o.points }))
    : undefined;

  return {
    index: q.question_index,
    label: q.question_text,
    type,
    required: q.is_required ?? true,
    options,
    min: q.min_value ?? undefined,
    max: q.max_value ?? undefined,
  };
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DoctorOnBehalfAssessmentPage() {
  const { id: patientId, permissionId } = useParams<{ id: string; permissionId: string }>();
  const router = useRouter();

  const [scales, setScales] = useState<LoadedScale[]>([]);
  const [currentScaleIndex, setCurrentScaleIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, Record<string, number | string>>>({});
  const [completedScaleIds, setCompletedScaleIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sttEnabled, setSttEnabled] = useState(false);
  const [isResumed, setIsResumed] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      try {
        const { permissions } = await permissionsService.getPatientPermissions(patientId);
        const permission = permissions.find((p) => p.permission_id === permissionId);
        if (!permission) throw new Error("Permission not found");

        const result = await prsAssessmentService.startAssessment({
          disease_id: permission.disease_id,
          taken_by: "doctor_on_behalf",
          patient_id: patientId,
        });

        if (result.scales.length === 0) throw new Error("No scales found for this assessment");

        const loadedScales: LoadedScale[] = result.scales.map((scale) =>
          toLoadedScale(scale, result.instance_id),
        );
        setScales(loadedScales);

        const alreadyCompleted = new Set(
          result.scales.filter((s) => s.is_completed).map((s) => s.scale_id),
        );
        setCompletedScaleIds(alreadyCompleted);

        if (result.is_resumed) {
          setIsResumed(true);
          try {
            const saved = await prsAssessmentService.getResponses(result.instance_id);
            const byQid = saved.responses_by_qid;

            const restoredResponses: Record<string, Record<string, number | string>> = {};
            for (const scale of loadedScales) {
              const scaleMap: Record<string, number | string> = {};
              scale.question_ids.forEach((qid, idx) => {
                const entry = byQid[qid];
                if (entry) {
                  scaleMap[String(idx)] =
                    entry.response_value !== null && entry.response_value !== undefined
                      ? entry.response_value
                      : entry.given_response;
                }
              });
              if (Object.keys(scaleMap).length > 0) {
                restoredResponses[scale.scale_id] = scaleMap;
              }
            }
            setResponses(restoredResponses);

            const firstIncompleteIdx = loadedScales.findIndex(
              (s) => !alreadyCompleted.has(s.scale_id),
            );
            if (firstIncompleteIdx >= 0) {
              const scale = loadedScales[firstIncompleteIdx];
              const answered = restoredResponses[scale.scale_id] ?? {};
              const firstUnanswered = scale.question_ids.findIndex(
                (_, idx) => answered[String(idx)] === undefined,
              );
              setCurrentScaleIndex(firstIncompleteIdx);
              setCurrentQuestionIndex(firstUnanswered >= 0 ? firstUnanswered : 0);
            }
          } catch {
            // If restoring saved responses fails, continue from the beginning
          }
        }
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string; detail?: string } } })?.response?.data?.message ??
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          (e as { message?: string })?.message ??
          "Failed to load assessment";
        setLoadError(String(msg));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [patientId, permissionId]);

  // ─── Derived state ──────────────────────────────────────────────────────
  const currentScale = scales[currentScaleIndex];
  const questions = currentScale?.questions ?? [];
  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  const currentValue = responses[currentScale?.scale_id]?.[String(currentQuestionIndex)];
  const isCurrentRequired = currentScale?.question_required[currentQuestionIndex] ?? true;
  const isLastQuestion = currentQuestionIndex >= totalQuestions - 1;
  const isFirstScale = currentScaleIndex === 0;
  const isLastScale = currentScaleIndex >= scales.length - 1;
  const questionKey = `${currentScaleIndex}-${currentQuestionIndex}`;

  const sidebarScales = scales.map((s) => ({
    scale_id: s.scale_id,
    short_name: typeof s.scale_name === "string" ? s.scale_name : s.scale_id,
  }));

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleAnswer = useCallback((questionIndex: number, value: number | string) => {
    const scaleId = currentScale?.scale_id;
    if (!scaleId) return;
    setResponses((prev) => ({
      ...prev,
      [scaleId]: { ...(prev[scaleId] ?? {}), [String(questionIndex)]: value },
    }));
    const questionId = currentScale.question_ids[questionIndex];
    if (questionId) {
      prsAssessmentService
        .saveResponse(currentScale.instance_id, scaleId, questionIndex, questionId, value)
        .catch(() => {});
    }
  }, [currentScale]);

  const handleNext = useCallback(() => {
    setCurrentQuestionIndex((i) => i + 1);
  }, []);

  const handleAutoAdvance = useCallback(() => {
    setCurrentQuestionIndex((prev) => {
      if (prev < totalQuestions - 1) return prev + 1;
      return prev;
    });
  }, [totalQuestions]);

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((i) => i - 1);
    } else if (!isFirstScale) {
      const prevScale = scales[currentScaleIndex - 1];
      setCurrentScaleIndex((i) => i - 1);
      setCurrentQuestionIndex(prevScale.questions.length - 1);
    }
  };

  const handleSubmitScale = async () => {
    if (!currentScale) return;
    setIsSubmitting(true);
    try {
      const scaleResponses = responses[currentScale.scale_id] ?? {};
      await prsAssessmentService.submitAssessment(currentScale.instance_id, currentScale.scale_id, scaleResponses);
      setCompletedScaleIds((prev) => new Set(prev).add(currentScale.scale_id));
      if (isLastScale) {
        router.push(`/doctor/patients/${patientId}`);
      } else {
        setCurrentScaleIndex((i) => i + 1);
        setCurrentQuestionIndex(0);
      }
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string; detail?: string } } })?.response?.data?.message ??
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (e as { message?: string })?.message ??
        "Failed to submit";
      alert(String(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── STT ─────────────────────────────────────────────────────────────────
  const { phase, transcript, matchedLabel, hint, isSupported } = useAssessmentSTT({
    questionKey,
    question: currentQuestion,
    enabled: sttEnabled && !isSubmitting,
    onAnswer: handleAnswer,
    onAutoAdvance: handleAutoAdvance,
  });

  // ─── Render ───────────────────────────────────────────────────────────────

  if (isLoading) return <AssessmentSkeleton />;

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-red-600 text-sm">{loadError}</p>
        <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  if (!currentScale || !currentQuestion) return <AssessmentSkeleton />;

  return (
    <div className="flex h-[calc(100vh-7rem)] -m-6">
      {/* Scale sidebar */}
      <ProgressSidebar
        scales={sidebarScales}
        currentIndex={currentScaleIndex}
        completedScaleIds={completedScaleIds}
        responses={responses}
        onNavigate={(idx) => {
          setCurrentScaleIndex(idx);
          setCurrentQuestionIndex(0);
        }}
      />

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4">
          {isResumed && (
            <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5 mb-3 w-fit">
              <RotateCcw className="h-3.5 w-3.5" />
              Resuming from where you left off
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium flex items-center gap-1.5">
                <UserCheck className="h-3.5 w-3.5" />
                Taking on Behalf of Patient
              </div>
              <h2 className="text-lg font-semibold text-neutral-900">{currentScale.scale_name}</h2>
            </div>
            <div className="flex items-center gap-3">
              {isSupported && (
                <Button
                  size="sm"
                  variant={sttEnabled ? "danger" : "outline"}
                  onClick={() => setSttEnabled((e) => !e)}
                >
                  {sttEnabled ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  {sttEnabled ? "Mic On" : "Use Voice"}
                </Button>
              )}
              <ProgressBar value={currentQuestionIndex + 1} max={totalQuestions} className="w-32" />
            </div>
          </div>
          <p className="text-sm text-neutral-500 mt-1">
            Scale {currentScaleIndex + 1} of {scales.length}
            {" · "}Question {currentQuestionIndex + 1} of {totalQuestions}
            {!isCurrentRequired && (
              <span className="ml-2 text-xs text-neutral-400">(optional)</span>
            )}
          </p>
        </div>

        {/* STT status bar */}
        {sttEnabled && (
          <STTBar
            phase={phase}
            transcript={transcript}
            matchedLabel={matchedLabel}
            hint={hint}
          />
        )}

        {/* Question */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl mx-auto">
            <QuestionRenderer
              question={currentQuestion}
              scaleId={currentScale.scale_id}
              value={currentValue}
              onAnswer={handleAnswer}
              questionNumber={currentQuestionIndex + 1}
              totalQuestions={totalQuestions}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white border-t px-6 py-4 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={handlePrev}
            disabled={isFirstScale && currentQuestionIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>

          {isLastQuestion ? (
            <Button onClick={handleSubmitScale} isLoading={isSubmitting}>
              <Send className="h-4 w-4" />
              {isLastScale ? "Complete Assessment" : "Submit & Next Scale"}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              disabled={isCurrentRequired && currentValue === undefined}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
