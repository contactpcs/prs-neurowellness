"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, ChevronDown, Activity, CalendarDays, ArrowUpRight, Search } from "lucide-react";
import { useMyScores } from "@/lib/hooks";
import { PageLoader, Card, CardContent, Input } from "@/components/ui";

function severityTone(level?: string): string {
  switch (level?.toLowerCase()) {
    case "mild":     return "bg-amber-50 text-amber-700 border-amber-200";
    case "moderate": return "bg-orange-50 text-orange-700 border-orange-200";
    case "severe":   return "bg-danger-50 text-danger-700 border-danger-200";
    case "normal":
    case "none":     return "bg-success-50 text-success-700 border-success-200";
    default:         return "bg-neutral-100 text-neutral-600 border-neutral-200";
  }
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function PatientResultsPage() {
  const { scores: instances, isLoading } = useMyScores();
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");

  const toggle = (id: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return instances.filter((inst) => {
      const matchesQuery = !q || `${inst.disease_name ?? ""} ${inst.disease_id} ${inst.severity_label ?? ""}`.toLowerCase().includes(q);
      // completed_at is a full ISO timestamp — compare only the date portion
      // against the <input type="date"> value, which is plain YYYY-MM-DD.
      const matchesDate = !dateFilter || (inst.completed_at ? inst.completed_at.slice(0, 10) === dateFilter : false);
      return matchesQuery && matchesDate;
    });
  }, [instances, search, dateFilter]);

  if (isLoading) return <PageLoader />;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">My Results</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Your completed assessment scores, most recent first.</p>
        </div>
        {instances.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input
                placeholder="Search condition or severity…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="w-36">
              <Input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} title="Filter by completion date" />
            </div>
            {dateFilter && (
              <button
                onClick={() => setDateFilter("")}
                className="text-xs font-medium text-neutral-500 hover:text-neutral-700 whitespace-nowrap"
              >
                Clear date
              </button>
            )}
          </div>
        )}
      </div>

      {instances.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center text-center gap-2.5">
              <div className="h-11 w-11 rounded-full bg-neutral-100 flex items-center justify-center">
                <ClipboardList className="h-5 w-5 text-neutral-400" />
              </div>
              <p className="text-sm font-medium text-neutral-700">No completed assessments yet</p>
              <p className="text-xs text-neutral-400 max-w-xs">
                Results appear here once you finish an assigned assessment.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center text-center gap-2.5">
              <div className="h-11 w-11 rounded-full bg-neutral-100 flex items-center justify-center">
                <Search className="h-5 w-5 text-neutral-400" />
              </div>
              <p className="text-sm font-medium text-neutral-700">No results match your search</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((inst) => {
            const isOpen = openIds.has(inst.instance_id);
            const hasScales = !!inst.scale_summaries && inst.scale_summaries.length > 0;
            return (
              <Card key={inst.instance_id} className="overflow-hidden">
                <button
                  type="button"
                  onClick={() => hasScales && toggle(inst.instance_id)}
                  disabled={!hasScales}
                  className={`w-full text-left ${hasScales ? "cursor-pointer" : "cursor-default"}`}
                  aria-expanded={hasScales ? isOpen : undefined}
                >
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-900 truncate">
                          {inst.disease_name ?? inst.disease_id}
                        </p>
                        {inst.completed_at && (
                          <p className="text-xs text-neutral-400 mt-1 flex items-center gap-1.5">
                            <CalendarDays className="h-3.5 w-3.5" /> Completed {fmtDate(inst.completed_at)}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 flex-shrink-0">
                        {inst.disease_score != null && (
                          <p className="text-lg font-bold text-neutral-900 leading-none">
                            {inst.disease_score.toFixed(0)}
                            {inst.percentage != null && (
                              <span className="text-neutral-400 font-normal text-xs ml-1">({inst.percentage.toFixed(0)}%)</span>
                            )}
                          </p>
                        )}
                        {inst.severity_label && (
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${severityTone(inst.severity_level)}`}>
                            {inst.severity_label}
                          </span>
                        )}
                        {hasScales && (
                          <ChevronDown className={`h-4 w-4 text-neutral-400 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </button>

                {hasScales && isOpen && (
                  <CardContent className="pt-0 pb-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3.5 border-t border-neutral-100">
                      {inst.scale_summaries!.map((s) => (
                        <div
                          key={s.scale_id}
                          className="flex items-center justify-between gap-3 bg-neutral-50 border border-neutral-100 rounded-lg px-3 py-2.5"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Activity className="h-3.5 w-3.5 text-primary-400 flex-shrink-0" />
                            <span className="text-xs text-neutral-700 truncate">
                              {s.scale_name ?? s.scale_code ?? s.scale_id}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {s.calculated_value != null && (
                              <span className="text-xs font-semibold text-neutral-900 whitespace-nowrap">
                                {s.calculated_value}
                                {s.max_possible != null && <span className="text-neutral-400 font-normal">/{s.max_possible}</span>}
                              </span>
                            )}
                            {s.severity_label && (
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${severityTone(s.severity_level)}`}>
                                {s.severity_label}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}

                <div className="px-6 pb-4 -mt-1">
                  <Link
                    href={`/patient/results/${inst.instance_id}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary-600 hover:text-primary-700"
                  >
                    View full details <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
