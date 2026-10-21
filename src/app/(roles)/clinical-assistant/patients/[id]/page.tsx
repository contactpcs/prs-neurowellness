"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock, PlayCircle, Plus } from "lucide-react";
import { usePatientPermissions } from "@/lib/hooks";
import { usePatientClinicalSessions } from "@/lib/hooks/usePatientClinicalSessions";
import { usePatientVisitSummary } from "@/lib/hooks/usePatientVisitSummary";
import { staffService } from "@/lib/api/services/staff.service";
import { prsService } from "@/lib/api/services/prs.service";
import { appointmentsService } from "@/lib/api/services/appointments.service";
import { useAppDispatch } from "@/store/hooks";
import { invalidatePatientAnamnesis } from "@/store/slices/anamnesisSlice";
import { PatientDetailSkeleton, Button, Card, CardContent } from "@/components/ui";
import { RiskAlertBanner } from "@/components/assessment";
import { AnamnesisForm } from "@/components/assessment/AnamnesisForm";
import { SessionTabsBar } from "@/components/doctor/SessionTabsBar";
import { TreatmentProtocolPanel, DeviceSessionsPanel } from "@/components/doctor/TreatmentProtocolPanel";
import { ClinicalActivityPanel } from "@/components/doctor/ClinicalActivityPanel";
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

// Same consultation workspace the doctor has, minus what only a doctor does
// (notes, prescribed medicine, treatment plan, final report). Everything
// taken here is saved under the consultation's appointment, so it shows in
// the doctor's tab for the same visit.
const SECTIONS = [
  { id: "anamnesis", name: "Anamnesis" },
  { id: "prs", name: "PRS" },
  { id: "treatment-protocol", name: "Treatment Protocol" },
  { id: "sessions", name: "Sessions" },
  { id: "activity", name: "Activity Log" },
];

const VISIT_LABELS: Record<string, string> = {
  initial: "Consultation",
  follow_up: "Follow-up",
  protocol_followup: "Protocol Follow-up",
};

// The one next step a clinical assistant can take on a consultation, by its
// current status. Check-in is usually reception's, but the CA may do it too
// so a visit never waits on someone else (backend: scheduling/service.py
// _authorize_transition).
const VISIT_ACTIONS: Record<string, { label: string; run: (id: string) => Promise<unknown> }> = {
  paid: { label: "Check In", run: (id) => appointmentsService.checkIn(id) },
  checked_in: { label: "Start Consultation", run: (id) => appointmentsService.start(id) },
  in_progress: { label: "Complete Consultation", run: (id) => appointmentsService.complete(id) },
};
// Furthest-along visit first: finish the one in progress before starting another.
const VISIT_ORDER = ["in_progress", "checked_in", "paid"];

type Visit = { appointment_id: string; appointment_type?: string; appointment_date: string; start_time: string; status: string };

export default function CAPatientWorkspacePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dispatch = useAppDispatch();

  // usePatientPermissions -> permissionsService.getPatientPermissions, the
  // real patient_scale_assignments-backed source. Newest first — the API's
  // own order isn't necessarily by date.
  const assessments = usePatientPermissions(id)
    .slice()
    .sort((a, b) => (b.granted_at ?? "").localeCompare(a.granted_at ?? ""));
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([staffService.getPatient(id), prsService.getPatientAlerts(id, "active")])
      .then(([patientData, { alerts: a }]) => {
        setPatient(patientData);
        setAlerts(a);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [id]);

  // A tab exists only once the doctor has clicked "Start Consultation" on the
  // appointment (usePatientClinicalSessions) — same rule as the doctor
  // workspace. No ?session= means the first Consultation.
  const selectedSection = searchParams.get("section") ?? "anamnesis";
  const sessionId = searchParams.get("session");
  const { sessions: clinicalSessions, isLoading: sessionsLoading, reload: reloadSessions } = usePatientClinicalSessions(id);

  // The consultation waiting on a check-in / start / complete, if any.
  const [nextVisit, setNextVisit] = useState<Visit | null>(null);
  const [visitBusy, setVisitBusy] = useState(false);
  const [visitError, setVisitError] = useState<string | null>(null);
  // Bumped after a status change: SessionTabsBar keeps its own copy of the
  // sessions list, remounting it is what makes a newly started tab appear.
  const [tabsKey, setTabsKey] = useState(0);
  const loadNextVisit = useCallback(() => {
    appointmentsService
      .list({ limit: 200, patient_id: id })
      .then(({ appointments }) => {
        const open = (appointments as Visit[])
          .filter((a) => a.appointment_type !== "device_session" && VISIT_ORDER.includes(a.status))
          .sort(
            (a, b) =>
              VISIT_ORDER.indexOf(a.status) - VISIT_ORDER.indexOf(b.status) ||
              (a.appointment_date + a.start_time).localeCompare(b.appointment_date + b.start_time),
          );
        setNextVisit(open[0] ?? null);
      })
      .catch(() => setNextVisit(null));
  }, [id]);
  useEffect(loadNextVisit, [loadNextVisit]);

  const runVisitAction = async (visit: Visit) => {
    if (visit.status === "in_progress" && !window.confirm("Complete this consultation? Its anamnesis can no longer be changed afterwards.")) return;
    setVisitBusy(true);
    setVisitError(null);
    try {
      await VISIT_ACTIONS[visit.status].run(visit.appointment_id);
      // Starting a visit opens its tab: land on it.
      if (visit.status === "checked_in") {
        router.replace(visit.appointment_type === "initial" ? pathname : `${pathname}?session=${visit.appointment_id}`, { scroll: false });
      }
      loadNextVisit();
      reloadSessions();
      setTabsKey((k) => k + 1);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: { message?: string }; detail?: string } } };
      setVisitError(err?.response?.data?.error?.message || err?.response?.data?.detail || "Could not update the appointment. Please try again.");
    } finally {
      setVisitBusy(false);
    }
  };
  const currentSession =
    clinicalSessions.find((s) => (sessionId ? s.appointment.appointment_id === sessionId : s.appointment.appointment_type === "initial")) ??
    null;
  const appointmentId = currentSession?.appointment.appointment_id ?? null;
  const consultationNotStarted = !sessionsLoading && !currentSession;
  // The backend takes a staff anamnesis only while the consultation is in
  // progress (CONSULTATION_NOT_STARTED / ANAMNESIS_LOCKED). A PRS is not gated.
  const consultationOpen = currentSession?.appointment.status === "in_progress";
  const { summary: visitSummary, isLoading: visitSummaryLoading, reload: reloadVisitSummary } = usePatientVisitSummary(id, appointmentId);

  const setSelectedSection = useCallback(
    (section: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (section === "anamnesis") params.delete("section");
      else params.set("section", section);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  if (isLoading) return <PatientDetailSkeleton />;

  const fullName = patient?.full_name || "Patient";
  const age = patient?.date_of_birth ? new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear() : null;

  return (
    <div className="space-y-4">
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

      {/* Consultation / Follow-up / Protocol Follow-up tabs. The first
          Consultation is the tab with no ?session= — only pass a session id
          for the others, the same way the bar itself builds its links. */}
      <SessionTabsBar
        key={tabsKey}
        patientId={id}
        activeSessionId={currentSession?.appointment.appointment_type === "initial" ? null : sessionId}
      />

      {nextVisit && (
        <div className="rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap bg-white border border-neutral-200 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-neutral-900">
              {VISIT_LABELS[nextVisit.appointment_type ?? ""] ?? "Consultation"} · {new Date(nextVisit.appointment_date).toLocaleDateString()}{" "}
              {nextVisit.start_time?.slice(0, 5)}
            </p>
            <p className="text-xs text-neutral-500">{statusLabel(nextVisit.status)}</p>
            {visitError && <p className="text-xs text-red-600 mt-1">{visitError}</p>}
          </div>
          <Button size="sm" variant="primary" isLoading={visitBusy} onClick={() => runVisitAction(nextVisit)}>
            {VISIT_ACTIONS[nextVisit.status].label}
          </Button>
        </div>
      )}

      {consultationNotStarted && !nextVisit && (
        <div className="rounded-xl px-4 py-3 flex items-center gap-3 bg-amber-50 border border-amber-200">
          <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-900">Consultation not started</p>
            <p className="text-xs text-amber-700">
              Anamnesis opens here once a consultation is booked, paid, checked in and started. A PRS can be taken at any time.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        <div className="w-full lg:w-64 bg-white rounded-lg shadow-md overflow-hidden self-start">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => setSelectedSection(section.id)}
              className={`w-full px-4 py-4 text-left transition-colors border-l-4 font-medium ${
                selectedSection === section.id
                  ? "bg-blue-50 border-l-blue-500 text-blue-700"
                  : "bg-white border-l-transparent text-neutral-700 hover:bg-neutral-50"
              }`}
            >
              {section.name}
            </button>
          ))}
        </div>

        <div className="flex-1 bg-white rounded-lg shadow-md p-4 sm:p-8 min-w-0">
          {selectedSection === "treatment-protocol" ? (
            <TreatmentProtocolPanel patientId={id} />
          ) : selectedSection === "sessions" ? (
            <DeviceSessionsPanel patientId={id} />
          ) : selectedSection === "activity" ? (
            <ClinicalActivityPanel patientId={id} />
          ) : selectedSection === "prs" ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-bold text-neutral-900 mb-1">PRS Assessments</h2>
                <p className="text-neutral-600 text-sm">
                  {appointmentId
                    ? "Taken on the patient's behalf, saved under this consultation."
                    : "Taken on the patient's behalf. No consultation needed."}
                </p>
              </div>
              {assessments.map((a) => (
                <div key={a.permission_id} className="border border-neutral-200 rounded-lg p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900 truncate">{a.disease_name || a.disease_id}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {a.scale_ids.length} scale{a.scale_ids.length === 1 ? "" : "s"} · Assigned{" "}
                      {a.granted_at ? new Date(a.granted_at).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${PERM_BADGE[a.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {statusLabel(a.status)}
                    </span>
                    {/* Only a granted, not-yet-taken assignment can be started —
                        at any time, with or without a consultation. */}
                    {a.status === "granted" && (
                      <Link href={`/clinical-assistant/patients/${id}/assessment/${a.permission_id}${appointmentId ? `?session=${appointmentId}` : ""}`}>
                        <Button size="sm" variant="primary">
                          <PlayCircle className="h-4 w-4" /> Start Assessment
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
              {assessments.length === 0 && (
                <div className="py-10 text-center border border-dashed border-neutral-200 rounded-lg">
                  <p className="text-neutral-500">No assessments assigned yet</p>
                </div>
              )}
            </div>
          ) : (
            <AnamnesisForm
              patientId={id}
              mode="doctor"
              assessmentStage="main"
              // This consultation's own record (null = none taken yet) —
              // the same one the doctor's tab for this visit shows.
              initialRecord={visitSummaryLoading ? undefined : (visitSummary?.anamnesis ?? null)}
              onSubmitted={() => {
                dispatch(invalidatePatientAnamnesis({ patientId: id, stage: "main" }));
                reloadVisitSummary();
              }}
              lockedForSession={!consultationOpen}
              appointmentId={appointmentId}
            />
          )}
        </div>
      </div>
    </div>
  );
}
