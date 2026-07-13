"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brain } from "lucide-react";
import { useAuth } from "@/lib/hooks";
import { useAppDispatch } from "@/store/hooks";
import { refreshUser } from "@/store/slices/authSlice";
import { Button } from "@/components/ui";
import { ROUTES } from "@/lib/constants";
import { patientsService } from "@/lib/api/services/patients.service";
import { prsService } from "@/lib/api/services/prs.service";
import { prsAssessmentService } from "@/lib/api/services/prsAssessment.service";

interface Question {
  question_id: string;
  question_text: string;
  answer_type: string;
  min_value: number | null;
  max_value: number | null;
  is_required: boolean;
}

interface ScaleQuestions {
  scale_id: string;
  questions: Question[];
}

const LIKERT_OPTIONS = [
  { value: "0", label: "Not at all" },
  { value: "1", label: "Several days" },
  { value: "2", label: "More than half the days" },
  { value: "3", label: "Nearly every day" },
];

export default function SelfRegistrationAssessmentPage() {
  const { user, isRestoring } = useAuth();
  const router = useRouter();
  const dispatch = useAppDispatch();

  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [scales, setScales] = useState<ScaleQuestions[]>([]);
  const [scaleIndex, setScaleIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isRestoring) return;
    if (!user) { router.replace(ROUTES.LOGIN); return; }
    // Both self- and staff-registered patients go through this same wizard
    // (gated on registration_status, not self_registered) — only
    // requirement is being a patient with a resolved patient_id.
    if (!user.roles.includes("patient") || !user.patient_id) { router.replace(ROUTES.LOGIN); return; }

    (async () => {
      try {
        // localStorage is only set during the live disease-selection step and
        // cleared right after this step finishes — a re-login (or a cleared/
        // fresh browser) loses it even for a patient who already picked a
        // disease. Fall back to the disease-selection record itself instead
        // of erroring out.
        let diseaseId = localStorage.getItem("pcs_registration_disease_id");
        if (!diseaseId) {
          const selection = await patientsService.getPrimaryDiseaseSelection(user.patient_id!);
          diseaseId = selection?.disease_id ?? null;
        }
        if (!diseaseId) {
          setError("We lost track of your selected condition — please contact your clinic to continue.");
          setLoading(false);
          return;
        }

        const assignments = await patientsService.getScaleAssignments(user.patient_id!, "general_registration");
        if (assignments.length === 0) {
          setError("No assessment scales are set up for your condition yet — please contact your clinic.");
          return;
        }
        const { instance_id } = await prsAssessmentService.startGeneralRegistrationAssessment(user.patient_id!, diseaseId);
        setInstanceId(instance_id);
        const loaded = await Promise.all(
          assignments.map(async (a) => ({ scale_id: a.scale_id, questions: await prsService.getScaleQuestions(a.scale_id) })),
        );
        setScales(loaded.filter((s) => s.questions.length > 0));
      } catch (err: any) {
        setError(err?.response?.data?.error?.message || err?.response?.data?.detail || "Could not load your assessment.");
      } finally {
        setLoading(false);
      }
    })();
  }, [isRestoring, user, router]);

  const currentScale = scales[scaleIndex];
  const isLastScale = scaleIndex >= scales.length - 1;
  const allAnswered = currentScale?.questions.every((q) => !q.is_required || answers[q.question_id] !== undefined) ?? false;

  async function handleSubmitScale() {
    if (!instanceId || !currentScale) return;
    setSubmitting(true);
    setError(null);
    try {
      const scaleResponses: Record<string, string> = {};
      for (const q of currentScale.questions) {
        if (answers[q.question_id] !== undefined) scaleResponses[q.question_id] = answers[q.question_id];
      }
      await prsAssessmentService.submitAssessment(instanceId, currentScale.scale_id, scaleResponses);
      if (isLastScale) {
        localStorage.removeItem("pcs_registration_disease_id");
        // Staff-registered patients (approval_status='not_required') get
        // activated the instant registration_status reaches
        // registration_complete (patients/service.py::_complete_registration)
        // — no receptionist approval to wait on. Self-registered patients
        // stay inactive until that separate approval step. Re-check
        // is_active instead of always assuming "pending approval".
        const result = await dispatch(refreshUser());
        const isActive = refreshUser.fulfilled.match(result) ? result.payload?.is_active : false;
        router.push(isActive ? ROUTES.PATIENT_DASHBOARD : "/patient-registration/pending");
      } else {
        setScaleIndex((i) => i + 1);
        setAnswers({});
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.detail || "Failed to submit — please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isRestoring || loading) {
    return <div className="min-h-screen flex items-center justify-center text-neutral-400 text-sm">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow-card border border-neutral-200/80 p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-lg bg-brand-gradient flex items-center justify-center">
            <Brain className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-accent-dark">Anava PRS</span>
        </div>

        <h1 className="text-lg font-bold text-neutral-900 mb-1">Quick health questionnaire</h1>
        <p className="text-sm text-neutral-500 mb-6">
          Step 3 of 3{scales.length > 1 ? ` — section ${scaleIndex + 1} of ${scales.length}` : ""}.
        </p>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>}

        {currentScale && (
          <div className="space-y-5">
            {currentScale.questions.map((q) => (
              <div key={q.question_id}>
                <label className="block text-sm font-medium text-neutral-800 mb-2">{q.question_text}</label>
                {q.answer_type === "likert" || q.answer_type === "radio" || q.answer_type === "checkbox" ? (
                  <div className="grid grid-cols-4 gap-2">
                    {LIKERT_OPTIONS.map((o) => (
                      <label key={o.value} className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border cursor-pointer whitespace-nowrap ${answers[q.question_id] === o.value ? "border-primary-500 bg-primary-50" : "border-neutral-200 hover:bg-neutral-50"}`}>
                        <input
                          type="radio"
                          name={q.question_id}
                          checked={answers[q.question_id] === o.value}
                          onChange={() => setAnswers((prev) => ({ ...prev, [q.question_id]: o.value }))}
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                ) : q.answer_type === "number" || q.answer_type === "slider" ? (
                  <input
                    type="number"
                    min={q.min_value ?? undefined}
                    max={q.max_value ?? undefined}
                    value={answers[q.question_id] ?? ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.question_id]: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                ) : (
                  <input
                    type="text"
                    value={answers[q.question_id] ?? ""}
                    onChange={(e) => setAnswers((prev) => ({ ...prev, [q.question_id]: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                )}
              </div>
            ))}

            <div className="flex justify-end pt-2">
              <Button disabled={!allAnswered || submitting} onClick={handleSubmitScale}>
                {submitting ? "Submitting…" : isLastScale ? "Finish Registration" : "Next Section"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
