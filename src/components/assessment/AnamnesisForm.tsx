"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { CheckCircle, AlertCircle, Stethoscope, Loader2 } from "lucide-react";
import { anamnesisService, withResponses } from "@/lib/api/services/anamnesis.service";
import { AnamnesisReadOnlyView } from "@/components/assessment/AnamnesisReadOnlyView";
import { AnamnesisVersionPicker } from "@/components/assessment/AnamnesisVersionPicker";
import { useAppDispatch } from "@/store/hooks";
import { invalidateMyAnamnesis, invalidatePatientAnamnesis } from "@/store/slices/anamnesisSlice";
import { invalidateDashboard } from "@/store/slices/patientsSlice";
import type { AnamnesisQuestion, AnamnesisStage } from "@/lib/api/services/anamnesis.service";
import type { AnamnesisRecord } from "@/types/domain.types";

// ── types ─────────────────────────────────────────────────────────────────────

type ResponseMap = Record<string, { value: string; values: string[] }>;
type RecordState = "loading" | "no-record" | "in_progress" | "completed";

interface AnamnesisFormProps {
  patientId: string;
  mode: "patient" | "doctor";
  assessmentStage: AnamnesisStage;
  initialRecord?: AnamnesisRecord | null;
  onSubmitted?: () => void;
  /** True when the doctor is viewing this from a session that is NOT the
   * patient's current/latest one (e.g. looking at Consultation after
   * Follow-up 1 exists). The anamnesis GET endpoint only ever returns the
   * single latest version — there's no per-session history to fetch — so
   * recording a new one from a frozen session's view would create a new
   * version that then silently becomes "the" anamnesis shown everywhere,
   * including under the earlier session it doesn't belong to. Locking this
   * out is the only honest fix available without a backend history
   * endpoint. */
  lockedForSession?: boolean;
  /** The visit (appointment_id) this form is being recorded under, when
   *  known — passed through to anamnesisService.start() so the doctor
   *  portal's per-visit bundle can find this record later. Omit when no
   *  visit context applies (e.g. the patient's own self-service flow). */
  appointmentId?: string | null;
  /** This session's own appointment_date ("YYYY-MM-DD"), when known — the
   *  version picker only offers versions created on/after this date. An
   *  older version (recorded before this follow-up ever happened) belongs
   *  to an earlier session's own frozen view, not to this one; without this
   *  bound the picker let a doctor "look back" past this session's own
   *  start, which reads as this session having an anamnesis it never had. */
  sessionDate?: string | null;
}

// ── helpers ───────────────────────────────────────────────────────────────────

function groupBySection(questions: AnamnesisQuestion[]) {
  const map: Record<number, { number: number; title: string; questions: AnamnesisQuestion[] }> = {};
  for (const q of questions) {
    if (!map[q.section_number]) {
      map[q.section_number] = { number: q.section_number, title: q.section_title, questions: [] };
    }
    map[q.section_number].questions.push(q);
  }
  return Object.values(map).sort((a, b) => a.number - b.number);
}

function isVisible(q: AnamnesisQuestion, responses: ResponseMap): boolean {
  if (!q.depends_on_question_id) return true;
  return responses[q.depends_on_question_id]?.value === q.depends_on_value;
}

function hydrateResponses(record: AnamnesisRecord): ResponseMap {
  const out: ResponseMap = {};
  for (const r of record.responses ?? []) {
    out[r.question_id] = {
      value: r.response_value ?? "",
      values: r.response_values ?? [],
    };
  }
  return out;
}

const SEC_ICON: Record<number, string> = {
  1: "", 2: "", 3: "", 4: "", 5: "", 6: "", 7: "", 8: "",
};

// ── question field ────────────────────────────────────────────────────────────

const inputCls =
  "w-full px-3 py-2.5 border border-neutral-200 rounded-lg text-sm outline-none transition-colors focus:border-orange-500 focus:ring-1 focus:ring-orange-100 disabled:bg-neutral-50 disabled:text-neutral-500 disabled:cursor-default";
const textareaCls = `${inputCls} min-h-[88px] resize-y`;

function QuestionField({
  q, response, onChange, readOnly,
}: {
  q: AnamnesisQuestion;
  response: { value: string; values: string[] } | undefined;
  onChange: (questionId: string, value: string | null, values: string[] | null) => void;
  readOnly: boolean;
}) {
  const val  = response?.value  ?? "";
  const vals = response?.values ?? [];

  if (q.answer_type === "radio") {
    return (
      <div className="flex flex-wrap gap-5 mt-1">
        {q.options.map((o) => (
          <label
            key={o.option_value}
            className={`flex items-center gap-2 text-sm text-neutral-700 ${readOnly ? "cursor-default" : "cursor-pointer"}`}
          >
            <input
              type="radio"
              name={q.question_id}
              value={o.option_value}
              checked={val === o.option_value}
              disabled={readOnly}
              onChange={() => !readOnly && onChange(q.question_id, o.option_value, null)}
              className="w-3.5 h-3.5 accent-orange-500"
            />
            {o.option_label}
          </label>
        ))}
      </div>
    );
  }

  if (q.answer_type === "select") {
    return (
      <select
        value={val}
        disabled={readOnly}
        onChange={(e) => onChange(q.question_id, e.target.value, null)}
        className={inputCls}
      >
        <option value="">Select an option…</option>
        {q.options.map((o) => (
          <option key={o.option_value} value={o.option_value}>{o.option_label}</option>
        ))}
      </select>
    );
  }

  if (q.answer_type === "checkbox") {
    const toggle = (v: string) => {
      if (readOnly) return;
      const next = vals.includes(v) ? vals.filter((x) => x !== v) : [...vals, v];
      onChange(q.question_id, null, next);
    };
    return (
      <div className="grid grid-cols-2 gap-2 mt-1">
        {q.options.map((o) => (
          <label
            key={o.option_value}
            className={`flex items-center gap-2 p-1.5 rounded text-sm text-neutral-700 ${readOnly ? "cursor-default" : "cursor-pointer hover:bg-neutral-50"}`}
          >
            <input
              type="checkbox"
              checked={vals.includes(o.option_value)}
              disabled={readOnly}
              onChange={() => toggle(o.option_value)}
              className="w-3.5 h-3.5 accent-orange-500"
            />
            {o.option_label}
          </label>
        ))}
      </div>
    );
  }

  if (q.answer_type === "textarea") {
    return (
      <textarea
        value={val}
        readOnly={readOnly}
        placeholder={readOnly ? "" : (q.helper_text ?? "")}
        onChange={(e) => onChange(q.question_id, e.target.value, null)}
        className={textareaCls}
      />
    );
  }

  // text / conditional_text / default
  return (
    <input
      type="text"
      value={val}
      readOnly={readOnly}
      placeholder={readOnly ? "" : (q.helper_text ?? "")}
      onChange={(e) => onChange(q.question_id, e.target.value, null)}
      className={inputCls}
    />
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function AnamnesisForm({ patientId, mode, assessmentStage, initialRecord, onSubmitted, lockedForSession = false, appointmentId = null, sessionDate = null }: AnamnesisFormProps) {
  const dispatch = useAppDispatch();
  const [questions,   setQuestions]   = useState<AnamnesisQuestion[]>([]);
  const [sections,    setSections]    = useState<ReturnType<typeof groupBySection>>([]);
  const [responses,   setResponses]   = useState<ResponseMap>({});
  const [record,      setRecord]      = useState<AnamnesisRecord | null>(initialRecord ?? null);
  const [anamnesisId, setAnamnesisId] = useState<string | null>(initialRecord?.anamnesis_id ?? null);
  const [meta,        setMeta]        = useState<{ completed_at: string | null; taken_by: string } | null>(
    initialRecord ? { completed_at: initialRecord.completed_at, taken_by: initialRecord.taken_by } : null
  );
  const [recordState, setRecordState] = useState<RecordState>(() => {
    if (initialRecord === undefined) return "loading";
    if (initialRecord === null)      return mode === "doctor" ? "no-record" : "loading";
    return initialRecord.status === "completed" ? "completed" : "in_progress";
  });
  const [saving,     setSaving]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  // ── version history (doctor view only) ────────────────────────────────────
  // start() always creates a new version rather than overwriting the one
  // being edited (see handleStartOnBehalf below) — this is what lets a
  // doctor look back at what an earlier version said instead of only ever
  // seeing whatever is currently latest.
  const [versions,          setVersions]          = useState<AnamnesisRecord[]>([]);
  const [viewedVersionId,   setViewedVersionId]    = useState<string | null>(null);
  const [viewedVersion,     setViewedVersion]      = useState<AnamnesisRecord | null>(null);
  const [versionLoading,    setVersionLoading]     = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── fetch questions + record ───────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const fetchRecord = (): Promise<AnamnesisRecord | null> => {
      if (initialRecord !== undefined) {
        return Promise.resolve(initialRecord);
      }
      const getter =
        mode === "patient"
          ? anamnesisService.getMyAnamnesis(assessmentStage)
          : anamnesisService.getForPatient(patientId, assessmentStage);
      return getter.catch((e: { response?: { status?: number } }) =>
        e?.response?.status === 404 ? null : Promise.reject(e)
      );
    };

    Promise.all([anamnesisService.getQuestions(assessmentStage), fetchRecord()])
      .then(([qs, record]) => {
        if (cancelled) return;
        setQuestions(qs);
        setSections(groupBySection(qs));

        if (record) {
          setRecord(record);
          setAnamnesisId(record.anamnesis_id);
          setMeta({ completed_at: record.completed_at, taken_by: record.taken_by });
          setResponses(hydrateResponses(record));
          setRecordState(record.status === "completed" ? "completed" : "in_progress");
        } else {
          // no record found
          setRecordState(mode === "doctor" ? "no-record" : "loading");
        }
      })
      .catch(() => {
        if (cancelled) return;
        // For doctor view, treat any load failure as "not started yet" —
        // the Start on Behalf button will surface any real errors when clicked.
        if (mode !== "doctor") {
          setError("Failed to load anamnesis. Please refresh.");
        }
        setRecordState("no-record");
      });

    return () => { cancelled = true; };
  // initialRecord is in the deps so a parent that resolves its record fetch
  // AFTER this form mounts (e.g. the doctor page's Redux-cached anamnesis)
  // re-syncs the form instead of leaving it stuck on the no-record state.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, mode, assessmentStage, initialRecord]);

  // ── version history (doctor view, completed record only) ──────────────────
  // Only on the CURRENT session's view, never a frozen one — a frozen
  // session (e.g. viewing Consultation from Follow-up 1's page) already
  // gets exactly the right version via visitSummary.anamnesis
  // (get_by_appointment, resolved server-side per appointment_id); letting
  // the picker switch versions there would show that visit a LATER edit it
  // never actually had, which is the opposite of what "frozen" means.
  useEffect(() => {
    if (mode !== "doctor" || recordState !== "completed" || lockedForSession) { setVersions([]); return; }
    let cancelled = false;
    anamnesisService.listVersions(patientId, assessmentStage)
      .then((list) => {
        if (cancelled) return;
        // Bound to this session's own date forward — a version recorded
        // before this follow-up ever happened belongs to an earlier
        // session's own view, not to "history you can look back at" from
        // here (that earlier session already shows it, frozen, on its own).
        const bounded = sessionDate
          ? list.filter((v) => (v.completed_at ?? v.created_at ?? "").slice(0, 10) >= sessionDate)
          : list;
        setVersions(bounded);
      })
      .catch(() => { if (!cancelled) setVersions([]); });
    return () => { cancelled = true; };
  }, [mode, recordState, lockedForSession, patientId, assessmentStage, sessionDate]);

  // Default to viewing the current/latest version once it (and the record
  // it belongs to) are known — resets to it whenever the underlying record
  // changes (e.g. right after a new version is started+submitted).
  useEffect(() => {
    setViewedVersionId(record?.anamnesis_id ?? null);
    setViewedVersion(record ?? null);
  }, [record]);

  const handleSelectVersion = useCallback((id: string) => {
    setViewedVersionId(id);
    if (id === record?.anamnesis_id) { setViewedVersion(record); return; }
    const summary = versions.find((v) => v.anamnesis_id === id);
    if (!summary) return;
    setVersionLoading(true);
    withResponses(summary)
      .then(setViewedVersion)
      .catch(() => setViewedVersion(summary))
      .finally(() => setVersionLoading(false));
  }, [record, versions]);

  // ── auto-start for patient when no record ─────────────────────────────────
  useEffect(() => {
    // "loading" after questions are fetched = patient has no record
    if (recordState !== "loading" || mode !== "patient" || questions.length === 0) return;

    anamnesisService
      .start({ patient_id: patientId, taken_by: "patient", assessment_stage: assessmentStage })
      .then((r) => {
        setAnamnesisId(r.anamnesis_id);
        setMeta({ completed_at: null, taken_by: "patient" });
        setRecordState("in_progress");
      })
      .catch((e: { response?: { data?: { detail?: string } } }) => {
        setError(e?.response?.data?.detail ?? "Failed to start anamnesis. Please refresh.");
        setRecordState("no-record");
      });
  }, [recordState, mode, questions.length, patientId, assessmentStage]);

  // ── per-question auto-save (600 ms debounce) ──────────────────────────────
  const handleChange = useCallback((questionId: string, value: string | null, values: string[] | null) => {
    if (recordState === "completed") return;

    setResponses((prev) => ({
      ...prev,
      [questionId]: { value: value ?? "", values: values ?? [] },
    }));

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (!anamnesisId) return;
      setSaving(true);
      try {
        await anamnesisService.saveResponse({
          anamnesis_id:    anamnesisId,
          question_id:     questionId,
          response_value:  value   ?? null,
          response_values: values  ?? null,
        });
      } catch { /* silent — will be caught on submit if needed */ }
      finally { setSaving(false); }
    }, 600);
  }, [anamnesisId, recordState]);

  // ── submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setError("");

    const missing = questions.filter(
      (q) =>
        q.is_required &&
        isVisible(q, responses) &&
        !responses[q.question_id]?.value &&
        !(responses[q.question_id]?.values?.length)
    );
    if (missing.length) {
      setError(
        `Please answer all required questions. Missing: ${missing
          .map((q) => `"${q.question_text.slice(0, 40)}"`)
          .join(", ")}`
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    if (!anamnesisId) return;
    setSubmitting(true);
    try {
      await anamnesisService.submit({ anamnesis_id: anamnesisId });
      const completedAt = new Date().toISOString();
      setMeta((prev) => ({ ...(prev ?? { taken_by: mode === "doctor" ? "doctor_on_behalf" : "patient" }), completed_at: completedAt }));
      // Build an updated record with all current responses so AnamnesisReadOnlyView renders them
      setRecord((prev) => ({
        ...(prev ?? {
          anamnesis_id: anamnesisId,
          patient_id: patientId,
          submitted_by: null,
          taken_by: mode === "doctor" ? "doctor_on_behalf" : "patient",
          assessment_stage: assessmentStage,
          chief_complaint: null, main_symptoms: null, initial_symptoms: null,
          diagnosis_related: null, diagnosis_details: null, symptoms_start: null,
          symptoms_duration: null, symptoms_frequency: null, symptoms_intensity: null,
          symptoms_progression: null, secondary_symptoms: null, secondary_symptoms_details: null,
          has_operations: null, operations_details: null, previous_treatments: null,
          current_medications: null, has_brain_mri: null, mri_details: null,
          other_scans: null, has_neuromodulation: null, neuromodulation_details: null,
          created_at: completedAt, updated_at: completedAt,
        }),
        status: "completed" as const,
        completed_at: completedAt,
        responses: Object.entries(responses).map(([question_id, r]) => ({
          question_id,
          response_value: r.value || null,
          response_values: r.values.length > 0 ? r.values : null,
        })),
      }));
      setRecordState("completed");
      if (mode === "patient") {
        dispatch(invalidateMyAnamnesis(assessmentStage));
        dispatch(invalidateDashboard());
      } else {
        dispatch(invalidatePatientAnamnesis({ patientId, stage: assessmentStage }));
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
      onSubmitted?.();
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── doctor: start on behalf ───────────────────────────────────────────────
  // Always creates a BRAND NEW anamnesis_id (a new version) — never reopens
  // an existing completed record for editing. Completed anamnesis rows are
  // frozen; new clinical information from a later session becomes a new
  // version instead, so `60 -> 45 -> 35`-style history is never lost.
  const handleStartOnBehalf = async () => {
    setError("");
    try {
      // Fetch questions alongside start if not already loaded
      const [r, qs] = await Promise.all([
        anamnesisService.start({
          patient_id: patientId,
          taken_by: "doctor_on_behalf",
          assessment_stage: assessmentStage,
          appointment_id: appointmentId,
        }),
        questions.length === 0 ? anamnesisService.getQuestions(assessmentStage).catch(() => [] as AnamnesisQuestion[]) : Promise.resolve(questions),
      ]);
      if (questions.length === 0 && qs.length > 0) {
        setQuestions(qs);
        setSections(groupBySection(qs));
      }
      setAnamnesisId(r.anamnesis_id);
      setMeta({ completed_at: null, taken_by: "doctor_on_behalf" });
      setRecord(null);
      setResponses({});
      setRecordState("in_progress");
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Failed to start anamnesis on behalf of patient.");
    }
  };

  // ── render: early states ─────────────────────────────────────────────────

  if (recordState === "loading" && questions.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-7 h-7 text-orange-500 animate-spin" />
      </div>
    );
  }

  if (recordState === "no-record" && mode === "doctor") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center">
          <Stethoscope className="w-7 h-7 text-neutral-400" />
        </div>
        <div>
          <p className="font-semibold text-neutral-800">Anamnesis not started</p>
          <p className="text-sm text-neutral-500 mt-1">
            {lockedForSession
              ? "The patient had not yet begun their medical history intake as of this session."
              : "The patient has not yet begun their medical history intake. You can start it on their behalf."}
          </p>
        </div>
        {error && <p className="text-sm text-red-600 max-w-xs">{error}</p>}
        {!lockedForSession && (
          <Button onClick={handleStartOnBehalf}>
            <Stethoscope className="w-4 h-4" /> Start on Patient's Behalf
          </Button>
        )}
      </div>
    );
  }

  if (recordState === "no-record" && mode === "patient") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <p className="font-semibold text-neutral-800">Could not start anamnesis</p>
        <p className="text-sm text-red-600">{error || "Unknown error. Please refresh."}</p>
      </div>
    );
  }

  // Doctor: edit while in_progress, read-only after submit
  // Patient: edit while in_progress, read-only after submit
  // Also forced read-only when viewing a frozen (non-latest) session, even
  // for a dangling in-progress draft — see lockedForSession above.
  const readOnly  = recordState === "completed" || (mode === "doctor" && lockedForSession);
  const completed = recordState === "completed";

  // Show read-only summary view when completed
  if (completed && record) {
    const shown = viewedVersion ?? record;
    const viewingLatest = shown.anamnesis_id === record.anamnesis_id;
    return (
      <>
        {lockedForSession && (
          <div className="mb-4 flex items-start gap-2 bg-neutral-100 border border-neutral-200 rounded-lg px-4 py-3 text-sm text-neutral-600">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-neutral-400" />
            This session is frozen. Showing the latest anamnesis on record — new anamnesis can only be recorded from the patient&apos;s current session.
          </div>
        )}
        {mode === "doctor" && !lockedForSession && versions.length > 1 && (
          <AnamnesisVersionPicker
            versions={versions}
            selectedId={viewedVersionId}
            onSelect={handleSelectVersion}
            loading={versionLoading}
          />
        )}
        {!viewingLatest && (
          <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            Viewing version {shown.version} — an earlier record, kept as history. It is read-only; editing always starts from the current version.
          </div>
        )}
        <AnamnesisReadOnlyView
          record={shown}
          questions={questions}
          takenBy={shown.taken_by}
          onEdit={mode === "doctor" && !lockedForSession && viewingLatest ? handleStartOnBehalf : undefined}
          editLabel="Edit"
        />
      </>
    );
  }

  return (
    <div className="space-y-5">

      {mode === "doctor" && lockedForSession && (
        <div className="flex items-start gap-2 bg-neutral-100 border border-neutral-200 rounded-lg px-4 py-3 text-sm text-neutral-600">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-neutral-400" />
          This session is frozen — showing the anamnesis on record as read-only.
        </div>
      )}

      {/* Header */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl px-5 py-4 flex items-center gap-3.5">
        <span className="text-2xl flex-shrink-0">🩺</span>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-neutral-900">Anamnesis Assessment</h1>
            {completed && (
              <span className="flex items-center gap-1 px-2.5 py-0.5 bg-green-100 text-green-700 text-xs font-semibold rounded-full border border-green-200">
                <CheckCircle className="w-3 h-3" /> Completed
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 mt-0.5">Patient Symptoms &amp; Medical History</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Sections */}
      {sections.map((sec) => (
        <div key={sec.number} className="bg-white rounded-xl border border-neutral-200 shadow-sm p-5 space-y-5">
          <div className="flex items-center gap-2.5 pb-3.5 border-b-2 border-orange-500">
            <div className="w-6 h-6 rounded-full bg-orange-500 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
              {sec.number}
            </div>
            <h3 className="text-sm font-bold text-neutral-900">
              {SEC_ICON[sec.number]} {sec.title}
            </h3>
          </div>

          {sec.questions
            .filter((q) => isVisible(q, responses))
            .map((q) => (
              <div key={q.question_id}>
                <label className="block text-sm font-semibold text-neutral-700 mb-1.5">
                  {q.question_text}
                  {q.is_required && !readOnly && <span className="text-red-500 ml-1">*</span>}
                </label>
                <QuestionField
                  q={q}
                  response={responses[q.question_id]}
                  onChange={handleChange}
                  readOnly={readOnly}
                />
                {q.helper_text &&
                  q.answer_type !== "text" &&
                  q.answer_type !== "textarea" &&
                  q.answer_type !== "conditional_text" && (
                    <p className="text-xs text-neutral-400 mt-1">{q.helper_text}</p>
                  )}
              </div>
            ))}
        </div>
      ))}

      {/* Footer — patient in_progress only */}
      {!readOnly && (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm px-5 py-4 flex items-center justify-end gap-3">
          {saving && (
            <span className="flex items-center gap-1.5 text-xs text-neutral-400 mr-auto">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Auto-saving…
            </span>
          )}
          <Button
            onClick={handleSubmit}
            isLoading={submitting}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            ✓ Submit Anamnesis
          </Button>
        </div>
      )}
    </div>
  );
}
