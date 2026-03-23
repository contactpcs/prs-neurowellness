"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useSessions } from "@/lib/hooks";
import { PageLoader, Button, Card, CardContent } from "@/components/ui";
import { AssessmentCard, RiskAlertBanner } from "@/components/assessment";
import { prsService } from "@/lib/api/services";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import type { RiskAlert } from "@/types/prs.types";

export default function CAPatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { sessions, isLoading, loadPatientSessions } = useSessions();
  const [patient, setPatient] = useState<any>(null);
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);

  useEffect(() => {
    loadPatientSessions(id);
    apiClient.get(ENDPOINTS.PATIENTS.DETAIL(id)).then(({ data }) => setPatient(data)).catch(() => {});
    prsService.getPatientAlerts(id, "active").then(({ alerts: a }) => setAlerts(a)).catch(() => {});
  }, [id, loadPatientSessions]);

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">
            {patient ? `${patient.first_name} ${patient.last_name}` : "Patient"}
          </h1>
          {patient?.email && <p className="text-sm text-neutral-500">{patient.email}</p>}
        </div>
        <Link href={`/clinical-assistant/patients/${id}/assign`}>
          <Button><Plus className="h-4 w-4" /> Assign Assessment</Button>
        </Link>
      </div>

      {alerts.length > 0 && <RiskAlertBanner alerts={alerts} />}

      <div className="space-y-3">
        {sessions.map((s) => (
          <AssessmentCard key={s.id} session={s} basePath="/clinical-assistant" />
        ))}
        {sessions.length === 0 && (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-neutral-500">No assessments assigned yet</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
