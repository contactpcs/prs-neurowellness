"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { CheckCircle, Lock, AlertCircle, Stethoscope, Loader2 } from "lucide-react";
import { anamnesisService } from "@/lib/api/services/anamnesis.service";
import { AnamnesisReadOnlyView } from "@/components/assessment/AnamnesisReadOnlyView";
import type { AnamnesisQuestion } from "@/lib/api/services/anamnesis.service";
import type { AnamnesisRecord, PatientDetail } from "@/types/domain.types";

// ── types ─────────────────────────────────────────────────────────────────────

type ResponseMap = Record<string, { value: string; values: string[] }>;
type RecordState = "loading" | "no-record" | "in_progress" | "completed";

interface AnamnesisFormProps {
  patientId: string;
  patient?: PatientDetail;
  mode: "patient" | "doctor";
  initialRecord?: AnamnesisRecord | null;
  onSubmitted?: () => void;
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

function fmt(ts: string | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
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

export function AnamnesisForm({ patientId, patient, mode, initialRecord, onSubmitted }: AnamnesisFormProps) {
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
          ? anamnesisService.getMyAnamnesis()
          : anamnesisService.getForPatient(patientId);
      return getter.catch((e: { response?: { status?: number } }) =>
        e?.response?.status === 404 ? null : Promise.reject(e)
      );
    };

    Promise.all([anamnesisService.getQuestions(), fetchRecord()])
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
        setError("Failed to load anamnesis. Please refresh.");
        setRecordState("no-record");
      });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, mode]);

  // ── auto-start for patient when no record ─────────────────────────────────
  useEffect(() => {
    // "loading" after questions are fetched = patient has no record
    if (recordState !== "loading" || mode !== "patient" || questions.length === 0) return;

    anamnesisService
      .start({ patient_id: patientId, taken_by: "patient" })
      .then((r) => {
        setAnamnesisId(r.anamnesis_id);
        setMeta({ completed_at: null, taken_by: "patient" });
        setRecordState("in_progress");
      })
      .catch((e: { response?: { data?: { detail?: string } } }) => {
        setError(e?.response?.data?.detail ?? "Failed to start anamnesis. Please refresh.");
        setRecordState("no-record");
      });
  }, [recordState, mode, questions.length, patientId]);

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
      setMeta((prev) => ({ ...(prev ?? { taken_by: "patient" }), completed_at: new Date().toISOString() }));
      setRecordState("completed");
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
  const handleStartOnBehalf = async () => {
    setError("");
    try {
      // Fetch questions alongside start if not already loaded
      const [r, qs] = await Promise.all([
        anamnesisService.start({ patient_id: patientId, taken_by: "doctor_on_behalf" }),
        questions.length === 0 ? anamnesisService.getQuestions().catch(() => [] as AnamnesisQuestion[]) : Promise.resolve(questions),
      ]);
      if (questions.length === 0 && qs.length > 0) {
        setQuestions(qs);
        setSections(groupBySection(qs));
      }
      setAnamnesisId(r.anamnesis_id);
      setMeta({ completed_at: null, taken_by: "doctor_on_behalf" });
      setRecordState("in_progress");
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? "Failed to start anamnesis on behalf of patient.");
    }
  };

  // ── render: early states ─────────────────────────────────────────────────

  // Show spinner only while the initial data is still loading
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
          <p className="font-semibold text-neutral-800">No anamnesis record found</p>
          <p className="text-sm text-neutral-500 mt-1">The patient has not yet completed their medical history intake.</p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button onClick={handleStartOnBehalf}>
          <Stethoscope className="w-4 h-4" /> Start on Patient's Behalf
        </Button>
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

  // Doctor filling on behalf (taken_by='doctor_on_behalf', in_progress) → editable
  // Doctor viewing patient's own record or any completed record → read-only
  const isFillingOnBehalf =
    mode === "doctor" &&
    meta?.taken_by === "doctor_on_behalf" &&
    recordState === "in_progress";
  const readOnly  = recordState === "completed" || (mode === "doctor" && !isFillingOnBehalf);
  const completed = recordState === "completed";

  // Show read-only summary view when completed
  if (completed && record) {
    return <AnamnesisReadOnlyView record={record} questions={questions} takenBy={meta?.taken_by} />;
  }

  return (
    <div className="space-y-5">

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

      {/* Read-only notice (doctor in_progress) */}
      {readOnly && !completed && (
        <div className="flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-2.5 text-xs text-neutral-500">
          <Lock className="w-3.5 h-3.5 flex-shrink-0" /> Viewing in read-only mode
        </div>
      )}

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
