"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";
import { usePatientPermissions } from "@/lib/hooks";
import { staffService } from "@/lib/api/services/staff.service";
import { prsService } from "@/lib/api/services/prs.service";
import { PageLoader, Button, Card, CardContent } from "@/components/ui";
import { RiskAlertBanner } from "@/components/assessment";
import type { PatientDetail } from "@/types/domain.types";
import type { RiskAlert } from "@/types/prs.types";

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const PERM_BADGE: Record<string, string> = {
  granted: "bg-blue-50 text-blue-700",
  completed: "bg-green-50 text-green-700",
  expired: "bg-yellow-50 text-yellow-700",
  revoked: "bg-red-50 text-red-700",
};

export default function CAPatientProfilePage() {
  const { id } = useParams<{ id: string }>();
  // usePatientPermissions -> permissionsService.getPatientPermissions, the
  // real patient_scale_assignments-backed source. useSessions().sessions
  // used to be here, but it reads prsService.getPatientSessions — a stub
  // that always returns [] (the old AssessmentSession model, unconnected
  // to what Assign Assessment actually writes) — so this list stayed
  // "No assessments assigned yet" no matter how many were really assigned.
  const assessmentsRaw = usePatientPermissions(id);
  // Newest first — usePatientPermissions returns whatever order the API
  // sent, not necessarily by date.
  const assessments = assessmentsRaw.slice().sort((a, b) => (b.granted_at ?? "").localeCompare(a.granted_at ?? ""));
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      staffService.getPatient(id),
      prsService.getPatientAlerts(id, "active"),
    ]).then(([patientData, { alerts: a }]) => {
      setPatient(patientData);
      setAlerts(a);
    }).catch(() => {}).finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) return <PageLoader />;

  const fullName = patient?.full_name || "Patient";
  const age = patient?.date_of_birth
    ? new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">{fullName}</h1>
          <div className="flex items-center gap-3 text-sm text-neutral-500 mt-0.5">
            {age && <span>{age} yrs</span>}
            {patient?.gender && <span className="capitalize">{patient.gender}</span>}
            {patient?.email && <span>{patient.email}</span>}
            {patient?.mrn && <span>MRN: {patient.mrn}</span>}
          </div>
        </div>
        <Link href={`/clinical-assistant/patients/${id}/assign`}>
          <Button><Plus className="h-4 w-4" /> Assign Assessment</Button>
        </Link>
      </div>

      {patient?.condition && (
        <Card>
          <CardContent>
            <p className="text-xs text-neutral-500 uppercase mb-1">Condition</p>
            <p className="text-sm font-medium text-neutral-900">{patient.condition}</p>
          </CardContent>
        </Card>
      )}

      {alerts.length > 0 && <RiskAlertBanner alerts={alerts} />}

      <section>
        <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Sessions</h2>
        <div className="space-y-3">
          {assessments.map((a) => {
            const takeable = a.status === "granted";
            const card = (
              <Card className={takeable ? "hover:border-primary-300 transition-colors" : ""}>
                <CardContent className="flex items-center justify-between gap-4 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900 truncate">{a.disease_name || a.disease_id}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {a.scale_ids.length} scale{a.scale_ids.length === 1 ? "" : "s"} · Assigned{" "}
                      {a.granted_at ? new Date(a.granted_at).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0 ${PERM_BADGE[a.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {statusLabel(a.status)}
                  </span>
                </CardContent>
              </Card>
            );
            // Only an ungranted-but-not-yet-taken assignment is clickable —
            // completed/expired/revoked have nothing left to do here.
            return takeable ? (
              <Link key={a.permission_id} href={`/clinical-assistant/patients/${id}/assessment/${a.permission_id}`}>
                {card}
              </Link>
            ) : (
              <div key={a.permission_id}>{card}</div>
            );
          })}
          {assessments.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-neutral-500">No assessments assigned yet</p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>
    </div>
  );
}
