"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, ClipboardList, TrendingDown, Award, Activity } from "lucide-react";
import { PageLoader, Card, CardContent, Select } from "@/components/ui";
import { SeverityBadge } from "@/components/assessment/SeverityBadge";
import { prsService, reportsService } from "@/lib/api/services";
import type { ConditionBattery } from "@/types/prs.types";
import type { PatientsOverviewResponse } from "@/types/reports.types";

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function changeColor(change: number | null): string {
  if (change == null) return "text-neutral-400";
  return change < 0 ? "text-green-600" : change > 0 ? "text-red-600" : "text-neutral-500";
}

export default function DoctorAnalyticsPage() {
  const router = useRouter();
  const [conditions, setConditions] = useState<ConditionBattery[]>([]);
  const [diseaseId, setDiseaseId] = useState<string>("");
  const [overview, setOverview] = useState<PatientsOverviewResponse | null>(null);
  const [isLoadingConditions, setIsLoadingConditions] = useState(true);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);

  // Load the condition tabs once, then default to the first one.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { conditions: list } = await prsService.getConditions();
        if (cancelled) return;
        setConditions(list);
        if (list.length > 0) setDiseaseId(list[0].condition_id);
      } finally {
        if (!cancelled) setIsLoadingConditions(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Re-fetch the overview whenever the selected condition changes.
  useEffect(() => {
    if (!diseaseId) return;
    let cancelled = false;
    setIsLoadingOverview(true);
    (async () => {
      try {
        const data = await reportsService.getDoctorPatientsOverview(diseaseId);
        if (!cancelled) setOverview(data);
      } catch {
        if (!cancelled) setOverview(null);
      } finally {
        if (!cancelled) setIsLoadingOverview(false);
      }
    })();
    return () => { cancelled = true; };
  }, [diseaseId]);

  if (isLoadingConditions) return <PageLoader />;

  const kpis = overview?.kpis;
  const kpiCards = [
    { label: "Patients", value: kpis?.patients ?? "—", Icon: Users },
    { label: "Avg Assessments", value: kpis?.avg_assessments ?? "—", Icon: ClipboardList },
    {
      label: "Avg Score Change",
      value: kpis?.avg_score_change != null ? `${kpis.avg_score_change > 0 ? "+" : ""}${kpis.avg_score_change}` : "—",
      Icon: TrendingDown,
    },
    { label: "Responders", value: kpis?.responders_pct != null ? `${kpis.responders_pct}%` : "—", Icon: Award },
    { label: "Remitters", value: kpis?.remitters_pct != null ? `${kpis.remitters_pct}%` : "—", Icon: Activity },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Analytics</h1>
          <p className="text-sm text-neutral-500 mt-0.5">Track your patients&apos; progress for one condition at a time.</p>
        </div>
        <div className="w-64">
          <Select
            options={conditions.map((c) => ({ value: c.condition_id, label: c.label }))}
            value={diseaseId}
            onChange={(e) => setDiseaseId(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {kpiCards.map(({ label, value, Icon }) => (
          <div key={label} className="bg-white rounded-xl border border-neutral-200 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-neutral-900">{value}</p>
              <Icon className="w-4 h-4 text-neutral-300" />
            </div>
            <p className="text-xs text-neutral-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardContent>
          {isLoadingOverview ? (
            <div className="py-10 flex justify-center"><PageLoader /></div>
          ) : !overview || overview.patients.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-400">No patients tracked for this condition yet.</p>
          ) : (
            <div className="overflow-auto max-h-[calc(100vh-260px)]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="text-left text-xs font-semibold text-neutral-500 uppercase border-b border-neutral-100">
                    <th className="py-2 pr-4">Patient</th>
                    <th className="py-2 pr-4">First Assessment</th>
                    <th className="py-2 pr-4">Assessments</th>
                    <th className="py-2 pr-4">Overall Change</th>
                    <th className="py-2 pr-4">Score by Visit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {overview.patients.map((p) => (
                    <tr
                      key={p.patient_id}
                      onClick={() => router.push(`/doctor/patients/${p.patient_id}`)}
                      className="cursor-pointer hover:bg-neutral-50"
                    >
                      <td className="py-3 pr-4 font-medium text-neutral-900">{p.name}</td>
                      <td className="py-3 pr-4 text-neutral-500">{fmtDate(p.first_assessment_date)}</td>
                      <td className="py-3 pr-4 text-neutral-500">{p.assessment_count}</td>
                      <td className={`py-3 pr-4 font-semibold ${changeColor(p.overall_change)}`}>
                        {p.overall_change != null ? `${p.overall_change > 0 ? "+" : ""}${p.overall_change}` : "—"}
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          {p.visits.length === 0 ? (
                            <span className="text-neutral-400">—</span>
                          ) : (
                            p.visits.map((v, i) => (
                              <div key={v.instance_id} className="flex flex-col items-center gap-0.5">
                                <SeverityBadge level={v.severity_level ?? "normal"} label={`${v.score}`} />
                                {i > 0 && (
                                  <span className={`text-[10px] ${changeColor(v.score - p.visits[i - 1].score)}`}>
                                    {v.score - p.visits[i - 1].score > 0 ? "+" : ""}
                                    {Math.round((v.score - p.visits[i - 1].score) * 10) / 10}
                                  </span>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
