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

/** Patient completing one PRS scale that the clinical assistant pushed to them
 * for a specific device session ("Patient should complete" on the CA live
 * page). Mirrors the CA-administered route
 * (clinical-assistant/device-sessions/[appointmentId]/scales/[protocolScaleId])
 * but runs as `taken_by: "patient"` and, on finish, links the instance back
 * onto this session's device_session_scales row via recordDeviceSessionPrs so
 * the session shows it as complete. It does NOT flip delivery_mode — this
 * scale stays "patient_app".
 *
 * Access is gated: the row must exist, be delivery_mode="patient_app", not
 * already completed, and the session must have reached its scheduled time.
 * Anything else redirects back to the session — a patient must not reach an
 * assessment for a session that isn't open yet. */
export default function PatientSessionAssessmentPage() {
  const { appointmentId, protocolScaleId } = useParams<{ appointmentId: string; protocolScaleId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const backHref = `/patient/device-sessions/${appointmentId}`;

  const [scale, setScale] = useState<{
    scale_id: string;
    scale_name: string;
    instance_id: string;
    questions: ScaleQuestion[];
    question_ids: string[];
  } | null>(null);
  const [protocolId, setProtocolId] = useState<string | null>(null);
  const [sessionNumber, setSessionNumber] = useState<number | null>(null);
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
        const appt = await appointmentsService.getById(appointmentId);
        if (!appt.protocol_id || appt.session_number == null) {
          router.replace(backHref);
          return;
        }
        setProtocolId(appt.protocol_id);
        setSessionNumber(appt.session_number);

        // Gate: session must have reached its scheduled time (or already be
        // running / done). Future sessions are off-limits.
        const t = appt.start_time && appt.start_time.length >= 4 ? appt.start_time : "23:59";
        const startsAt = new Date(`${appt.appointment_date}T${t}`).getTime();
        const openByTime = Number.isNaN(startsAt) ? true : startsAt <= Date.now();
        const openByStatus = appt.status === "in_progress" || appt.status === "completed";
        if (!openByTime && !openByStatus) {
          router.replace(backHref);
          return;
        }

        // Gate: the scale row must be pushed to the patient and not done.
        const rows = await deviceSessionService.listScales(appointmentId);
        const row = rows.find((r) => r.protocol_scale_id === protocolScaleId);
        if (!row || row.delivery_mode !== "patient_app" || row.status === "completed") {
          router.replace(backHref);
          return;
        }

        const scaleCode = searchParams.get("scale_code") || row.scale_code;
        if (!scaleCode) throw new Error("This assessment is missing its scale code");

        const resolved = await prsAssessmentService.resolveDiseaseAndScaleId(scaleCode);
        if (!resolved) throw new Error(`No PRS disease maps to ${scaleCode}`);

        const result = await prsAssessmentService.startAssessment({
          disease_id: resolved.diseaseId,
          taken_by: "patient",
          patient_id: appt.patient_public_id ?? appt.patient_id,
          appointment_id: appointmentId,
        });

        // Disease-level start can return several scales — administer only the
        // one this session asked for.
        const target = result.scales.find((s) => s.scale_code === scaleCode) ?? result.scales[0];
        if (!target) throw new Error("No scales returned for this assessment");
        setScale(toLoadedScale(target, result.instance_id));

        if (result.is_resumed) {
          try {
            const saved = await prsAssessmentService.getResponses(result.instance_id);
            const byQid = saved.responses_by_qid;
            const restored: Record<string, number | string> = {};
            target.questions.forEach((q, idx) => {
              const entry = byQid[q.question_id];
              if (entry) restored[String(idx)] = entry.response_value ?? entry.given_response;
            });
            setResponses(restored);
          } catch {
            // start from scratch if restore fails
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
  }, [appointmentId, protocolScaleId, searchParams, router, backHref]);

  const questions = scale?.questions ?? [];
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

      // Flip THIS scale's own due-scale row immediately — real answers are
      // scored the moment they're submitted, the session view shouldn't
      // wait for every other scale due this visit before showing that.
      await deviceSessionService.completeScale(appointmentId, protocolScaleId, scale.instance_id).catch(() => {});

      // device_session_prs_responses is UNIQUE on appointment_id — one link
      // row per session, ever. _complete_due_scales (backend) sweeps EVERY
      // scale_result currently scored on this instance and marks all of
      // them "completed" on device_session_scales in that single call. If
      // we called this after every scale, the FIRST scale submitted would
      // claim the once-per-session slot and, because disease-level
      // instances share scale_results across sibling scales, could sweep
      // up scales the patient hasn't actually answered yet — that's what
      // made DASS-21 show "Completed" after only EQ-5D-5L was submitted.
      // Only call it once every patient_app scale due this session is
      // actually done, so the sweep is correct when it fires.
      if (protocolId && sessionNumber != null) {
        const rows = await deviceSessionService.listScales(appointmentId);
        const stillPending = rows.some(
          (r) =>
            r.delivery_mode === "patient_app" &&
            r.status !== "completed" &&
            r.protocol_scale_id !== protocolScaleId,
        );
        if (!stillPending) {
          await treatmentProtocolService.recordDeviceSessionPrs(protocolId, {
            appointment_id: appointmentId,
            instance_id: scale.instance_id,
            session_number: sessionNumber,
          });
        }
      }

      router.push(backHref);
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
  }, [scale, responses, protocolId, sessionNumber, appointmentId, router, backHref]);

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
    disease_type: "SESSION ASSESSMENT",
    description: "Your clinical assistant asked you to complete this for today's session.",
    instructions: "Answer each item as it applies to you today.",
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
      backHref={backHref}
      backLabel="Back to session"
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
