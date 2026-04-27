"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardList, UserCircle, Activity,
  PlayCircle, ChevronRight, Calendar,
} from "lucide-react";
import { patientsService } from "@/lib/api/services/patients.service";
import { PatientDashboardSkeleton, Card, CardContent, Button } from "@/components/ui";
import type { PatientDashboard, AssessmentPermission, ScoreSummaryItem } from "@/types/domain.types";

export default function PatientDashboard() {
  const [dashboard, setDashboard]   = useState<PatientDashboard | null>(null);
  const [assessments, setAssessments] = useState<AssessmentPermission[]>([]);
  const [isLoading, setIsLoading]   = useState(true);

  useEffect(() => {
    Promise.all([
      patientsService.getDashboard(),
      patientsService.getMyAssessments(),
    ])
      .then(([dash, { permissions }]) => {
        setDashboard(dash);
        setAssessments(permissions);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <PatientDashboardSkeleton />;

  const pending      = assessments.filter((a) => a.status === "granted");
  const completed    = assessments.filter((a) => a.status === "completed");
  const recentScores = dashboard?.recent_scores ?? [];
  const doctor       = dashboard?.assigned_doctor;
  const fullName     = dashboard?.profile?.full_name ?? "";

  return (
    <div className="max-w-2xl mx-auto space-y-7 animate-fade-in">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
          {fullName ? `Welcome, ${fullName.split(" ")[0]}` : "Your Dashboard"}
        </h1>
        <p className="text-sm text-neutral-500 mt-1">Health assessment overview</p>
      </div>

      {/* Assigned doctor */}
      {doctor && (
        <Card>
          <CardContent className="flex items-center gap-3.5 py-3.5">
            <div className="w-9 h-9 rounded-full bg-primary-50 border border-primary-100 flex items-center justify-center flex-shrink-0">
              <UserCircle className="h-5 w-5 text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-neutral-400 font-semibold uppercase tracking-wider">Assigned Doctor</p>
              <p className="text-sm font-semibold text-neutral-900 leading-tight">Dr. {doctor.full_name}</p>
              {doctor.specialization && (
                <p className="text-xs text-neutral-500 truncate">{doctor.specialization}</p>
              )}
            </div>
            {doctor.phone && (
              <p className="text-xs text-neutral-400 flex-shrink-0 hidden sm:block">{doctor.phone}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pending assessments */}
      {pending.length > 0 && (
        <section>
          <SectionHeading
            title="Pending Assessments"
            count={pending.length}
            accent="primary"
          />
          <div className="space-y-2.5">
            {pending.map((a) => (
              <AssessmentPermissionCard key={a.permission_id} permission={a} />
            ))}
          </div>
        </section>
      )}

      {/* Recent results */}
      {recentScores.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <SectionHeading title="Recent Results" />
            <Link
              href="/patient/results"
              className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-0.5 font-medium transition-colors"
            >
              View all <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-2.5">
            {recentScores.map((score, i) => (
              <ScoreRow key={score.instance_id ?? score.disease_id ?? i} score={score} />
            ))}
          </div>
        </section>
      )}

      {/* Completed assessments */}
      {completed.length > 0 && (
        <section>
          <SectionHeading title="Completed" count={completed.length} />
          <div className="space-y-2.5">
            {completed.map((a) => (
              <AssessmentPermissionCard key={a.permission_id} permission={a} />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {pending.length === 0 && completed.length === 0 && recentScores.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
            <ClipboardList className="h-6 w-6 text-neutral-400" />
          </div>
          <p className="text-sm font-medium text-neutral-700">No assessments yet</p>
          <p className="text-xs text-neutral-400 mt-1 max-w-xs">
            Your doctor will assign assessments when ready.
          </p>
        </div>
      )}
    </div>
  );
}

function SectionHeading({
  title,
  count,
  accent,
}: {
  title: string;
  count?: number;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">{title}</h2>
      {count !== undefined && (
        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-500">
          {count}
        </span>
      )}
    </div>
  );
}

function AssessmentPermissionCard({ permission }: { permission: AssessmentPermission }) {
  const isCompleted = permission.status === "completed";
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-3.5">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-900 truncate">{permission.disease_name}</p>
          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-neutral-500">
            <Calendar className="h-3 w-3 flex-shrink-0" />
            <span>Granted {new Date(permission.granted_at).toLocaleDateString()}</span>
            {permission.scales && permission.scales.length > 0 && (
              <>
                <span className="w-1 h-1 rounded-full bg-neutral-300" />
                <span>{permission.scales.length} scale{permission.scales.length !== 1 ? "s" : ""}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <StatusPill status={permission.status} />
          {permission.status === "granted" && (
            <Link href={`/patient/assessment/${permission.permission_id}`}>
              <Button size="sm">
                <PlayCircle className="h-3.5 w-3.5" /> Start
              </Button>
            </Link>
          )}
          {isCompleted && (
            <Link href="/patient/results">
              <Button size="sm" variant="outline">Results</Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    granted:   "bg-primary-50 text-primary-700 border-primary-100",
    completed: "bg-success-50 text-success-700 border-success-100",
  };
  const cls = map[status] ?? "bg-neutral-100 text-neutral-600 border-neutral-200";
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border capitalize ${cls}`}>
      {status}
    </span>
  );
}

function ScoreRow({ score }: { score: ScoreSummaryItem }) {
  const label  = score.disease_name ?? score.scale_name ?? score.disease_id ?? score.scale_id;
  const linked = !!score.instance_id;

  const inner = (
    <Card className={linked ? "hover:shadow-card-hover transition-shadow cursor-pointer" : undefined}>
      <CardContent className="flex items-center justify-between py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
            <Activity className="h-4 w-4 text-primary-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-900">{label}</p>
            {score.recorded_at && (
              <p className="text-xs text-neutral-400 mt-0.5">
                {new Date(score.recorded_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
        <div className="text-right flex-shrink-0 ml-4">
          {score.total_score != null && (
            <p className="text-sm font-bold text-neutral-900">
              {score.total_score}
              {score.max_possible_score != null && (
                <span className="text-neutral-400 font-normal text-xs"> / {score.max_possible_score}</span>
              )}
            </p>
          )}
          {score.severity_label && (
            <p className="text-xs text-neutral-500 mt-0.5">{score.severity_label}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return linked
    ? <Link href={`/patient/results/${score.instance_id}`}>{inner}</Link>
    : inner;
}
