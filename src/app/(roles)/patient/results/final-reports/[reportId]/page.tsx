"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ChevronRight, Printer } from "lucide-react";
import toast from "react-hot-toast";
import { finalReportsService } from "@/lib/api/services";
import { extractErrorMessage } from "@/lib/api/errors";
import { useGoBack } from "@/lib/hooks";
import { printFinalReport } from "@/components/reports/printFinalReport";
import { PageSkeleton } from "@/components/ui";
import { FinalReportDocument } from "@/components/reports/FinalReportDocument";
import type { FinalReport } from "@/types/finalReport.types";

export default function PatientFinalReportPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const goBack = useGoBack("/patient/results?tab=final-reports");
  const [report, setReport] = useState<FinalReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const docRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finalReportsService
      .get(reportId)
      .then(setReport)
      .catch((err) => setError(extractErrorMessage(err, "Could not load this report.")));
  }, [reportId]);

  if (error) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <p className="text-neutral-500">{error}</p>
      </div>
    );
  }
  if (!report) return <PageSkeleton />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <button onClick={goBack} className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800">
          <ChevronRight className="h-4 w-4 rotate-180" /> Back
        </button>
        <button
          onClick={() => {
            const meta = { sections: report.snapshot, signature: report.signature, reportId: report.report_id };
            if (docRef.current && !printFinalReport(docRef.current, meta)) toast.error("Allow pop-ups for this site to print the report.");
          }}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-brand-gradient rounded-lg"
        >
          <Printer className="w-3.5 h-3.5" /> Print / Save as PDF
        </button>
      </div>
      <div className="border border-neutral-200">
        <FinalReportDocument
          ref={docRef}
          sections={report.snapshot}
          diagnosis={report.diagnosis}
          signature={report.signature}
          reportId={report.report_id}
        />
      </div>
    </div>
  );
}
