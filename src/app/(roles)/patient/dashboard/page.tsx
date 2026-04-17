"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList, UserCircle, Activity, PlayCircle } from "lucide-react";
import { patientsService } from "@/lib/api/services/patients.service";
import { PatientDashboardSkeleton, Card, CardContent, Button } from "@/components/ui";
import type { PatientDashboard, AssessmentPermission, ScoreSummaryItem } from "@/types/domain.types";

export default function PatientDashboard() {
  const [dashboard, setDashboard] = useState<PatientDashboard | null>(null);
  const [assessments, setAssessments] = useState<AssessmentPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

  const pending = assessments.filter((a) => a.status === "granted");
  const completed = assessments.filter((a) => a.status === "completed");
  const recentScores = dashboard?.recent_scores ?? [];
  const doctor = dashboard?.assigned_doctor;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">
          Welcome, {dashboard?.profile?.first_name ?? ""}
        </h1>
        <p className="text-sm text-neutral-500 mt-1">Your health assessment overview</p>
      </div>

      {/* Assigned Doctor */}
      {doctor && (
        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700">
              <UserCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-neutral-500 uppercase">Assigned Doctor</p>
              <p className="text-sm font-semibold text-neutral-900">
                Dr. {doctor.first_name} {doctor.last_name}
              </p>
              {doctor.specialization && (
                <p className="text-xs text-neutral-500">{doctor.specialization}</p>
              )}
            </div>
            {doctor.phone && (
              <p className="ml-auto text-xs text-neutral-400">{doctor.phone}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Pending Assessments */}
      {pending.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">
            Pending Assessments
          </h2>
          <div className="space-y-3">
            {pending.map((a) => (
              <AssessmentPermissionCard key={a.permission_id} permission={a} />
            ))}
          </div>
        </section>
      )}

      {/* Recent Scores */}
      {recentScores.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">
            Recent Results
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {recentScores.map((score, i) => (
              <ScoreRow key={score.scale_id + i} score={score} />
            ))}
          </div>
        </section>
      )}

      {/* Completed */}
      {completed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">
            Completed
          </h2>
          <div className="space-y-3">
            {completed.map((a) => (
              <AssessmentPermissionCard key={a.permission_id} permission={a} />
            ))}
          </div>
        </section>
      )}

      {pending.length === 0 && completed.length === 0 && recentScores.length === 0 && (
        <div className="text-center py-16">
          <ClipboardList className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-500">No assessments assigned yet.</p>
          <p className="text-sm text-neutral-400 mt-1">Your doctor will assign assessments for you.</p>
        </div>
      )}
    </div>
  );
}

function AssessmentPermissionCard({ permission }: { permission: AssessmentPermission }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-900 truncate">{permission.disease_name}</p>
          <p className="text-xs text-neutral-500 mt-0.5">
            Granted {new Date(permission.granted_at).toLocaleDateString()}
            {permission.scales && permission.scales.length > 0 && (
              <> · {permission.scales.length} scale{permission.scales.length !== 1 ? "s" : ""}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            permission.status === "completed"
              ? "bg-success-500/10 text-success-700"
              : permission.status === "granted"
              ? "bg-primary-50 text-primary-700"
              : "bg-neutral-100 text-neutral-500"
          }`}>
            {permission.status}
          </span>
          {permission.status === "granted" && (
            <Link href={`/patient/assessment/${permission.permission_id}`}>
              <Button size="sm">
                <PlayCircle className="h-4 w-4" /> Take Assessment
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreRow({ score }: { score: ScoreSummaryItem }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="h-5 w-5 text-primary-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-neutral-900">
              {score.scale_name ?? score.scale_id}
            </p>
            {score.recorded_at && (
              <p className="text-xs text-neutral-400">
                {new Date(score.recorded_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
        <div className="text-right">
          {score.total_score != null && (
            <p className="text-sm font-bold text-neutral-900">
              {score.total_score}
              {score.max_possible_score != null && (
                <span className="text-neutral-400 font-normal"> / {score.max_possible_score}</span>
              )}
            </p>
          )}
          {score.severity_label && (
            <p className="text-xs text-neutral-500">{score.severity_label}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
