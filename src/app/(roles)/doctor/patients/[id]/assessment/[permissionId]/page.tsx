"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AssessmentSkeleton } from "@/components/ui";
import { AssessmentUI } from "@/components/assessment/AssessmentUI";
import { useAssessmentSTT } from "@/lib/hooks/useAssessmentSTT";
import { permissionsService } from "@/lib/api/services/permissions.service";
import { prsAssessmentService, PRS_LANGUAGES } from "@/lib/api/services/prsAssessment.service";
import { useAppDispatch } from "@/store/hooks";
import { invalidatePatientPermissions, fetchPatientPermissions } from "@/store/slices/permissionsSlice";
import { invalidatePatientScores, fetchPatientScoresSummary } from "@/store/slices/scoresSlice";
import { invalidateDoctorPatients, fetchDoctorPatient } from "@/store/slices/doctorsSlice";
import type { ScaleQuestion, QuestionOption } from "@/types/prs.types";
import type { PrsAssessmentQuestion, PrsAssessmentScaleResult } from "@/lib/api/services/prsAssessment.service";
import { computeHiddenQuestionIndices } from "@/lib/utils/prsSkipLogic";

// ─── Type helpers ─────────────────────────────────────────────────────────────

type LoadedScale = {
  scale_id: string;
  scale_name: string;
  instance_id: string;
  questions: ScaleQuestion[];
  question_ids: string[];
  question_required: boolean[];
};

// ─── Conversion helpers ───────────────────────────────────────────────────────

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
    questions: scale.questions.map((q) => toPrsScaleQuestion(q, scale.questions)),
    question_ids: scale.questions.map((q) => q.question_id),
    question_required: scale.questions.map((q) => q.is_required ?? true),
  };
}

function toPrsScaleQuestion(q: PrsAssessmentQuestion, allQuestions: PrsAssessmentQuestion[]): ScaleQuestion {
  const type = mapAnswerType(q.answer_type);
  const options: QuestionOption[] | undefined = q.options?.length
    ? q.options
        .slice()
        .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
        .map((o) => ({ value: Number(o.value), label: o.label, points: o.points }))
    : undefined;

  // hidden_unless.question_id -> position within this scale's question list,
  // so runtime evaluation (computeHiddenQuestionIndices) can just index into
  // `responses` by number instead of re-resolving question_id every render.
  const rule = q.hidden_unless;
  const refIndex = rule ? allQuestions.findIndex((x) => x.question_id === rule.question_id) : -1;
  const hiddenUnless = rule && refIndex !== -1
    ? { refIndex, hiddenWhenLabel: rule.hidden_when_label, visibleOnlyWhenLabel: rule.visible_only_when_label }
    : null;

  return {
    index: q.question_index,
    label: q.question_text,
    type,
    required: q.is_required ?? true,
    options,
    min: q.min_value ?? undefined,
    max: q.max_value ?? undefined,
    hiddenUnless,
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DoctorOnBehalfAssessmentPage() {
  const { id: patientId, permissionId } = useParams<{ id: string; permissionId: string }>();
  const router = useRouter();
  const dispatch = useAppDispatch();

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
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [languageCode, setLanguageCode] = useState("en");
  const [isLanguageSwitching, setIsLanguageSwitching] = useState(false);
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

        setInstanceId(result.instance_id);
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
              setCurrentScaleIndex(firstIncompleteIdx);
              setCurrentQuestionIndex(0);
            }
          } catch {
            // If restoring saved responses fails, continue from the beginning
          }
        }
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
  }, [patientId, permissionId]);

  // ─── Derived state ────────────────────────────────────────────────────────
  const currentScale = scales[currentScaleIndex];
  const questions = currentScale?.questions ?? [];
  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  const isFirstScale = currentScaleIndex === 0;
  const isLastScale = currentScaleIndex >= scales.length - 1;
  const questionKey = `${currentScaleIndex}-${currentQuestionIndex}`;

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleAnswer = useCallback(
    (questionIndex: number, value: number | string) => {
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
    },
    [currentScale],
  );

  const handlePrev = () => {
    if (!isFirstScale) {
      setCurrentScaleIndex((i) => i - 1);
      setCurrentQuestionIndex(0);
    }
  };

  const handleLanguageChange = async (code: string) => {
    if (!instanceId || code === languageCode) return;
    setIsLanguageSwitching(true);
    try {
      const result = await prsAssessmentService.setLanguage(instanceId, code);
      // Same question order/ids as before — only wording changes, so
      // currentScaleIndex/currentQuestionIndex/responses stay valid as-is.
      setScales(result.scales.map((scale) => toLoadedScale(scale, instanceId)));
      setLanguageCode(code);
    } catch {
      // keep previous language on failure
    } finally {
      setIsLanguageSwitching(false);
    }
  };

  const handleSubmitScale = useCallback(async () => {
    if (!currentScale) return;
    setIsSubmitting(true);
    try {
      // responses state is keyed by question INDEX — remap to real
      // question_ids before submit (backend FK rejects raw indexes).
      // Skip-logic-hidden questions are excluded even if a stale answer is
      // still in state (e.g. user answered, then changed an earlier answer
      // that hid it) — submitting them would double-count in scoring.
      const scaleResponses = responses[currentScale.scale_id] ?? {};
      const hiddenIndices = computeHiddenQuestionIndices(currentScale.questions, scaleResponses);
      const byQuestionId: Record<string, number | string> = {};
      for (const [idx, v] of Object.entries(scaleResponses)) {
        if (hiddenIndices.has(Number(idx))) continue;
        const qid = currentScale.question_ids[Number(idx)];
        if (qid) byQuestionId[qid] = v;
      }
      await prsAssessmentService.submitAssessment(
        currentScale.instance_id,
        currentScale.scale_id,
        byQuestionId,
      );
      const newCompleted = new Set(completedScaleIds).add(currentScale.scale_id);
      setCompletedScaleIds(newCompleted);
      if (isLastScale) {
        const skipped = scales.filter((s) => !newCompleted.has(s.scale_id));
        await Promise.all(
          skipped.map((s) => prsAssessmentService.submitAssessment(s.instance_id, s.scale_id, {})),
        );
        dispatch(invalidatePatientPermissions(patientId));
        dispatch(invalidatePatientScores(patientId));
        dispatch(invalidateDoctorPatients());
        await Promise.all([
          dispatch(fetchPatientPermissions(patientId)),
          dispatch(fetchPatientScoresSummary(patientId)),
          dispatch(fetchDoctorPatient(patientId)),
        ]);
        router.push(`/doctor/patients/${patientId}?section=prs`);
        router.refresh();
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
  }, [currentScale, responses, completedScaleIds, isLastScale, scales, dispatch, patientId, router]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSkipSection = () => {
    setResponses((prev) => {
      const next = { ...prev };
      delete next[currentScale.scale_id];
      return next;
    });
    if (isLastScale) {
      handleSubmitScale();
    } else {
      setCurrentScaleIndex((i) => i + 1);
      setCurrentQuestionIndex(0);
    }
  };

  const handleAutoAdvance = useCallback(() => {
    const scaleId = currentScale?.scale_id;
    if (!scaleId) return;
    setResponses((prev) => {
      const scaleResponses = prev[scaleId] ?? {};
      const hiddenIndices = computeHiddenQuestionIndices(questions, scaleResponses);
      const allAnswered = questions.length > 0 && questions.every(
        (_, idx) => hiddenIndices.has(idx) || scaleResponses[String(idx)] !== undefined,
      );
      if (allAnswered) {
        setTimeout(() => handleSubmitScale(), 0);
      } else {
        setCurrentQuestionIndex((q) => (q < totalQuestions - 1 ? q + 1 : q));
      }
      return prev;
    });
  }, [currentScale, questions, totalQuestions, handleSubmitScale]);

  // ─── STT ──────────────────────────────────────────────────────────────────
  const { phase, transcript, matchedLabel, hint, isSupported } = useAssessmentSTT({
    questionKey,
    question: currentQuestion,
    enabled: sttEnabled && !isSubmitting,
    onAnswer: handleAnswer,
    onAutoAdvance: handleAutoAdvance,
  });

  // Jump to first unanswered question when enabling STT mid-session
  useEffect(() => {
    if (!sttEnabled) return;
    const scaleResponses = responses[currentScale?.scale_id] ?? {};
    const firstUnanswered = questions.findIndex((_, idx) => scaleResponses[String(idx)] === undefined);
    const target = firstUnanswered === -1 ? Math.max(0, totalQuestions - 1) : firstUnanswered;
    setCurrentQuestionIndex(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sttEnabled]);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (isLoading) return <AssessmentSkeleton />;

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-red-600 text-sm">{loadError}</p>
      </div>
    );
  }

  if (!currentScale) return <AssessmentSkeleton />;

  const scalesWithMetadata = scales.map((scale) => ({
    scale_id: scale.scale_id,
    scale_name: scale.scale_name,
    short_name: scale.scale_name,
    disease_type: "CLINICAL ASSESSMENT",
    description: "A standardized measure of health-related quality of life",
    instructions: "Under each heading, please tick the ONE box that best describes your health TODAY.",
    estimated_duration: "5 min",
  }));

  const questionsAnswered = Object.keys(responses[currentScale.scale_id] ?? {}).length;

  return (
    <AssessmentUI
      scales={scalesWithMetadata}
      currentScaleIndex={currentScaleIndex}
      currentQuestionIndex={currentQuestionIndex}
      completedScaleIds={completedScaleIds}
      questions={questions}
      responses={responses}
      totalScales={scales.length}
      isFirstScale={isFirstScale}
      isLastScale={isLastScale}
      questionsAnswered={questionsAnswered}
      isResumed={isResumed}
      onAnswer={handleAnswer}
      onPrev={handlePrev}
      onSkipSection={handleSkipSection}
      onSubmitScale={handleSubmitScale}
      onNavigateScale={(idx) => {
        setCurrentScaleIndex(idx);
        setCurrentQuestionIndex(0);
      }}
      sttEnabled={sttEnabled}
      onToggleStt={setSttEnabled}
      sttPhase={phase}
      sttTranscript={transcript}
      sttMatchedLabel={matchedLabel}
      sttHint={hint}
      isSttsupported={isSupported}
      isSubmitting={isSubmitting}
      languageCode={languageCode}
      languageOptions={[...PRS_LANGUAGES]}
      onLanguageChange={handleLanguageChange}
      isLanguageSwitching={isLanguageSwitching}
      backHref={`/doctor/patients/${patientId}`}
    />
  );
}
