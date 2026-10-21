"use client";

import { useEffect, useRef, useState } from "react";
import { FileCheck2, Printer, X } from "lucide-react";
import { finalReportsService } from "@/lib/api/services";
import { extractErrorMessage } from "@/lib/api/errors";
import { printFinalReport } from "./printFinalReport";
import { FinalReportDocument } from "./FinalReportDocument";
import type { FinalReport, FinalReportMeta } from "@/types/finalReport.types";

export const SCOPE_SHORT: Record<string, string> = { overall: "Overall", last_consultation: "Last consultation" };

export function fmtReportDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** A signed report in a full-screen reader with Print. Read-only by nature:
 * the report is the frozen snapshot. */
export function FinalReportViewer({ reportId, onClose }: { reportId: string; onClose: () => void }) {
  const [report, setReport] = useState<FinalReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const docRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReport(null);
    setError(null);
    finalReportsService
      .get(reportId)
      .then(setReport)
      .catch((err) => setError(extractErrorMessage(err, "Could not load this report.")));
  }, [reportId]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-3 py-4">
      <div className="bg-neutral-100 rounded-2xl shadow-xl w-full max-w-4xl max-h-full flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-3 bg-white border-b border-neutral-200">
          <h3 className="text-base font-semibold text-neutral-900">Final Report</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                docRef.current &&
                report &&
                printFinalReport(docRef.current, { sections: report.snapshot, signature: report.signature, reportId: report.report_id })
              }
              disabled={!report}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-brand-gradient rounded-lg disabled:opacity-50"
            >
              <Printer className="w-3.5 h-3.5" /> Print / Save as PDF
            </button>
            <button onClick={onClose} aria-label="Close" className="p-1.5 text-neutral-400 hover:text-neutral-600 rounded-lg hover:bg-neutral-100">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="overflow-y-auto p-3 sm:p-5">
          {error ? (
            <p className="text-sm text-red-700 bg-red-50 rounded-lg p-4">{error}</p>
          ) : !report ? (
            <div className="h-64 bg-white rounded-lg animate-pulse" />
          ) : (
            <FinalReportDocument
              ref={docRef}
              sections={report.snapshot}
              diagnosis={report.diagnosis}
              signature={report.signature}
              reportId={report.report_id}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** Previous signed reports of one patient — doctor and admin views.
 * `refreshKey` lets a parent reload the list after signing a new one. */
export function PatientFinalReports({ patientId, refreshKey = 0 }: { patientId: string; refreshKey?: number }) {
  const [reports, setReports] = useState<FinalReportMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    finalReportsService
      .listForPatient(patientId)
      .then(setReports)
      .catch((err) => setError(extractErrorMessage(err, "Could not load final reports.")));
  }, [patientId, refreshKey]);

  if (error) return <p className="text-sm text-red-700 bg-red-50 rounded-lg p-4">{error}</p>;
  if (!reports) return <div className="h-14 bg-neutral-100 rounded-lg animate-pulse" />;
  if (reports.length === 0) return <p className="text-sm text-neutral-400 text-center py-6">No final reports signed yet</p>;

  return (
    <>
      <ul className="divide-y divide-neutral-100">
        {reports.map((r) => (
          <li key={r.report_id}>
            <button onClick={() => setOpenId(r.report_id)} className="w-full flex items-center gap-3 py-3 text-left hover:bg-neutral-50 px-1 rounded-lg">
              <FileCheck2 className="w-4 h-4 text-primary-500 flex-shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-neutral-900 truncate">{r.diagnosis}</span>
                <span className="block text-xs text-neutral-500">
                  {SCOPE_SHORT[r.scope] ?? r.scope} · Signed {fmtReportDate(r.signed_at)}
                  {r.doctor_name && ` · ${r.doctor_name}`}
                </span>
              </span>
              <span className="text-xs font-semibold text-primary-600 flex-shrink-0">View</span>
            </button>
          </li>
        ))}
      </ul>
      {openId && <FinalReportViewer reportId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}
