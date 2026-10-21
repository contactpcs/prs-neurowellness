"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileCheck2, ArrowUpRight, CalendarDays } from "lucide-react";
import { finalReportsService } from "@/lib/api/services";
import { extractErrorMessage } from "@/lib/api/errors";
import { Card, CardContent, Input } from "@/components/ui";
import { SCOPE_SHORT, fmtReportDate } from "./PatientFinalReports";
import type { FinalReportMeta, FinalReportScope } from "@/types/finalReport.types";

const SELECT = "h-10 rounded-lg border border-neutral-300 bg-white px-3 text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-primary-500/40";

/** The patient's own doctor-signed Final Reports, with filter and sort
 * (applied by the server — GET /me/final-reports). */
export function MyFinalReports() {
  const [scope, setScope] = useState<FinalReportScope | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [reports, setReports] = useState<FinalReportMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    finalReportsService
      .listMine({ scope: scope || undefined, date_from: dateFrom || undefined, date_to: dateTo || undefined, sort })
      .then((data) => !cancelled && setReports(data))
      .catch((err) => !cancelled && setError(extractErrorMessage(err, "Could not load your final reports.")));
    return () => {
      cancelled = true;
    };
  }, [scope, dateFrom, dateTo, sort]);

  const filtered = !!scope || !!dateFrom || !!dateTo;

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2 flex-wrap">
        <label className="text-xs text-neutral-500">
          <span className="block mb-1">Type</span>
          <select value={scope} onChange={(e) => setScope(e.target.value as FinalReportScope | "")} className={SELECT}>
            <option value="">All reports</option>
            <option value="overall">Overall</option>
            <option value="last_consultation">Last consultation</option>
          </select>
        </label>
        <label className="text-xs text-neutral-500">
          <span className="block mb-1">From</span>
          <Input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label className="text-xs text-neutral-500">
          <span className="block mb-1">To</span>
          <Input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} />
        </label>
        <label className="text-xs text-neutral-500">
          <span className="block mb-1">Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as "newest" | "oldest")} className={SELECT}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
        {filtered && (
          <button
            onClick={() => {
              setScope("");
              setDateFrom("");
              setDateTo("");
            }}
            className="h-10 text-xs font-medium text-neutral-500 hover:text-neutral-700"
          >
            Clear filters
          </button>
        )}
      </div>

      {error ? (
        <p className="text-sm text-red-700 bg-red-50 rounded-lg p-4">{error}</p>
      ) : !reports ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 bg-neutral-100 rounded-xl" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center text-center gap-2.5">
              <div className="h-11 w-11 rounded-full bg-neutral-100 flex items-center justify-center">
                <FileCheck2 className="h-5 w-5 text-neutral-400" />
              </div>
              <p className="text-sm font-medium text-neutral-700">{filtered ? "No final reports match these filters" : "No final reports yet"}</p>
              {!filtered && <p className="text-xs text-neutral-400 max-w-xs">A report appears here as soon as your doctor signs it.</p>}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <Card key={r.report_id}>
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900">{SCOPE_SHORT[r.scope] ?? r.scope} report</p>
                    <p className="text-xs text-neutral-600 mt-0.5 line-clamp-2">Diagnosis: {r.diagnosis}</p>
                    <p className="text-xs text-neutral-400 mt-1 flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" /> Signed {fmtReportDate(r.signed_at)}
                      {r.doctor_name && ` by ${r.doctor_name}`}
                    </p>
                  </div>
                  <Link
                    href={`/patient/results/final-reports/${r.report_id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700 flex-shrink-0"
                  >
                    Open report <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
