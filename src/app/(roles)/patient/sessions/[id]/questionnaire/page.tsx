"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Mic, ChevronLeft, ChevronRight, Send } from "lucide-react";
import { useQuestionnaire, useSessions } from "@/lib/hooks";
import { prsService } from "@/lib/api/services";
import { PageLoader, Button, ProgressBar } from "@/components/ui";
import { QuestionRenderer } from "@/components/questionnaire/QuestionRenderer";
import { ProgressSidebar } from "@/components/questionnaire/ProgressSidebar";
import { VoiceMode } from "@/components/questionnaire/VoiceMode";
import type { ScaleDefinition } from "@/types/prs.types";

export default function QuestionnairePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { currentSession, loadSession } = useSessions();
  const questionnaire = useQuestionnaire();
  const [scaleDefinitions, setScaleDefinitions] = useState<Record<string, ScaleDefinition>>({});
  const [completedScaleIds, setCompletedScaleIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load session and init questionnaire
  useEffect(() => { loadSession(id); }, [id, loadSession]);

  useEffect(() => {
    if (currentSession && !questionnaire.sessionId) {
      const existingResponses: Record<string, Record<string, number | string>> = {};
      const completed = new Set<string>();
      currentSession.scale_responses?.forEach((r) => {
        if (r.responses) existingResponses[r.scale_id] = r.responses;
        if (r.status === "completed") completed.add(r.scale_id);
      });
      setCompletedScaleIds(completed);
      questionnaire.init(id, currentSession.resolved_scale_ids, existingResponses);
    }
  }, [currentSession]);

  // Load scale definitions on demand
  useEffect(() => {
    if (!questionnaire.currentScaleId || scaleDefinitions[questionnaire.currentScaleId]) return;
    prsService.getScale(questionnaire.currentScaleId).then((scale) => {
      const def = (scale as any).definition || scale;
      setScaleDefinitions((prev) => ({ ...prev, [questionnaire.currentScaleId!]: def }));
    });
  }, [questionnaire.currentScaleId]);

  if (!currentSession || !questionnaire.currentScaleId) return <PageLoader />;

  const currentDef = scaleDefinitions[questionnaire.currentScaleId];
  if (!currentDef) return <PageLoader />;

  const questions = currentDef.questions || [];
  const currentQuestion = questions[questionnaire.currentQuestionIndex];
  const totalQuestions = questions.length;
  const currentValue = questionnaire.currentResponses[String(questionnaire.currentQuestionIndex)];

  const isLastQuestion = questionnaire.currentQuestionIndex >= totalQuestions - 1;

  const handleAnswer = (qIdx: number, value: number | string) => {
    questionnaire.answer(questionnaire.currentScaleId!, qIdx, value);
  };

  const handleSubmitScale = async () => {
    setIsSubmitting(true);
    try {
      const result = await questionnaire.submitCurrentScale();
      if (result) {
        setCompletedScaleIds((prev) => new Set(prev).add(questionnaire.currentScaleId!));
        if (result.session_completed || questionnaire.isLastScale) {
          router.push(`/patient/sessions/${id}/complete`);
        } else {
          questionnaire.nextScale();
        }
      }
    } catch (err) {
      console.error("Submit error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const scaleList = currentSession.resolved_scale_ids.map((sid) => ({
    scale_id: sid,
    short_name: scaleDefinitions[sid]?.shortName || sid,
  }));

  return (
    <div className="flex h-[calc(100vh-7rem)] -m-6">
      {/* Left sidebar: scale progress */}
      <ProgressSidebar
        scales={scaleList}
        currentIndex={questionnaire.currentScaleIndex}
        completedScaleIds={completedScaleIds}
        responses={questionnaire.responses}
        onNavigate={questionnaire.goToScale}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Scale header */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">
                {currentDef.shortName || currentDef.name}
              </h2>
              {currentDef.recallPeriod && (
                <p className="text-sm text-neutral-500 mt-0.5">{currentDef.recallPeriod}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                variant={questionnaire.isVoiceMode ? "danger" : "outline"}
                onClick={questionnaire.toggleVoice}
              >
                <Mic className="h-4 w-4" />
                {questionnaire.isVoiceMode ? "Voice ON" : "Voice"}
              </Button>
              <ProgressBar
                value={questionnaire.currentQuestionIndex + 1}
                max={totalQuestions}
                className="w-32"
              />
            </div>
          </div>
        </div>

        {/* Question area */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-2xl mx-auto">
            {currentQuestion && (
              <QuestionRenderer
                question={currentQuestion}
                scaleId={questionnaire.currentScaleId!}
                value={currentValue}
                onAnswer={handleAnswer}
                questionNumber={questionnaire.currentQuestionIndex + 1}
                totalQuestions={totalQuestions}
                isVoiceMode={questionnaire.isVoiceMode}
              />
            )}

            {questionnaire.isVoiceMode && currentQuestion && (
              <div className="mt-6">
                <VoiceMode
                  questionText={currentQuestion.label}
                  options={currentQuestion.options}
                  onAnswer={(val) => handleAnswer(currentQuestion.index, val)}
                  isActive={questionnaire.isVoiceMode}
                />
              </div>
            )}
          </div>
        </div>

        {/* Navigation footer */}
        <div className="bg-white border-t px-6 py-4 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={questionnaire.currentQuestionIndex > 0 ? questionnaire.prevQuestion : questionnaire.prevScale}
            disabled={questionnaire.isFirstScale && questionnaire.currentQuestionIndex === 0}
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>

          {isLastQuestion ? (
            <Button onClick={handleSubmitScale} isLoading={isSubmitting}>
              <Send className="h-4 w-4" />
              {questionnaire.isLastScale ? "Complete Assessment" : "Submit & Next Scale"}
            </Button>
          ) : (
            <Button
              onClick={() => questionnaire.nextQuestion(totalQuestions)}
              disabled={currentValue === undefined}
            >
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
