"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, AlertTriangle, ClipboardCheck, Activity } from "lucide-react";
import { useSessions } from "@/lib/hooks";
import { prsService } from "@/lib/api/services";
import { PageLoader, Card, CardContent, Button } from "@/components/ui";
import { RiskAlertBanner } from "@/components/assessment";
import type { RiskAlert } from "@/types/prs.types";

export default function CADashboard() {
  const { sessions, isLoading, loadMySessions } = useSessions();
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);

  useEffect(() => { loadMySessions(); }, [loadMySessions]);
  useEffect(() => {
    prsService.getMyAlerts("active").then(({ alerts: a }) => setAlerts(a)).catch(() => {});
  }, []);

  if (isLoading) return <PageLoader />;

  const pendingCount = sessions.filter(s => s.status === "assigned").length;
  const inProgressCount = sessions.filter(s => s.status === "in_progress").length;
  const completedCount = sessions.filter(s => s.status === "completed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Dashboard</h1>
        <Link href="/clinical-assistant/patients">
          <Button>
            <Users className="h-4 w-4" /> View All Patients
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "Assigned", value: pendingCount, icon: ClipboardCheck, color: "text-primary-500" },
          { label: "In Progress", value: inProgressCount, icon: Activity, color: "text-warning-500" },
          { label: "Completed", value: completedCount, icon: ClipboardCheck, color: "text-success-500" },
          { label: "Active Alerts", value: alerts.length, icon: AlertTriangle, color: "text-danger-500" },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg bg-neutral-50 flex items-center justify-center ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{stat.value}</p>
                <p className="text-xs text-neutral-500">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {alerts.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Risk Alerts</h2>
          <RiskAlertBanner alerts={alerts} />
        </section>
      )}

      <section>
        <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Recent Sessions</h2>
        <Card>
          <div className="divide-y divide-neutral-100">
            {sessions.slice(0, 10).map((s) => (
              <Link key={s.id} href={`/clinical-assistant/sessions/${s.id}`} className="block px-6 py-3 hover:bg-neutral-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-neutral-900">{s.title || s.condition_id || "Assessment"}</span>
                    <span className="text-xs text-neutral-500 ml-2">Patient: {s.patient_id.slice(0, 8)}...</span>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    s.status === "completed" ? "bg-success-500/10 text-success-700" :
                    s.status === "in_progress" ? "bg-warning-50 text-warning-700" :
                    "bg-neutral-100 text-neutral-600"
                  }`}>
                    {s.status.replace("_", " ")}
                  </span>
                </div>
              </Link>
            ))}
            {sessions.length === 0 && (
              <div className="px-6 py-8 text-center text-neutral-500 text-sm">No sessions yet</div>
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
