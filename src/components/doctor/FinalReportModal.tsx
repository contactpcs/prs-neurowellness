"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Printer, Lock, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { finalReportsService } from "@/lib/api/services";
import { extractErrorMessage } from "@/lib/api/errors";
import { printElement } from "@/lib/utils/printElement";
import { FinalReportDocument } from "@/components/reports/FinalReportDocument";
import { PatientFinalReports } from "@/components/reports/PatientFinalReports";
import type { FinalReport, FinalReportPreview, FinalReportScope } from "@/types/finalReport.types";

const SCOPES: { value: FinalReportScope; label: string; hint: string }[] = [
  { value: "overall", label: "Overall", hint: "From the start of treatment to today" },
  { value: "last_consultation", label: "Last consultation", hint: "Only the most recent consultation" },
];

/** Doctor generates a Final Report: pick the scope, type the diagnosis, tick
 * the notes to include, confirm the signature. Signing stores the report
 * (it can never be edited afterwards), releases it to the patient and opens
 * the print dialog. Until then nothing is saved — the document shown is a
 * live preview. */
export function FinalReportModal({
  patientId,
  patientName,
  defaultScope,
  onClose,
  onSigned,
}: {
  patientId: string;
  patientName: string;
  defaultScope: FinalReportScope;
  onClose: () => void;
  onSigned?: (report: FinalReport) => void;
}) {
  const [scope, setScope] = useState<FinalReportScope>(defaultScope);
  const [preview, setPreview] = useState<FinalReportPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState("");
  const [noteIds, setNoteIds] = useState<Set<string>>(new Set());
  const [confirmed, setConfirmed] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signed, setSigned] = useState<FinalReport | null>(null);
  const [showPrevious, setShowPrevious] = useState(false);
  const docRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setPreview(null);
    setLoadError(null);
    finalReportsService
      .preview(patientId, scope)
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
        setNoteIds(new Set(data.note_candidates.filter((n) => n.in_scope).map((n) => n.note_id)));
      })
      .catch((err) => !cancelled && setLoadError(extractErrorMessage(err, "Could not build the report.")));
    return () => {
      cancelled = true;
    };
  }, [patientId, scope]);

  const selectedNotes = useMemo(() => (preview?.note_candidates ?? []).filter((n) => noteIds.has(n.note_id)), [preview, noteIds]);
  const doctorName = preview?.sections.doctor?.name ?? "the doctor";
  const canSign = !!preview && diagnosis.trim().length > 0 && confirmed && !signing;

  const toggleNote = (noteId: string) =>
    setNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });

  const print = () => {
    if (docRef.current && !printElement(docRef.current, `Final Report — ${patientName}`)) {
      toast.error("Allow pop-ups for this site to print the report.");
    }
  };

  async function handleSign() {
    if (!canSign) return;
    setSigning(true);
    try {
      const report = await finalReportsService.sign(patientId, {
        scope,
        diagnosis: diagnosis.trim(),
        note_ids: Array.from(noteIds),
        confirm_sign: true,
      });
      setSigned(report);
      onSigned?.(report);
      toast.success("Final report signed and shared with the patient.");
      // Let the signed document render before it is copied to the print window.
      setTimeout(print, 100);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not sign the report."));
    } finally {
      setSigning(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-3 py-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl max-h-full flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-neutral-100">
          <div>
            <h3 className="text-base font-semibold text-neutral-900">Final Report — {patientName}</h3>
            <p className="text-xs text-neutral-500">
              {signed ? "Signed and locked. The patient can now see it under My Results." : "Preview only — nothing is saved until you sign."}
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
          {/* Controls */}
          {!signed && (
            <div className="lg:w-80 flex-shrink-0 border-b lg:border-b-0 lg:border-r border-neutral-100 overflow-y-auto p-5 space-y-5">
              <fieldset>
                <legend className="text-xs font-semibold text-neutral-700 mb-2">Report covers</legend>
                <div className="space-y-2">
                  {SCOPES.map((option) => (
                    <label
                      key={option.value}
                      className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer ${
                        scope === option.value ? "border-primary-500 bg-primary-50" : "border-neutral-200 hover:bg-neutral-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="final-report-scope"
                        className="mt-0.5"
                        checked={scope === option.value}
                        onChange={() => setScope(option.value)}
                      />
                      <span>
                        <span className="block text-sm font-medium text-neutral-900">{option.label}</span>
                        <span className="block text-xs text-neutral-500">{option.hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="final-report-diagnosis" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  Diagnosis <span className="text-red-600">*</span>
                </label>
                <textarea
                  id="final-report-diagnosis"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  rows={3}
                  maxLength={2000}
                  placeholder="e.g. MDD + mild psychotic episodes"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/40"
                />
              </div>

              <fieldset>
                <legend className="text-xs font-semibold text-neutral-700 mb-1.5">Doctor&apos;s notes to include</legend>
                {!preview ? (
                  <div className="h-10 bg-neutral-100 rounded-lg animate-pulse" />
                ) : preview.note_candidates.length === 0 ? (
                  <p className="text-xs text-neutral-400">No notes recorded for this patient.</p>
                ) : (
                  <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                    {preview.note_candidates.map((note) => (
                      <label key={note.note_id} className="flex items-start gap-2 text-xs text-neutral-700 cursor-pointer">
                        <input type="checkbox" className="mt-0.5" checked={noteIds.has(note.note_id)} onChange={() => toggleNote(note.note_id)} />
                        <span className="min-w-0">
                          <span className="block text-[11px] text-neutral-500">
                            {note.category} · {new Date(note.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                          <span className="block line-clamp-2">{note.note_text}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>

              <label className="flex items-start gap-2.5 rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2.5 cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                <span className="text-xs text-neutral-700">
                  I confirm this report is accurate and sign it as <b>{doctorName}</b>. Once signed it is locked and shared with the patient.
                </span>
              </label>

              <button onClick={() => setShowPrevious((v) => !v)} className="text-xs font-semibold text-primary-600 hover:text-primary-700">
                {showPrevious ? "Hide previous reports" : "View previous reports"}
              </button>
              {showPrevious && <PatientFinalReports patientId={patientId} />}
            </div>
          )}

          {/* Document */}
          <div className="flex-1 min-w-0 overflow-y-auto bg-neutral-100 p-3 sm:p-5">
            {loadError ? (
              <p className="text-sm text-red-700 bg-red-50 rounded-lg p-4">{loadError}</p>
            ) : signed ? (
              <FinalReportDocument
                ref={docRef}
                sections={signed.snapshot}
                diagnosis={signed.diagnosis}
                signature={signed.signature}
                contentHash={signed.content_hash}
              />
            ) : !preview ? (
              <div className="h-96 bg-white rounded-lg animate-pulse" />
            ) : (
              <FinalReportDocument ref={docRef} sections={preview.sections} diagnosis={diagnosis} notes={selectedNotes} signature={null} />
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-neutral-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg">
            Close
          </button>
          {signed ? (
            <button onClick={print} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-brand-gradient rounded-lg">
              <Printer className="w-3.5 h-3.5" /> Print / Save as PDF
            </button>
          ) : (
            <button
              onClick={handleSign}
              disabled={!canSign}
              title={!diagnosis.trim() ? "Enter the diagnosis first" : !confirmed ? "Tick the confirmation to sign" : undefined}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-brand-gradient rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {signing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />} Sign &amp; Print
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
