"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Send, SkipForward } from "lucide-react";
import { AssessmentSkeleton, Button, ProgressBar } from "@/components/ui";
import { QuestionRenderer } from "@/components/questionnaire/QuestionRenderer";
import { ProgressSidebar } from "@/components/questionnaire/ProgressSidebar";
import { patientsService } from "@/lib/api/services/patients.service";
import { prsAssessmentService } from "@/lib/api/services/prsAssessment.service";
import type { ScaleQuestion, QuestionOption } from "@/types/prs.types";
import type { PrsAssessmentQuestion } from "@/lib/api/services/prsAssessment.service";

// ─── Types ────────────────────────────────────────────────────────────────────

type LoadedScale = {
  scale_id: string;
  scale_name: string;
  instance_id: string;
  questions: ScaleQuestion[];
  question_ids: string[];
  question_required: boolean[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PatientAssessmentPage() {
  const { permissionId } = useParams<{ permissionId: string }>();
  const router = useRouter();

  const [scales, setScales] = useState<LoadedScale[]>([]);
  const [currentScaleIndex, setCurrentScaleIndex] = useState(0);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, Record<string, number | string>>>({});
  const [completedScaleIds, setCompletedScaleIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const initialized = useRef(false);

  // ─── Load permission + start all scale assessments ──────────────────────
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      try {
        // 1. Find the permission
        const { permissions } = await patientsService.getMyAssessments();
        const permission = permissions.find((p) => p.permission_id === permissionId);
        if (!permission) throw new Error("Assessment not found");

        // 2. Collect scale IDs from permission.scales
        const scaleEntries = permission.scales ?? [];
        if (scaleEntries.length === 0) throw new Error("No scales found for this assessment");

        // 3. Start all scales in parallel (patient taking for themselves)
        const startResults = await Promise.all(
          scaleEntries.map((s) =>
            prsAssessmentService.startAssessment({
              scale_id: s.scale_id,
              disease_id: permission.disease_id,
              taken_by: "patient",
              include_options: true,
            }),
          ),
        );

        // 4. Build LoadedScale entries
        const loadedScales: LoadedScale[] = startResults.map((result, idx) => {
          const baseQuestions = result.scale?.questions ?? [];
          return {
            scale_id: result.scale.scale_id,
            scale_name:
              result.scale.scale_name ??
              result.scale.scale_code ??
              scaleEntries[idx]?.scale_name ??
              result.scale.scale_id,
            instance_id: result.instance_id,
            questions: baseQuestions.map(toPrsScaleQuestion),
            question_ids: baseQuestions.map((q) => q.question_id),
            question_required: baseQuestions.map((q) => q.is_required ?? true),
          };
        });

        setScales(loadedScales);
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string; detail?: string } } })?.response?.data
            ?.message ??
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          (e as { message?: string })?.message ??
          "Failed to load assessment";
        setLoadError(String(msg));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [permissionId]);

  // ─── Derived state ────────────────────────────────────────────────────────
  const currentScale = scales[currentScaleIndex];
  const questions = currentScale?.questions ?? [];
  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  const currentValue = responses[currentScale?.scale_id]?.[String(currentQuestionIndex)];
  const isCurrentRequired = currentScale?.question_required[currentQuestionIndex] ?? true;
  const isLastQuestion = currentQuestionIndex >= totalQuestions - 1;
  const isFirstScale = currentScaleIndex === 0;
  const isLastScale = currentScaleIndex >= scales.length - 1;

  const sidebarScales = scales.map((s) => ({
    scale_id: s.scale_id,
    short_name: s.scale_name,
  }));

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleAnswer = (questionIndex: number, value: number | string) => {
    const scaleId = currentScale.scale_id;
    setResponses((prev) => ({
      ...prev,
      [scaleId]: { ...(prev[scaleId] ?? {}), [String(questionIndex)]: value },
    }));
    // Fire-and-forget auto-save
    const questionId = currentScale.question_ids[questionIndex];
    if (questionId) {
      prsAssessmentService
        .saveResponse(currentScale.instance_id, scaleId, questionIndex, questionId, value)
        .catch(() => {/* silent */});
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      setCurrentQuestionIndex((i) => i + 1);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((i) => i - 1);
    } else if (!isFirstScale) {
      const prevScale = scales[currentScaleIndex - 1];
      setCurrentScaleIndex((i) => i - 1);
      setCurrentQuestionIndex(prevScale.questions.length - 1);
    }
  };

  /** Skip the current question — only allowed when question is not required */
  const handleSkipQuestion = () => {
    if (isLastQuestion) {
      handleSubmitScale();
    } else {
      setCurrentQuestionIndex((i) => i + 1);
    }
  };

  /** Skip the entire current section/scale */
  const handleSkipSection = () => {
    setCompletedScaleIds((prev) => new Set(prev).add(currentScale.scale_id));
    if (isLastScale) {
      router.push("/patient/dashboard");
    } else {
      setCurrentScaleIndex((i) => i + 1);
      setCurrentQuestionIndex(0);
    }
  };

  const handleSubmitScale = async () => {
    if (!currentScale) return;
    setIsSubmitting(true);
    try {
      const scaleResponses = responses[currentScale.scale_id] ?? {};
      await prsAssessmentService.submitAssessment(
        currentScale.instance_id,
        currentScale.scale_id,
        scaleResponses,
      );
      setCompletedScaleIds((prev) => new Set(prev).add(currentScale.scale_id));
      if (isLastScale) {
        router.push("/patient/dashboard");
      } else {
        setCurrentScaleIndex((i) => i + 1);
        setCurrentQuestionIndex(0);
      }
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string; detail?: string } } })?.response?.data
          ?.message ??
        (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        (e as { message?: string })?.message ??
        "Failed to submit";
      alert(String(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-neutral-900">{currentScale.scale_name}</h2>
            <ProgressBar
              value={currentQuestionIndex + 1}
              max={totalQuestions}
              className="w-32"
            />
          </div>
          <p className="text-sm text-neutral-500 mt-1">
            Section {currentScaleIndex + 1} of {scales.length}
            {" · "}Question {currentQuestionIndex + 1} of {totalQuestions}
            {!isCurrentRequired && (
              <span className="ml-2 text-xs text-neutral-400">(optional)</span>
            )}
          </p>
        </div>

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
        <div className="bg-white border-t px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            {/* Left: back navigation */}
            <Button
              variant="outline"
              onClick={handlePrev}
              disabled={isFirstScale && currentQuestionIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </Button>

            {/* Right: skip + next/submit actions */}
            <div className="flex items-center gap-2">
              {/* Skip section — always available */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSkipSection}
                className="text-neutral-400 hover:text-neutral-600"
              >
                <SkipForward className="h-4 w-4" />
                Skip Section
              </Button>

              {/* Skip question — only for optional questions */}
              {!isCurrentRequired && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSkipQuestion}
                >
                  Skip Question
                </Button>
              )}

              {/* Next / Submit */}
              {isLastQuestion ? (
                <Button onClick={handleSubmitScale} isLoading={isSubmitting}>
                  <Send className="h-4 w-4" />
                  {isLastScale ? "Complete Assessment" : "Submit & Next Section"}
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
      </div>
    </div>
  );
}
