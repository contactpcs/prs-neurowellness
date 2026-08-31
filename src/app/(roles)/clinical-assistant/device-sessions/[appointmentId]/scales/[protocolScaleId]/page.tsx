"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { AssessmentSkeleton } from "@/components/ui";
import { AssessmentUI } from "@/components/assessment/AssessmentUI";
import { appointmentsService } from "@/lib/api/services";
import { treatmentProtocolService } from "@/lib/api/services/treatmentProtocol.service";
import { prsAssessmentService, PRS_LANGUAGES } from "@/lib/api/services/prsAssessment.service";
import { deviceSessionService } from "@/lib/api/services/deviceSession.service";
import type { ScaleQuestion, QuestionOption } from "@/types/prs.types";
import type { PrsAssessmentQuestion, PrsAssessmentScaleResult } from "@/lib/api/services/prsAssessment.service";
import { computeHiddenQuestionIndices } from "@/lib/utils/prsSkipLogic";

/** CA-administered PRS scale during a live device session — "Administer
 * here" on the live page's Scales & Assessments section. Mirrors
 * doctor/patients/[id]/assessment/[permissionId]/page.tsx (doctor_on_behalf
 * flow) but: (1) resolves disease_id by reverse-scanning the PRS catalogue
 * for this scale_code, since device_session_scales carries no disease_id
 * and treatment_protocols exposes no condition->disease lookup, and (2)
 * finishes by calling recordDeviceSessionPrs to link the finished instance
 * back onto this session's device_session_scales row (previously built but
 * never called from anywhere — the actual bug this route fixes) instead of
 * routing into the patient chart. Single-scale only — the doctor flow can
 * walk a whole disease's scale list, this route stops after the one scale
 * device_session_scales asked for.
 *
 * scale_code arrives as a query param from the live page's scale card
 * (DeviceSessionScale.scale_code) rather than being re-derived from the
 * protocol here — ProtocolDetail carries no scales[] on the frontend and
 * treatmentProtocol.service.ts has no endpoint that lists them. */
export default function CaAdministerScalePage() {
  const { appointmentId, protocolScaleId } = useParams<{ appointmentId: string; protocolScaleId: string }>();
  const searchParams = useSearchParams();
  const scaleCode = searchParams.get("scale_code");
  const router = useRouter();

  const [scale, setScale] = useState<{
    scale_id: string;
    scale_name: string;
    instance_id: string;
    questions: ScaleQuestion[];
    question_ids: string[];
  } | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, number | string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [languageCode, setLanguageCode] = useState("en");
  const [isLanguageSwitching, setIsLanguageSwitching] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    (async () => {
      try {
        if (!scaleCode) throw new Error("Missing scale_code — open this page from the live session's Scales section");
        const appt = await appointmentsService.getById(appointmentId);
        const patientId = appt.patient_public_id ?? appt.patient_id;
        if (!appt.protocol_id) throw new Error("This appointment has no treatment protocol linked");

        const resolved = await prsAssessmentService.resolveDiseaseAndScaleId(scaleCode);
        if (!resolved) throw new Error(`No PRS disease maps to ${scaleCode} — cannot render this scale`);
        const { diseaseId } = resolved;

        const result = await prsAssessmentService.startAssessment({
          disease_id: diseaseId,
          taken_by: "doctor_on_behalf",
          patient_id: patientId,
          appointment_id: appointmentId,
        });

        // Disease-level start can return several scales (e.g. Depression/
        // Anxiety pulls in GAD-7 alongside PHQ-9) — only the one this
        // session actually asked for is administered here.
        const target = result.scales.find((s) => s.scale_code === scaleCode) ?? result.scales[0];
        if (!target) throw new Error("No scales returned for this disease");

        setScale(toLoadedScale(target, result.instance_id));

        if (result.is_resumed) {
          try {
            const saved = await prsAssessmentService.getResponses(result.instance_id);
            const byQid = saved.responses_by_qid;
            const restored: Record<string, number | string> = {};
            target.questions.forEach((q, idx) => {
              const entry = byQid[q.question_id];
              if (entry) {
                restored[String(idx)] = entry.response_value ?? entry.given_response;
              }
            });
            setResponses(restored);
          } catch {
            // continue from the beginning if restore fails
          }
        }
      } catch (e: unknown) {
        const msg =
          (e as { response?: { data?: { message?: string; detail?: string } } })?.response?.data?.message ??
          (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
          (e as { message?: string })?.message ??
          "Failed to load scale";
        setLoadError(String(msg));
      } finally {
        setIsLoading(false);
      }
    })();
  }, [appointmentId, protocolScaleId, scaleCode]);

  const questions = scale?.questions ?? [];
  const currentQuestion = questions[currentQuestionIndex];
  const totalQuestions = questions.length;
  const questionsAnswered = Object.keys(responses).length;

  const handleAnswer = useCallback(
    (questionIndex: number, value: number | string) => {
      if (!scale) return;
      setResponses((prev) => ({ ...prev, [String(questionIndex)]: value }));
      const questionId = scale.question_ids[questionIndex];
      if (questionId) {
        prsAssessmentService.saveResponse(scale.instance_id, scale.scale_id, questionIndex, questionId, value).catch(() => {});
      }
    },
    [scale],
  );

  const handleLanguageChange = async (code: string) => {
    if (!scale || code === languageCode) return;
    setIsLanguageSwitching(true);
    try {
      const result = await prsAssessmentService.setLanguage(scale.instance_id, code);
      const target = result.scales.find((s) => s.scale_id === scale.scale_id) ?? result.scales[0];
      if (target) setScale(toLoadedScale(target, scale.instance_id));
      setLanguageCode(code);
    } catch {
      // keep previous language on failure
    } finally {
      setIsLanguageSwitching(false);
    }
  };

  const finishAndLink = useCallback(async () => {
    if (!scale) return;
    setIsSubmitting(true);
    try {
      const hiddenIndices = computeHiddenQuestionIndices(scale.questions, responses);
      const byQuestionId: Record<string, number | string> = {};
      for (const [idx, v] of Object.entries(responses)) {
        if (hiddenIndices.has(Number(idx))) continue;
        const qid = scale.question_ids[Number(idx)];
        if (qid) byQuestionId[qid] = v;
      }
      await prsAssessmentService.submitAssessment(scale.instance_id, scale.scale_id, byQuestionId);

      // The missing link: previously nothing ever called this, so a
      // CA-administered scale's answers were saved to the real PRS tables
      // but device_session_scales.status/prs_instance_id never advanced
      // past "pending" and the result never surfaced anywhere the patient
      // or doctor could see it as belonging to this session.
      const appt = await appointmentsService.getById(appointmentId);
      if (appt.protocol_id && appt.session_number != null) {
        await treatmentProtocolService.recordDeviceSessionPrs(appt.protocol_id, {
          appointment_id: appointmentId,
          instance_id: scale.instance_id,
          session_number: appt.session_number,
        });
      }
      await deviceSessionService.setScaleDelivery(appointmentId, protocolScaleId, "ca_administered");

      router.push(`/clinical-assistant/device-sessions/${appointmentId}/live`);
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
  }, [scale, responses, appointmentId, protocolScaleId, router]);

  const handleAutoAdvance = useCallback(() => {
    setResponses((prev) => {
      const hiddenIndices = computeHiddenQuestionIndices(questions, prev);
      const allAnswered = questions.length > 0 && questions.every((_, idx) => hiddenIndices.has(idx) || prev[String(idx)] !== undefined);
      if (allAnswered) {
        setTimeout(() => finishAndLink(), 0);
      } else {
        setCurrentQuestionIndex((q) => (q < totalQuestions - 1 ? q + 1 : q));
      }
      return prev;
    });
  }, [questions, totalQuestions, finishAndLink]);

  if (isLoading) return <AssessmentSkeleton />;
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <p className="text-red-600 text-sm">{loadError}</p>
      </div>
    );
  }
  if (!scale) return <AssessmentSkeleton />;

  const scalesWithMetadata = [{
    scale_id: scale.scale_id,
    scale_name: scale.scale_name,
    short_name: scale.scale_name,
    disease_type: "CLINICAL ASSESSMENT",
    description: "Administered by the clinical assistant on the patient's behalf during this session.",
    instructions: "Ask the patient each item and record their answer.",
    estimated_duration: "5 min",
  }];

  return (
    <AssessmentUI
      scales={scalesWithMetadata}
      currentScaleIndex={0}
      currentQuestionIndex={currentQuestionIndex}
      completedScaleIds={new Set()}
      questions={questions}
      responses={{ [scale.scale_id]: responses }}
      totalScales={1}
      isFirstScale
      isLastScale
      questionsAnswered={questionsAnswered}
      isResumed={false}
      onAnswer={handleAnswer}
      onPrev={() => setCurrentQuestionIndex((q) => Math.max(0, q - 1))}
      onSkipSection={finishAndLink}
      onSubmitScale={finishAndLink}
      onNavigateScale={() => {}}
      sttEnabled={false}
      onToggleStt={() => {}}
      sttPhase="idle"
      sttTranscript=""
      sttMatchedLabel={null}
      sttHint={null}
      isSttsupported={false}
      isSubmitting={isSubmitting}
      languageCode={languageCode}
      languageOptions={[...PRS_LANGUAGES]}
      onLanguageChange={handleLanguageChange}
      isLanguageSwitching={isLanguageSwitching}
      backHref={`/clinical-assistant/device-sessions/${appointmentId}/live`}
    />
  );

  function toLoadedScale(s: PrsAssessmentScaleResult, instanceId: string) {
    return {
      scale_id: s.scale_id,
      scale_name: s.scale_name ?? s.scale_code ?? s.scale_id,
      instance_id: instanceId,
      questions: s.questions.map((q) => toPrsScaleQuestion(q, s.questions)),
      question_ids: s.questions.map((q) => q.question_id),
    };
  }
}

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

function toPrsScaleQuestion(q: PrsAssessmentQuestion, allQuestions: PrsAssessmentQuestion[]): ScaleQuestion {
  const type = mapAnswerType(q.answer_type);
  const options: QuestionOption[] | undefined = q.options?.length
    ? q.options.slice().sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)).map((o) => ({ value: Number(o.value), label: o.label, points: o.points }))
    : undefined;
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
