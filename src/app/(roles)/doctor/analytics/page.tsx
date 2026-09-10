"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, TrendingDown, TrendingUp, Minus, ChevronRight, ShieldCheck, ClipboardList, Award, Activity, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { Card, CardHeader, CardContent, Select, PageLoader } from "@/components/ui";
import { SeverityBadge } from "@/components/assessment/SeverityBadge";
import { reportsService } from "@/lib/api/services";
import type {
  CohortSummary,
  DiseaseOverviewRow,
  PatientOverviewRow,
  PatientsOverviewResponse,
  ProtocolOutcomesResponse,
  ScaleTrajectory,
  Trend,
  VisitScore,
  WeeklyTrendResponse,
} from "@/types/reports.types";

/**
 * Doctor outcome-analytics dashboard. Layout matches Documents/Anava_
 * Doctor_Portal_Analytics_Dashboard_Backend_Design_v1.docx Section 5 —
 * every chart is wired to a real endpoint: 5.1 (cohort overview), 5.2/5.8
 * (KPI panel + patient table), 5.3 (composite-by-visit), 5.4 (scale
 * trajectories), 5.5/5.6 (treatment protocol outcomes + protocol-vs-scale
 * heatmap) and 5.7 (weekly composite trend).
 */

const GREEN = "#22c55e";
const AMBER = "#f59e0b";
const RED = "#ef4444";
const SCALE_COLORS = ["#00A1E4", "#f97316", "#8b5cf6", "#14b8a6", "#ec4899", "#84cc16"];
const BRAND_GRADIENT = "linear-gradient(135deg, #00A1E4 0%, #17749B 100%)";
const ALL_DISEASES = "";

const TREND_LABEL: Record<Trend, string> = {
  improving: "Improving",
  stable: "Stable",
  worsening: "Worsening",
  insufficient_data: "Insufficient Data",
};
const TREND_COLOR: Record<Trend, string> = { improving: GREEN, stable: AMBER, worsening: RED, insufficient_data: "#a3a3a3" };
function trendBadgeClass(trend: Trend): string {
  const bg = trend === "improving" ? "bg-success-50" : trend === "worsening" ? "bg-danger-50" : trend === "stable" ? "bg-warning-50" : "bg-neutral-50";
  const fg = trend === "improving" ? "text-success-700" : trend === "worsening" ? "text-danger-700" : trend === "stable" ? "text-warning-700" : "text-neutral-500";
  return cn("inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full border", bg, fg);
}

function segStyle(count: number, total: number, color: string): React.CSSProperties {
  const pct = total ? (count / total) * 100 : 0;
  return { flex: `0 0 ${pct.toFixed(2)}%`, background: color };
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function changeColor(change: number | null): string {
  if (change == null) return "text-neutral-400";
  return change < 0 ? "text-green-600" : change > 0 ? "text-red-600" : "text-neutral-500";
}

// ---- SVG line-chart geometry (real data drives the values; this is just layout math) ----
const CW = 680, CH = 260, PL = 70, PR = 20, PT = 20, PB = 56, Y_MIN = 0, Y_MAX = 100, Y_STEP = 20;
function lineChartGeo(n: number) {
  const plotLeft = PL, plotRight = CW - PR, plotTop = PT, plotBottom = CH - PB;
  const x = (i: number) => (n <= 1 ? plotLeft : plotLeft + (i * (plotRight - plotLeft)) / (n - 1));
  const y = (v: number) => plotTop + (1 - (v - Y_MIN) / (Y_MAX - Y_MIN)) * (plotBottom - plotTop);
  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const yTicks: { y: number; label: number }[] = [];
  for (let v = Y_MIN; v <= Y_MAX; v += Y_STEP) yTicks.push({ y: y(v), label: v });
  const xTicks: { x: number; label: string }[] = [];
  for (let i = 0; i < n; i++) xTicks.push({ x: x(i), label: `Visit ${i + 1}` });
  return { x, y, path, yTicks, xTicks, plotLeft, plotRight, plotTop, plotBottom };
}

/** Real composite-by-visit chart (Backend Design v1 Section 5.3). Cohort
 * mode averages every patient's score at each visit INDEX (not calendar
 * date — a patient's 3rd visit, whatever the date); patient mode is just
 * that one patient's own sequence. Both computed client-side from data
 * the API already returned — no additional backend call needed. */
function CompositeByVisitChart({ patients, singlePatient }: { patients: PatientOverviewRow[]; singlePatient: PatientOverviewRow | null }) {
  const series = useMemo(() => {
    if (singlePatient) return singlePatient.visits.map((v) => v.score);
    const maxLen = Math.max(0, ...patients.map((p) => p.visits.length));
    const out: number[] = [];
    for (let i = 0; i < maxLen; i++) {
      const atIndex = patients.map((p) => p.visits[i]?.score).filter((s): s is number => s != null);
      if (atIndex.length) out.push(atIndex.reduce((a, b) => a + b, 0) / atIndex.length);
    }
    return out;
  }, [patients, singlePatient]);

  if (series.length === 0) return <p className="py-10 text-center text-sm text-neutral-400">No assessments yet.</p>;

  const g = lineChartGeo(series.length);
  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full h-auto block overflow-visible">
      {g.yTicks.map((t) => (
        <g key={t.label}>
          <line x1={g.plotLeft} x2={g.plotRight} y1={t.y} y2={t.y} stroke="#f0f0f0" strokeWidth={1} />
          <text x={g.plotLeft - 10} y={t.y + 4} textAnchor="end" fontSize={11} fill="#a3a3a3">{t.label}</text>
        </g>
      ))}
      {g.xTicks.map((t) => (
        <g key={t.label}>
          <line x1={t.x} x2={t.x} y1={g.plotTop} y2={g.plotBottom} stroke="#f5f5f5" strokeWidth={1} />
          <text x={t.x} y={g.plotBottom + 20} textAnchor="middle" fontSize={11} fill="#a3a3a3">{t.label}</text>
        </g>
      ))}
      <text x={16} y={(g.plotTop + g.plotBottom) / 2} textAnchor="middle" fontSize={11} fontWeight={600} fill="#737373" transform={`rotate(-90 16 ${(g.plotTop + g.plotBottom) / 2})`}>
        Composite Score (0-100)
      </text>
      <text x={(g.plotLeft + g.plotRight) / 2} y={CH - 12} textAnchor="middle" fontSize={11} fontWeight={600} fill="#737373">Visit Number</text>
      <path d={g.path(series)} fill="none" stroke="#00A1E4" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {series.map((v, i) => (
        <g key={i}>
          <circle cx={g.x(i)} cy={g.y(v)} r={4} fill="#fff" stroke="#00A1E4" strokeWidth={2.5} />
          <text x={g.x(i)} y={g.y(v) - 12} textAnchor="middle" fontSize={11} fontWeight={600} fill="#404040">{v.toFixed(1)}</text>
        </g>
      ))}
    </svg>
  );
}

/** Real per-scale trajectory chart (Backend Design v1 Section 5.4). Each
 * scale is its own line, plotted by visit index within that scale's own
 * history (scales aren't all assessed on the same schedule). */
function ScaleTrajectoriesChart({ scales }: { scales: ScaleTrajectory[] }) {
  const maxLen = Math.max(0, ...scales.map((s) => s.points.length));
  if (maxLen === 0) return <p className="py-10 text-center text-sm text-neutral-400">No scale history yet.</p>;

  const g = lineChartGeo(maxLen);
  return (
    <div>
      <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full h-auto block overflow-visible">
        {g.yTicks.map((t) => (
          <g key={t.label}>
            <line x1={g.plotLeft} x2={g.plotRight} y1={t.y} y2={t.y} stroke="#f0f0f0" strokeWidth={1} />
            <text x={g.plotLeft - 10} y={t.y + 4} textAnchor="end" fontSize={11} fill="#a3a3a3">{t.label}</text>
          </g>
        ))}
        {g.xTicks.map((t) => (
          <line key={t.label} x1={t.x} x2={t.x} y1={g.plotTop} y2={g.plotBottom} stroke="#f5f5f5" strokeWidth={1} />
        ))}
        <text x={16} y={(g.plotTop + g.plotBottom) / 2} textAnchor="middle" fontSize={11} fontWeight={600} fill="#737373" transform={`rotate(-90 16 ${(g.plotTop + g.plotBottom) / 2})`}>
          Scale Score (0-100)
        </text>
        <text x={(g.plotLeft + g.plotRight) / 2} y={CH - 12} textAnchor="middle" fontSize={11} fontWeight={600} fill="#737373">Assessment Number</text>
        {scales.map((s, i) => {
          const color = SCALE_COLORS[i % SCALE_COLORS.length];
          const vals = s.points.map((p) => p.score);
          return (
            <g key={s.scale_code}>
              <path d={g.path(vals)} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {vals.map((v, j) => (
                <circle key={j} cx={g.x(j)} cy={g.y(v)} r={3} fill="#fff" stroke={color} strokeWidth={2} />
              ))}
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-3 mt-2 justify-center">
        {scales.map((s, i) => (
          <div key={s.scale_code} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: SCALE_COLORS[i % SCALE_COLORS.length] }} />
            <span className="text-xs text-neutral-600">{s.scale_name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function weeklyCellClass(score: number | null): string {
  if (score == null) return "text-neutral-300";
  if (score <= 20) return "text-green-600 font-semibold";
  if (score <= 40) return "text-lime-600 font-semibold";
  if (score <= 60) return "text-amber-600 font-semibold";
  if (score <= 80) return "text-orange-600 font-semibold";
  return "text-red-600 font-semibold";
}

/** Weekly composite trend table (Backend Design v1 Section 5.7) — one row
 * per patient, one column per ISO week, doctor picks how many weeks back. */
function WeeklyTrendTable({ data, weeks, onWeeksChange }: { data: WeeklyTrendResponse | null; weeks: number; onWeeksChange: (w: number) => void }) {
  return (
    <Card>
      <CardHeader className="flex items-center gap-4 flex-wrap">
        <div>
          <p className="text-sm font-semibold text-neutral-900">Weekly Composite Score Trend</p>
          <p className="text-xs text-neutral-500 mt-0.5">From PRS captured during protocol device sessions, by ISO week; last known score carries forward into weeks with no session.</p>
        </div>
        <div className="ml-auto">
          <Select
            value={String(weeks)}
            onChange={(e) => onWeeksChange(Number(e.target.value))}
            options={[4, 8, 12, 26].map((w) => ({ value: String(w), label: `Last ${w} weeks` }))}
          />
        </div>
      </CardHeader>
      {!data || data.patients.length === 0 ? (
        <p className="py-10 text-center text-sm text-neutral-400">No patients tracked for this condition yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[700px]">
            <thead>
              <tr>
                <th className="px-3 py-2.5 pl-5 text-left text-[11.5px] font-semibold uppercase tracking-wide text-neutral-500 bg-neutral-50 whitespace-nowrap">Patient</th>
                {data.weeks.map((w) => (
                  <th key={w} className="px-3 py-2.5 text-center text-[11.5px] font-semibold uppercase tracking-wide text-neutral-500 bg-neutral-50 whitespace-nowrap">
                    {fmtDate(w)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.patients.map((p) => (
                <tr key={p.patient_id} className="border-t border-neutral-100">
                  <td className="py-3 pl-5 pr-3 text-[13.5px] font-semibold text-neutral-900 whitespace-nowrap">{p.name}</td>
                  {p.scores.map((score, i) => (
                    <td key={i} className={cn("px-3 py-3 text-center text-[13px]", weeklyCellClass(score))}>
                      {score != null ? score.toFixed(1) : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/** Treatment Protocol Outcomes (Backend Design v1 Section 5.5) — one
 * segmented bar per protocol (device modality + placement), same visual
 * language as the disease cohort bars, sorted by how many patients ran it. */
function ProtocolOutcomesChart({ data }: { data: ProtocolOutcomesResponse | null }) {
  if (!data || data.protocols.length === 0) {
    return <p className="py-10 text-center text-sm text-neutral-400">No device-session PRS captured under a protocol yet.</p>;
  }
  return (
    <div className="flex flex-col gap-1">
      {data.protocols.map((proto) => {
        const comparable = proto.improving + proto.stable + proto.worsening;
        return (
          <div key={proto.protocol_label} className="grid grid-cols-[1fr_130px_34px] items-center gap-3 py-2">
            <p className="text-[13px] font-medium text-neutral-800 truncate" title={proto.protocol_label}>{proto.protocol_label}</p>
            <div className="flex h-[20px] rounded overflow-hidden bg-neutral-100">
              <div style={segStyle(proto.improving, comparable, GREEN)} />
              <div style={segStyle(proto.stable, comparable, AMBER)} />
              <div style={segStyle(proto.worsening, comparable, RED)} />
            </div>
            <span className="text-sm font-semibold text-neutral-900 text-right">{proto.total}</span>
          </div>
        );
      })}
    </div>
  );
}

function heatmapCellStyle(avgChange: number): React.CSSProperties {
  // Direction-corrected convention: negative = improvement (score dropped).
  const intensity = Math.min(Math.abs(avgChange) / 40, 1); // 40+ point swing = full saturation
  const color = avgChange < 0 ? GREEN : avgChange > 0 ? RED : "#a3a3a3";
  return { background: color, opacity: 0.15 + intensity * 0.65 };
}

/** Protocol vs. Scale Outcomes heatmap (Backend Design v1 Section 5.6) —
 * each cell is one scale's average raw-percentage change (first capture ->
 * last) under one protocol, across every patient with >=2 captures. */
function ProtocolScaleHeatmap({ data }: { data: ProtocolOutcomesResponse | null }) {
  if (!data || data.heatmap.length === 0) {
    return <p className="py-10 text-center text-sm text-neutral-400">Not enough repeat captures yet to compare scales across protocols.</p>;
  }
  const protocols = Array.from(new Set(data.heatmap.map((c) => c.protocol_label)));
  const scales = Array.from(new Map(data.heatmap.map((c) => [c.scale_code, c.scale_name])).entries());
  const byKey = new Map(data.heatmap.map((c) => [`${c.protocol_label}::${c.scale_code}`, c]));

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse min-w-[560px]">
        <thead>
          <tr>
            <th className="px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500 bg-neutral-50 whitespace-nowrap">Protocol</th>
            {scales.map(([code, name]) => (
              <th key={code} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-neutral-500 bg-neutral-50 whitespace-nowrap" title={name}>
                {code}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {protocols.map((label) => (
            <tr key={label} className="border-t border-neutral-100">
              <td className="px-2 py-2 text-[12.5px] font-medium text-neutral-800 whitespace-nowrap" title={label}>{label}</td>
              {scales.map(([code]) => {
                const cell = byKey.get(`${label}::${code}`);
                return (
                  <td key={code} className="px-2 py-2 text-center text-[12px] font-semibold text-neutral-800" style={cell ? heatmapCellStyle(cell.avg_change) : undefined}>
                    {cell ? `${cell.avg_change > 0 ? "+" : ""}${cell.avg_change}` : "—"}
                    {cell && <div className="text-[9.5px] font-normal text-neutral-500">n={cell.n}</div>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DoctorAnalyticsPage() {
  const [diseaseId, setDiseaseId] = useState(ALL_DISEASES);
  const [patientId, setPatientId] = useState("");
  const [diseases, setDiseases] = useState<DiseaseOverviewRow[]>([]);
  const [cohortSummary, setCohortSummary] = useState<CohortSummary | null>(null);
  const [overview, setOverview] = useState<PatientsOverviewResponse | null>(null);
  const [isLoadingDiseases, setIsLoadingDiseases] = useState(true);
  const [isLoadingOverview, setIsLoadingOverview] = useState(false);
  const [trajectories, setTrajectories] = useState<ScaleTrajectory[]>([]);
  const [isLoadingTrajectories, setIsLoadingTrajectories] = useState(false);
  const [weeklyTrend, setWeeklyTrend] = useState<WeeklyTrendResponse | null>(null);
  const [weeks, setWeeks] = useState(8);
  const [protocolOutcomes, setProtocolOutcomes] = useState<ProtocolOutcomesResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await reportsService.getDoctorDiseasesOverview();
        if (!cancelled) { setDiseases(data.diseases); setCohortSummary(data.summary); }
      } finally {
        if (!cancelled) setIsLoadingDiseases(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!diseaseId) { setOverview(null); return; }
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

  useEffect(() => {
    if (!patientId || !diseaseId) { setTrajectories([]); return; }
    let cancelled = false;
    setIsLoadingTrajectories(true);
    (async () => {
      try {
        const data = await reportsService.getPatientScaleTrajectories(patientId, diseaseId);
        if (!cancelled) setTrajectories(data.scales);
      } catch {
        if (!cancelled) setTrajectories([]);
      } finally {
        if (!cancelled) setIsLoadingTrajectories(false);
      }
    })();
    return () => { cancelled = true; };
  }, [patientId, diseaseId]);

  useEffect(() => {
    if (!diseaseId) { setWeeklyTrend(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const data = await reportsService.getDoctorWeeklyTrend(diseaseId, weeks);
        if (!cancelled) setWeeklyTrend(data);
      } catch {
        if (!cancelled) setWeeklyTrend(null);
      }
    })();
    return () => { cancelled = true; };
  }, [diseaseId, weeks]);

  useEffect(() => {
    if (!diseaseId) { setProtocolOutcomes(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const data = await reportsService.getDoctorProtocolOutcomes(diseaseId);
        if (!cancelled) setProtocolOutcomes(data);
      } catch {
        if (!cancelled) setProtocolOutcomes(null);
      }
    })();
    return () => { cancelled = true; };
  }, [diseaseId]);

  function selectDisease(id: string) { setDiseaseId(id); setPatientId(""); }
  function onBack() { setPatientId(""); }

  const current = overview?.patients.find((p) => p.patient_id === patientId) ?? null;
  const isOverview = diseaseId === ALL_DISEASES;
  const isPatient = !!current;
  const selectedDiseaseName = diseases.find((d) => d.disease_id === diseaseId)?.disease_name ?? diseaseId;

  const scopeCaption = isPatient && current
    ? `Individual view — ${current.name}.`
    : diseaseId
      ? `${selectedDiseaseName} cohort, ${overview?.kpis.patients ?? 0} patients.`
      : "All conditions shown; select one to drill in.";

  const kpis = overview?.kpis;
  const kpiCards = kpis
    ? [
        { label: "Patients", value: kpis.patients, sub: "assigned to you", Icon: Users },
        { label: "Improving", value: kpis.improving, sub: "≥20% score drop", Icon: TrendingDown, tone: GREEN },
        { label: "Stable", value: kpis.stable, sub: "within ±20% band", Icon: Minus, tone: AMBER },
        { label: "Worsening", value: kpis.worsening, sub: "≥20% score rise", Icon: TrendingUp, tone: RED },
        { label: "Avg Assessments", value: kpis.avg_assessments, sub: "per patient", Icon: ClipboardList },
        {
          label: "Avg Score Change",
          value: kpis.avg_score_change != null ? `${kpis.avg_score_change > 0 ? "+" : ""}${kpis.avg_score_change}` : "—",
          sub: "baseline to latest",
          Icon: TrendingDown,
        },
        { label: "Responders", value: kpis.responders_pct != null ? `${kpis.responders_pct}%` : "—", sub: "≥50% composite reduction", Icon: Award },
        { label: "Remitters", value: `${kpis.remitters_pct}%`, sub: "reached Normal severity", Icon: Activity },
        { label: "Provisional Scores", value: `${kpis.provisional_pct}%`, sub: "incomplete scale coverage", Icon: AlertTriangle, tone: AMBER },
      ]
    : [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Outcome Analytics</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{scopeCaption}</p>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5 min-w-[240px]">
            <span className="text-[10px] font-semibold tracking-wider uppercase text-neutral-500">Disease</span>
            <Select
              value={diseaseId}
              onChange={(e) => selectDisease(e.target.value)}
              options={[{ value: ALL_DISEASES, label: "All Diseases" }, ...diseases.map((x) => ({ value: x.disease_id, label: x.disease_name }))]}
            />
          </div>
          {isPatient && current && (
            <div className="flex flex-col gap-1.5 min-w-[240px]">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-neutral-500">Patient</span>
              <Select value={patientId} onChange={(e) => setPatientId(e.target.value)} options={(overview?.patients ?? []).map((p) => ({ value: p.patient_id, label: p.name }))} />
            </div>
          )}
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1.5 text-neutral-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="text-xs">Scoped to patients assigned to you</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {isOverview && cohortSummary && (
        <div className="grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
          <Card>
            <CardContent className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-2xl font-bold text-neutral-900">{cohortSummary.total_patients.toLocaleString()}</span>
                <span className="text-xs text-neutral-500">Patients under review</span>
                <span className="text-[11px] text-neutral-400">across {cohortSummary.disease_cohorts} disease cohorts</span>
              </div>
              <Users className="w-4 h-4 text-neutral-300" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-2xl font-bold" style={{ color: GREEN }}>{cohortSummary.improving_pct}%</span>
                <span className="text-xs text-neutral-500">Improving</span>
                <span className="text-[11px] text-neutral-400">{cohortSummary.improving_patients.toLocaleString()} patients</span>
              </div>
              <TrendingDown className="w-4 h-4 text-neutral-300" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-2xl font-bold" style={{ color: RED }}>{cohortSummary.worsening_pct}%</span>
                <span className="text-xs text-neutral-500">Worsening</span>
                <span className="text-[11px] text-neutral-400">{cohortSummary.worsening_patients.toLocaleString()} patients flagged for review</span>
              </div>
              <TrendingUp className="w-4 h-4 text-neutral-300" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-2xl font-bold text-neutral-900">{cohortSummary.assessments_in_window.toLocaleString()}</span>
                <span className="text-xs text-neutral-500">Assessments in window</span>
                <span className="text-[11px] text-neutral-400">{cohortSummary.provisional_pending.toLocaleString()} provisional scores pending</span>
              </div>
              <ClipboardList className="w-4 h-4 text-neutral-300" />
            </CardContent>
          </Card>
        </div>
      )}

      {isOverview && (
        <Card>
          <CardHeader className="flex items-center gap-4 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-neutral-900">Trajectory Distribution by Condition</p>
              <p className="text-xs text-neutral-500 mt-0.5">Patient counts by latest composite-score direction. Select a condition to drill in.</p>
            </div>
            <div className="ml-auto flex items-center gap-4">
              {(["improving", "stable", "worsening"] as const).map((k) => (
                <div key={k} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: TREND_COLOR[k] }} />
                  <span className="text-xs text-neutral-600">{TREND_LABEL[k]}</span>
                </div>
              ))}
            </div>
          </CardHeader>
          <CardContent className="!px-2 !py-2">
            {isLoadingDiseases ? (
              <div className="py-10 flex justify-center"><PageLoader /></div>
            ) : diseases.length === 0 ? (
              <p className="py-10 text-center text-sm text-neutral-400">No conditions tracked for your patients yet.</p>
            ) : (
              diseases.map((x) => {
                const comparable = x.improving + x.stable + x.worsening;
                const impPct = comparable ? Math.round((x.improving / comparable) * 100) : 0;
                return (
                  <div
                    key={x.disease_id}
                    onClick={() => selectDisease(x.disease_id)}
                    className="grid grid-cols-[230px_minmax(0,1fr)_210px] items-center gap-4 py-3 px-3 rounded-lg cursor-pointer hover:bg-neutral-50 transition-colors"
                  >
                    <p className="text-[13.5px] font-semibold text-neutral-900 truncate">{x.disease_name}</p>
                    <div className="flex h-[26px] rounded overflow-hidden bg-neutral-100">
                      <div style={segStyle(x.improving, comparable, GREEN)} className="text-white text-[11px] font-semibold grid place-items-center overflow-hidden">{x.improving}</div>
                      <div style={segStyle(x.stable, comparable, AMBER)} className="text-white text-[11px] font-semibold grid place-items-center overflow-hidden">{x.stable}</div>
                      <div style={segStyle(x.worsening, comparable, RED)} className="text-white text-[11px] font-semibold grid place-items-center overflow-hidden">{x.worsening}</div>
                    </div>
                    <div className="flex items-center justify-end gap-3.5">
                      <span className="text-xs text-neutral-600">{impPct}% improving</span>
                      <span className="text-sm font-semibold text-neutral-900 min-w-[34px] text-right">{x.total}</span>
                      <ChevronRight className="w-4 h-4 text-neutral-400" />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      {isPatient && current && (
        <Card>
          <CardContent className="flex items-center gap-4 flex-wrap">
            <div className="w-[46px] h-[46px] rounded-full grid place-items-center text-white text-[15px] font-semibold flex-shrink-0" style={{ background: BRAND_GRADIENT }}>
              {current.name.split(" ").map((w) => w[0]).join("")}
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-neutral-900">{current.name}</h3>
              <p className="text-xs text-neutral-500 mt-0.5">{selectedDiseaseName} · {current.assessment_count} assessments</p>
            </div>
            <div className="ml-auto flex items-center gap-2.5">
              <span className={trendBadgeClass(current.trend)}>{TREND_LABEL[current.trend]}</span>
              <button onClick={onBack} className="h-9 px-3.5 text-sm font-semibold text-neutral-600 bg-white border border-neutral-300 rounded-lg hover:bg-neutral-100 active:scale-[0.98] transition-all">
                Back to Cohort
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {diseaseId && (
        <>
          {isLoadingOverview ? (
            <div className="py-10 flex justify-center"><PageLoader /></div>
          ) : (
            <>
              {!isPatient && (
                <div className="grid gap-3.5 grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
                  {kpiCards.map((k) => (
                    <Card key={k.label}>
                      <CardContent className="flex items-center justify-between">
                        <div className="flex flex-col gap-1">
                          <span className="text-2xl font-bold" style={{ color: k.tone || undefined }}>{k.value}</span>
                          <span className="text-xs text-neutral-500">{k.label}</span>
                          <span className="text-[11px] text-neutral-400">{k.sub}</span>
                        </div>
                        <k.Icon className="w-4 h-4 text-neutral-300" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              <div className="grid gap-5 grid-cols-[repeat(auto-fit,minmax(420px,1fr))]">
                <Card>
                  <CardHeader>
                    <p className="text-sm font-semibold text-neutral-900">Mean Composite Score by Visit</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {isPatient && current ? current.name : `${selectedDiseaseName} · cohort mean`}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <CompositeByVisitChart patients={overview?.patients ?? []} singlePatient={current} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <p className="text-sm font-semibold text-neutral-900">Scale Trajectories</p>
                    <p className="text-xs text-neutral-500 mt-0.5">{isPatient && current ? current.name : "Select a patient to view scale-level history"}</p>
                  </CardHeader>
                  <CardContent>
                    {!isPatient ? (
                      <p className="py-10 text-center text-sm text-neutral-400">Select a patient from the table below.</p>
                    ) : isLoadingTrajectories ? (
                      <div className="py-10 flex justify-center"><PageLoader /></div>
                    ) : (
                      <ScaleTrajectoriesChart scales={trajectories} />
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <p className="text-sm font-semibold text-neutral-900">Treatment Protocol Outcomes</p>
                    <p className="text-xs text-neutral-500 mt-0.5">Composite trend across every protocol run for {selectedDiseaseName}</p>
                  </CardHeader>
                  <CardContent>
                    <ProtocolOutcomesChart data={protocolOutcomes} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <p className="text-sm font-semibold text-neutral-900">Protocol vs. Scale Outcomes</p>
                    <p className="text-xs text-neutral-500 mt-0.5">Avg. raw scale change (first → last capture) per protocol</p>
                  </CardHeader>
                  <CardContent>
                    <ProtocolScaleHeatmap data={protocolOutcomes} />
                  </CardContent>
                </Card>
              </div>
              <WeeklyTrendTable data={weeklyTrend} weeks={weeks} onWeeksChange={setWeeks} />

              {!isPatient && overview && (
                <Card>
                  <CardHeader className="flex items-center gap-4 flex-wrap">
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">Patient Outcomes</p>
                      <p className="text-xs text-neutral-500 mt-0.5">Select a patient name to open individual analytics.</p>
                    </div>
                    <span className="ml-auto text-xs font-semibold text-primary-700 bg-primary-50 border border-primary-100 px-2.5 py-1 rounded-full">
                      {overview.patients.length} patients
                    </span>
                  </CardHeader>
                  {overview.patients.length === 0 ? (
                    <p className="py-10 text-center text-sm text-neutral-400">No patients tracked for this condition yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse min-w-[800px]">
                        <thead>
                          <tr>
                            {["Patient", "First Assessment", "Assessments", "Overall Change", "Trend", "Score by Visit"].map((h) => (
                              <th key={h} className="px-3 py-2.5 first:pl-5 last:pr-5 text-left text-[11.5px] font-semibold uppercase tracking-wide text-neutral-500 bg-neutral-50 whitespace-nowrap">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {overview.patients.map((p) => (
                            <tr key={p.patient_id} className="border-t border-neutral-100">
                              <td className="py-3 pl-5 pr-3">
                                <button onClick={() => setPatientId(p.patient_id)} className="text-[13.5px] font-semibold text-primary-700">{p.name}</button>
                              </td>
                              <td className="px-3 py-3 text-[13px] text-neutral-600">{fmtDate(p.first_assessment_date)}</td>
                              <td className="px-3 py-3 text-[13px] text-neutral-600">{p.assessment_count}</td>
                              <td className={cn("px-3 py-3 text-[13px] font-semibold", changeColor(p.overall_change))}>
                                {p.overall_change != null ? `${p.overall_change > 0 ? "+" : ""}${p.overall_change}` : "—"}
                              </td>
                              <td className="px-3 py-3"><span className={trendBadgeClass(p.trend)}>{TREND_LABEL[p.trend]}</span></td>
                              <td className="px-3 py-3 pr-5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {p.visits.length === 0 ? (
                                    <span className="text-neutral-400">—</span>
                                  ) : (
                                    p.visits.map((v: VisitScore, i: number) => (
                                      <div key={v.composite_id} className="flex flex-col items-center gap-0.5">
                                        <SeverityBadge level={v.severity_level ?? "normal"} label={`${v.score}`} />
                                        {i > 0 && (
                                          <span className={cn("text-[10px]", changeColor(v.score - p.visits[i - 1].score))}>
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
                </Card>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
