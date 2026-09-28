"use client";

import { useEffect, useRef, useState } from "react";
import { useGoBack } from "@/lib/hooks";
import {
  RotateCcw,
  Info,
  Calendar,
  FileText,
  Clock,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  SkipForward,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { QuestionRenderer } from "@/components/questionnaire/QuestionRenderer";
import { ProgressSidebar } from "@/components/questionnaire/ProgressSidebar";
import { STTBar } from "@/components/questionnaire/STTBar";
import { useTTS } from "@/lib/hooks";
import { cn } from "@/lib/utils/cn";
import { computeHiddenQuestionIndices } from "@/lib/utils/prsSkipLogic";
import type { ScaleQuestion } from "@/types/prs.types";
import { buildReadAloudText, type STTPhase } from "@/lib/hooks/useAssessmentSTT";

interface AssessmentUIProps {
  scales: Array<{
    scale_id: string;
    scale_name: string;
    short_name: string;
    disease_type?: string;
    description?: string;
    instructions?: string;
    estimated_duration?: string;
    content_type?: string;
  }>;
  currentScaleIndex: number;
  currentQuestionIndex: number;
  completedScaleIds: Set<string>;

  questions: ScaleQuestion[];
  responses: Record<string, Record<string, number | string>>;

  totalScales: number;
  isFirstScale: boolean;
  isLastScale: boolean;
  questionsAnswered: number;
  isResumed?: boolean;

  onAnswer: (questionIndex: number, value: number | string) => void;
  onPrev: () => void;
  onSkipSection: () => void;
  onSubmitScale: () => void;
  onNavigateScale: (index: number) => void;
  /** Step within the current scale's questions, one at a time. Falls back to
   *  onPrev/onSubmitScale at the first/last visible question so scales with
   *  no per-question stepper wired up (none today) still work end to end. */
  onQuestionPrev?: () => void;
  onQuestionNext?: () => void;

  sttEnabled?: boolean;
  onToggleStt?: (enabled: boolean) => void;
  sttPhase?: STTPhase;
  sttTranscript?: string;
  sttMatchedLabel?: string | null;
  sttHint?: string | null;
  isSttsupported?: boolean;

  isSubmitting?: boolean;

  languageCode?: string;
  languageOptions?: { code: string; label: string }[];
  onLanguageChange?: (code: string) => void;
  isLanguageSwitching?: boolean;

  backHref?: string;
  backLabel?: string;
}

export function AssessmentUI({
  scales,
  currentScaleIndex,
  currentQuestionIndex,
  completedScaleIds,
  questions,
  responses,
  totalScales,
  isFirstScale,
  isLastScale,
  questionsAnswered,
  isResumed,
  onAnswer,
  onPrev,
  onSkipSection,
  onSubmitScale,
  onNavigateScale,
  onQuestionPrev,
  onQuestionNext,
  sttEnabled,
  onToggleStt,
  sttPhase,
  sttTranscript,
  sttMatchedLabel,
  sttHint,
  isSttsupported,
  isSubmitting,
  languageCode,
  languageOptions,
  onLanguageChange,
  isLanguageSwitching,
  backHref,
  backLabel = "Back to patient details",
}: AssessmentUIProps) {
  // Hooks can't be conditional — always call it, but only render the button
  // (and thus only ever navigate) when a caller actually passed backHref.
  const goBack = useGoBack(backHref ?? "/");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const currentScale = scales[currentScaleIndex];

  // Submitting a scale (or jumping via the sidebar) swaps in a whole new set
  // of questions, but the internal overflow-y-auto container (not the
  // window) keeps whatever scroll position the "Next Section" click left it
  // at — usually near the bottom, so the new section opens off-screen and
  // has to be scrolled up manually every time.
  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0 });
  }, [currentScaleIndex]);
  const currentScaleResponses = currentScale ? (responses[currentScale.scale_id] ?? {}) : {};
  const hiddenIndices = computeHiddenQuestionIndices(questions, currentScaleResponses);
  const totalQuestions = questions.length - hiddenIndices.size;
  const questionsAnsweredVisible = questions.reduce(
    (n, _, idx) => (!hiddenIndices.has(idx) && currentScaleResponses[String(idx)] !== undefined ? n + 1 : n),
    0,
  );
  const questionsRemaining = totalQuestions - questionsAnsweredVisible;
  const visibleIndices = questions.map((_, idx) => idx).filter((idx) => !hiddenIndices.has(idx));
  // currentQuestionIndex can land on a now-hidden question (an earlier answer
  // just hid it via skip logic) — snap to the nearest visible one so the
  // single-question view never renders a blank/hidden slot.
  const activeQuestionIndex = hiddenIndices.has(currentQuestionIndex)
    ? (visibleIndices.find((idx) => idx > currentQuestionIndex) ?? visibleIndices[visibleIndices.length - 1] ?? currentQuestionIndex)
    : currentQuestionIndex;
  const visiblePosition = visibleIndices.indexOf(activeQuestionIndex);
  const isFirstVisibleQuestion = visiblePosition <= 0;
  const isLastVisibleQuestion = visiblePosition === -1 || visiblePosition === visibleIndices.length - 1;
  const activeQuestion = activeQuestionIndex != null ? questions[activeQuestionIndex] : undefined;
  const activeQuestionAnswered = activeQuestionIndex != null && currentScaleResponses[String(activeQuestionIndex)] !== undefined;
  // required defaults true server-side (see doctor/patient assessment pages'
  // toPrsScaleQuestion: is_required ?? true) — only an explicit false opts a
  // question out of blocking Next, so a scale can never be silently skipped
  // question-by-question without answering every mandatory item.
  const canAdvance = activeQuestion ? activeQuestion.required === false || activeQuestionAnswered : true;
  // Whether every required, currently-visible question in this scale has an
  // answer — gates the final Next/Submit button the same way Next between
  // questions is gated, so jumping straight to the last question (e.g. via
  // the sidebar) can't be used to skip past unanswered mandatory ones.
  const allRequiredAnswered = visibleIndices.every((idx) => {
    const q = questions[idx];
    return q.required === false || currentScaleResponses[String(idx)] !== undefined;
  });
  const scaleNumber = currentScaleIndex + 1;
  const overallProgress =
    totalScales > 0 ? Math.round((completedScaleIds.size / totalScales) * 100) : 0;
  const firstUnansweredIdx = questions.findIndex(
    (_, idx) => !hiddenIndices.has(idx) && currentScaleResponses[String(idx)] === undefined,
  );
  const readAloudQuestion = firstUnansweredIdx === -1
    ? questions[questions.length - 1]
    : questions[firstUnansweredIdx];
  const { speak, stop, isSpeaking } = useTTS({ rate: 0.92 });

  const sidebarScales = scales.map((s) => ({
    scale_id: s.scale_id,
    short_name: s.short_name || s.scale_name,
    scale_name: s.scale_name,
  }));

  if (!currentScale) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-100">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full bg-neutral-300 animate-pulse mx-auto mb-4" />
          <p className="text-neutral-600">Loading assessment...</p>
        </div>
      </div>
    );
  }

  const scaleResponses = responses[currentScale.scale_id] ?? {};

  return (
    <div className="flex h-[calc(100vh-4rem)] -mx-6 -mt-6 -mb-6 bg-neutral-50 relative">
      {/* Mobile sidebar overlay backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — hidden on mobile, slide in as overlay */}
      <div
        className={cn(
          "fixed md:relative inset-y-0 left-0 z-40 md:z-auto transition-transform duration-200",
          "md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <ProgressSidebar
          scales={sidebarScales}
          currentIndex={currentScaleIndex}
          completedScaleIds={completedScaleIds}
          responses={responses}
          onNavigate={(idx) => {
            // Every question is mandatory — jumping straight to a later,
            // not-yet-completed scale would skip its questions entirely.
            // Only the current scale or an already-completed (reviewable)
            // one is a valid jump target.
            const target = scales[idx];
            if (idx > currentScaleIndex && !(target && completedScaleIds.has(target.scale_id))) return;
            onNavigateScale(idx);
            setSidebarOpen(false);
          }}
          overallProgress={overallProgress}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white min-w-0">
        {/* Back link */}
        {backHref && (
          <div className="border-b border-neutral-100 px-4 py-2 flex-shrink-0">
            <button
              onClick={goBack}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-800 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              {backLabel}
            </button>
          </div>
        )}

        {/* Resumed Banner */}
        {isResumed && (
          <div className="flex items-center gap-1.5 text-xs text-primary-700 bg-primary-50 border-b border-primary-200 px-4 py-2.5">
            <RotateCcw className="h-3.5 w-3.5 shrink-0" />
            Resuming from where you left off
          </div>
        )}

        {/* Dark Header */}
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-4 py-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile sidebar toggle */}
            <button
              className="md:hidden shrink-0 p-1.5 rounded-lg bg-white/10 hover:bg-white/20"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open progress sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Scale number badge */}
            <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 bg-primary-500 rounded-xl flex flex-col items-center justify-center">
              <span className="text-base md:text-xl font-bold leading-none">{scaleNumber}</span>
              <span className="text-[9px] md:text-[10px] text-primary-100">of {totalScales}</span>
            </div>

            {/* Title block */}
            <div className="flex-1 min-w-0">
              {currentScale.disease_type && (
                <span className="inline-flex items-center px-2 py-0.5 bg-primary-700 text-primary-100 text-xs font-bold rounded uppercase tracking-wide mb-0.5">
                  {currentScale.disease_type}
                </span>
              )}
              <h1 className="text-sm md:text-lg font-bold leading-tight truncate">{currentScale.scale_name}</h1>
              {currentScale.description && (
                <p className="text-slate-400 text-xs leading-relaxed mt-0.5 truncate hidden sm:block">{currentScale.description}</p>
              )}
            </div>

            {/* Language selector — switches question/option wording; recorded on the instance in the DB */}
            {languageOptions && languageOptions.length > 1 && onLanguageChange && (
              <select
                value={languageCode ?? "en"}
                disabled={isLanguageSwitching}
                onChange={(e) => onLanguageChange(e.target.value)}
                aria-label="Assessment language"
                className="shrink-0 bg-white/10 hover:bg-white/20 text-white text-xs md:text-sm rounded-lg px-2 py-1.5 border border-white/20 disabled:opacity-50"
              >
                {languageOptions.map((opt) => (
                  <option key={opt.code} value={opt.code} className="text-neutral-900">
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Metadata Row */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex-shrink-0">
          <div className="flex items-center gap-3 text-xs text-slate-600 flex-wrap">
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>Today</span>
            </div>
            {currentScale.content_type && (
              <div className="flex items-center gap-1 hidden sm:flex">
                <FileText className="w-3.5 h-3.5" />
                <span>{currentScale.content_type}</span>
              </div>
            )}
            {currentScale.estimated_duration && (
              <div className="flex items-center gap-1 hidden sm:flex">
                <Clock className="w-3.5 h-3.5" />
                <span>~{currentScale.estimated_duration}</span>
              </div>
            )}
            <div className="ml-auto flex items-center gap-1 px-2 py-0.5 bg-primary-50 border border-primary-200 rounded-full text-primary-700 text-xs font-medium">
              <CheckCircle className="w-3 h-3 shrink-0" />
              {questionsAnsweredVisible}/{totalQuestions}
            </div>
          </div>
        </div>

        {/* STT Bar */}
        {sttEnabled && (
          <STTBar
            phase={sttPhase ?? "idle"}
            transcript={sttTranscript ?? ""}
            matchedLabel={sttMatchedLabel ?? null}
            hint={sttHint ?? null}
          />
        )}

        {/* Scrollable Questions */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 md:px-6 py-4">
            {/* Instructions box */}
            {currentScale.instructions && (
              <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-800">{currentScale.instructions}</p>
              </div>
            )}

            {/* One question at a time — a mid-list wall of questions is a lot to
                take in for someone answering a mental-health screener, so only
                the current question renders and Next/Previous below step
                through them. */}
            {activeQuestionIndex != null && questions[activeQuestionIndex] && (() => {
              const idx = activeQuestionIndex;
              const question = questions[idx];
              const qValue = scaleResponses[String(idx)];
              const isCurrentStt = idx === currentQuestionIndex && sttEnabled;

              return (
                <div
                  key={`${currentScale.scale_id}-${idx}`}
                  className={cn(
                    "rounded-xl border p-4 md:p-6 shadow-sm transition-all",
                    isCurrentStt
                      ? "border-primary-300 bg-primary-50/20"
                      : "border-neutral-200 bg-white",
                  )}
                >
                  {isCurrentStt && (
                    <div className="relative w-6 h-6 mb-3 md:hidden">
                      {sttPhase === "listening" && (
                        <span className="absolute -inset-1 rounded-full bg-red-400 opacity-30 animate-ping" />
                      )}
                      <span className="absolute inset-0 rounded-full bg-red-500 flex items-center justify-center">
                        <Mic className="w-3 h-3 text-white" />
                      </span>
                    </div>
                  )}
                  <QuestionRenderer
                    question={question}
                    scaleId={currentScale.scale_id}
                    value={qValue}
                    onAnswer={onAnswer}
                    questionNumber={visiblePosition + 1}
                    totalQuestions={totalQuestions}
                    showHeader
                  />
                </div>
              );
            })()}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex-shrink-0">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={isFirstVisibleQuestion ? onPrev : (onQuestionPrev ?? onPrev)}
              disabled={isFirstVisibleQuestion && isFirstScale}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">{isFirstVisibleQuestion ? "Previous Scale" : "Previous"}</span>
              <span className="sm:hidden">Prev</span>
            </Button>

            <div className="flex items-center gap-2 flex-wrap justify-center">
              <div className="flex items-center gap-1 text-xs text-primary-600 font-medium">
                <Info className="w-3.5 h-3.5 shrink-0" />
                <span>{questionsRemaining} left</span>
              </div>

              {readAloudQuestion && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => isSpeaking ? stop() : speak(buildReadAloudText(readAloudQuestion))}
                  className={cn(
                    isSpeaking
                      ? "border-blue-300 text-blue-600 bg-blue-50 hover:bg-blue-100"
                      : "border-neutral-300 text-neutral-600 hover:bg-neutral-50",
                  )}
                >
                  {isSpeaking ? (
                    <>
                      <VolumeX className="h-4 w-4" />
                      <span className="hidden sm:inline">Stop</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-4 w-4" />
                      <span className="hidden sm:inline">Read Aloud</span>
                    </>
                  )}
                </Button>
              )}

              {isSttsupported && onToggleStt && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onToggleStt(!sttEnabled)}
                  className={cn(
                    sttEnabled
                      ? "border-red-300 text-red-600 bg-red-50 hover:bg-red-100"
                      : "border-neutral-300 text-neutral-600 hover:bg-neutral-50",
                  )}
                >
                  {sttEnabled ? (
                    <>
                      <MicOff className="h-4 w-4" />
                      <span className="hidden sm:inline">Stop Voice</span>
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" />
                      <span className="hidden sm:inline">Voice Input</span>
                    </>
                  )}
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={onSkipSection}
                className="text-primary-600 border-primary-300 hover:bg-primary-50"
              >
                <SkipForward className="h-4 w-4" />
                <span className="hidden sm:inline">Skip Scale</span>
              </Button>
            </div>

            {isLastVisibleQuestion ? (
              <Button onClick={onSubmitScale} isLoading={isSubmitting} disabled={!allRequiredAnswered} size="sm">
                <span className="hidden sm:inline">{isLastScale ? "Submit Assessment" : "Next Scale"}</span>
                <span className="sm:hidden">{isLastScale ? "Submit" : "Next"}</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={onQuestionNext} disabled={!canAdvance} size="sm">
                <span>Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
