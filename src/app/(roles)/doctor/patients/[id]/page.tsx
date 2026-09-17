"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ChevronLeft, Plus, HelpCircle, Bell, Check, Lock, PlayCircle, BarChart2, Save, FileText, Pill, NotebookPen, X } from "lucide-react";
import { PatientDetailSkeleton, Button } from "@/components/ui";
import { AnamnesisForm } from "@/components/assessment/AnamnesisForm";
import { adminService } from "@/lib/api/services/admin.service";
import { PatientJourneySections, type PatientJourneyDetail } from "@/components/admin/PatientJourneySections";
import { PatientHistoryPanel, type Tab as PatientHistoryTab } from "@/components/admin/PatientHistoryPanel";
import {
  useDoctorPatient,
  useDoctorPatients,
  usePatientPermissions,
  usePatientScoresSummary,
  usePatientAnamnesis,
  useAuth,
} from "@/lib/hooks";
import { useAppDispatch } from "@/store/hooks";
import { invalidatePatientAnamnesis } from "@/store/slices/anamnesisSlice";
import type { Permission, AssessmentInstance, AnamnesisRecord } from "@/types/domain.types";
import { EEGReportList, EEGUploadForm, NEDFUploadForm } from "@/components/eeg";
import { TreatmentProtocolPanel, DeviceSessionsPanel } from "@/components/doctor/TreatmentProtocolPanel";
import { SessionTabsBar } from "@/components/doctor/SessionTabsBar";
import { SessionFinalReportModal } from "@/components/doctor/SessionFinalReportModal";
import { CompareSessionsModal } from "@/components/doctor/CompareSessionsModal";
import { usePatientClinicalSessions } from "@/lib/hooks/usePatientClinicalSessions";
import { useGoBack } from "@/lib/hooks/useGoBack";
import { usePatientVisitSummary } from "@/lib/hooks/usePatientVisitSummary";
import { treatmentProtocolService } from "@/lib/api/services/treatmentProtocol.service";
import type { ProtocolRead } from "@/types/treatmentProtocol.types";
import { TreatmentPlanFull } from "@/components/doctor/TreatmentPlanFull";
import { isFinalReportGenerated, markFinalReportGenerated } from "@/lib/utils/finalReportLock";

function statusClass(status: Permission["status"]): string {
  switch (status) {
    case "granted": return "bg-blue-50 text-blue-700";
    case "completed": return "bg-green-50 text-green-700";
    case "expired": return "bg-yellow-50 text-yellow-700";
    case "revoked": return "bg-red-50 text-red-700";
    default: return "bg-neutral-100 text-neutral-600";
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

const NOTE_CATEGORIES = ["Consultation", "Assessment Review", "Treatment Review", "Session Review", "Follow-up", "General"];

const SECTION_LABELS: Record<string, string> = {
  "registration-record": "Registration Record",
  anamnesis: "Anamnesis",
  "brain-mapping": "Brain Mapping",
  prs: "PRS",
  notes: "Doctor's Notes",
  "medical-history": "Medical History",
  medicine: "Prescribed Medicine",
  "treatment-protocol": "Treatment Protocol",
  sessions: "Sessions",
  "treatment-plan": "Treatment Plan",
  "final-report": "Final Report",
};

type DoctorNoteEntry = {
  date: string;
  author: string;
  category: string;
  body: string;
};

const MEDICINE_TIMINGS = ["Morning", "Afternoon", "Evening", "Night", "Twice daily", "Three times daily", "As needed"];
const MEDICINE_MEALS = ["Before meal", "After meal", "With meal", "Empty stomach", "Not applicable"];

type PrescribedMedicine = {
  id: string;
  name: string;
  dose: string;
  timing: string;
  meal: string;
  duration: string;
  note: string;
  started: string;
  status: "Active" | "Stopped";
};

function buildSections(
  anamnesisStatus: "in_progress" | "completed" | null,
  hasDoctorNote: boolean,
  // Registration Record is the self-registration anamnesis + general PRS —
  // it only ever existed once, at intake, so it has no meaning under a
  // Follow-up / Protocol Follow-up session context.
  isFollowUpContext: boolean,
  treatmentPlanLocked: boolean,
) {
  return [
    ...(isFollowUpContext ? [] : [{ id: "registration-record", name: "Registration Record", status: null }]),
    { id: "anamnesis", name: "Anamnesis", status: anamnesisStatus === "completed" ? "done" : anamnesisStatus === "in_progress" ? "start" : null },
    // "brain-mapping" hidden for now — kept as a valid selectedSection id
    // below so a stale ?section=brain-mapping deep link or the treatment
    // plan checklist's old go: "brain-mapping" doesn't render a blank pane.
    { id: "prs", name: "PRS", status: "start" },
    { id: "notes", name: "Doctor's Notes", status: hasDoctorNote ? "done" : null },
    { id: "medical-history", name: "Medical History", status: "link" },
    { id: "medicine", name: "Prescribed Medicine", status: null },
    { id: "treatment-protocol", name: "Treatment Protocol", status: null },
    { id: "sessions", name: "Sessions", status: null },
    { id: "treatment-plan", name: "Treatment Plan", status: treatmentPlanLocked ? "locked" : null },
    { id: "final-report", name: "Final Report", status: null },
  ];
}

export default function DoctorPatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const goBack = useGoBack("/doctor/patients");
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const dispatch = useAppDispatch();
  const { patient, isLoading: patientLoading, isError: patientError, error: patientErrorMessage } = useDoctorPatient(id);
  const { patients: patientList } = useDoctorPatients();
  const assessments = usePatientPermissions(id);
  const { instances: scoreInstances, total: totalAssessments } = usePatientScoresSummary(id);
  const { record: anamnesisRecord, isLoading: anamnesisLoading } = usePatientAnamnesis(id, "main");
  const { user: currentUser } = useAuth();
  const doctorDisplayName = [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(" ") || "Doctor";
  const [headerSearch, setHeaderSearch] = useState("");

  const isLoading = patientLoading;

  const rawSelectedSection = searchParams.get("section") ?? "anamnesis";
  const sessionId = searchParams.get("session");
  // Registration Record only exists for the Consultation — never render it
  // under a Follow-up / Protocol Follow-up session context even if the URL
  // still carries an old ?section=registration-record.
  const selectedSection = sessionId && rawSelectedSection === "registration-record" ? "anamnesis" : rawSelectedSection;
  const { sessions: clinicalSessions, isLoading: sessionsLoading, hasStartedConsultation } = usePatientClinicalSessions(id);
  const currentSessionIdx = sessionId
    ? clinicalSessions.findIndex((s) => s.appointment.appointment_id === sessionId)
    : clinicalSessions.findIndex((s) => s.appointment.appointment_type === "initial");
  const currentSession = currentSessionIdx >= 0 ? clinicalSessions[currentSessionIdx] : null;
  // Per-visit bundle for the currently selected toggle — anamnesis here is
  // that visit's own (or null, "no anamnesis taken"), never the patient-wide
  // "latest" usePatientAnamnesis returns. Refetches on toggle switch so
  // Follow-up 1's own record can never bleed into what Initial shows.
  const { summary: visitSummary, isLoading: visitSummaryLoading, reload: reloadVisitSummary } = usePatientVisitSummary(
    id,
    currentSession?.appointment.appointment_id ?? null,
  );
  const isLatestSession = currentSessionIdx >= 0 && currentSessionIdx === clinicalSessions.length - 1;
  // The workspace is editable ONLY while the session being viewed is the
  // newest one the doctor has clicked "Start Consultation" on. Two read-only
  // cases, both driven purely by that action (never by check-in / no-show /
  // reschedule):
  //   1. currentSessionIdx < 0 — this session has no tab yet, i.e. its
  //      consultation was never started. Nothing on it may be edited.
  //   2. !isLatestSession — a newer Consultation/Follow-up has since been
  //      started, so this record is frozen historical data.
  // Guarded by !sessionsLoading to avoid a "locked" flash on first render.
  const consultationNotStarted = !sessionsLoading && currentSessionIdx < 0;
  const sessionLocked = !sessionsLoading && (currentSessionIdx < 0 || !isLatestSession);
  const [finalReportFor, setFinalReportFor] = useState<typeof currentSession>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [finalReportProtocol, setFinalReportProtocol] = useState<ProtocolRead | null>(null);
  // Bumped whenever a Final Report is generated so isFinalReportGenerated()
  // (backed by localStorage, not otherwise reactive) gets re-checked.
  const [finalReportLockTick, setFinalReportLockTick] = useState(0);
  const openFinalReport = useCallback((session: typeof currentSession) => {
    if (!session) return;
    markFinalReportGenerated(session.appointment.appointment_id);
    setFinalReportLockTick((t) => t + 1);
    setFinalReportFor(session);
  }, []);
  const treatmentPlanLocked = useMemo(
    () => sessionLocked || (currentSession ? isFinalReportGenerated(currentSession.appointment.appointment_id) : false),
    [sessionLocked, currentSession, finalReportLockTick],
  );

  useEffect(() => {
    if (!finalReportFor) { setFinalReportProtocol(null); return; }
    const cutoff = new Date(finalReportFor.appointment.appointment_date + "T23:59:59").getTime();
    treatmentProtocolService
      .listProtocols({ patientId: id })
      .then((list) => {
        const before = list
          .filter((p) => p.created_at && new Date(p.created_at).getTime() <= cutoff)
          .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
        setFinalReportProtocol(before[0] ?? null);
      })
      .catch(() => setFinalReportProtocol(null));
  }, [finalReportFor, id]);

  const updateQuery = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setSelectedSection = useCallback(
    (s: string) => updateQuery({ section: s === "anamnesis" ? null : s }),
    [updateQuery],
  );
  const [basicOpen, setBasicOpen] = useState(true);
  const [eegRefreshKey, setEegRefreshKey] = useState(0);
  const [showEegUpload, setShowEegUpload] = useState(false);
  const [eegUploadTab, setEegUploadTab] = useState<"nedf" | "pdf">("nedf");
  const [registrationRecord, setRegistrationRecord] = useState<Record<string, unknown> | null>(null);
  const [registrationRecordError, setRegistrationRecordError] = useState<string | null>(null);
  // Not backed by an API yet (no medications table/endpoints exist) — kept
  // client-side per patient, so it resets on reload/navigation.
  const [medicines, setMedicines] = useState<PrescribedMedicine[]>([]);
  const [medForm, setMedForm] = useState<Omit<PrescribedMedicine, "id" | "started" | "status"> | null>(null);
  // Real backend only has POST /doctor-session-notes (keyed to a session/
  // cycle, not patient) — no list-by-patient endpoint exists, so this
  // chronological, categorized notes feed is client-side only and resets
  // on reload/navigation, same as Prescribed Medicine above.
  const [doctorNotes, setDoctorNotes] = useState<DoctorNoteEntry[]>([]);
  const [noteAdding, setNoteAdding] = useState(false);
  const [newNoteCategory, setNewNoteCategory] = useState(NOTE_CATEGORIES[0]);
  const [newNoteBody, setNewNoteBody] = useState("");
  const [noteWidgetOpen, setNoteWidgetOpen] = useState(false);
  const [widgetCategory, setWidgetCategory] = useState(NOTE_CATEGORIES[0]);
  const [widgetBody, setWidgetBody] = useState("");
  const [widgetSaved, setWidgetSaved] = useState(false);

  useEffect(() => {
    setMedicines([]);
    setMedForm(null);
  }, [id]);

  // Registration Record = anamnesis + general PRS taken during self-
  // registration (assessment_stage='general_registration',
  // tagged separately from the "Anamnesis"/"PRS" tabs above, which are for
  // ongoing treatment-session assessments and untouched by this).
  useEffect(() => {
    setRegistrationRecord(null);
    setRegistrationRecordError(null);
    adminService.getPatientDetail(id).then(setRegistrationRecord).catch(() => setRegistrationRecordError("Couldn't load registration record"));
  }, [id]);

  // Reset immediately on patient switch so a previous patient's notes can
  // never linger against the wrong patient.
  useEffect(() => {
    setDoctorNotes([]);
    setNoteAdding(false);
    setNoteWidgetOpen(false);
    setWidgetBody("");
  }, [id]);

  // Auto-expand upload panel when user returns to brain-mapping and a job is still running
  useEffect(() => {
    if (selectedSection !== "brain-mapping") return;
    const saved = localStorage.getItem(`eeg_analysis_job_${id}`);
    if (!saved) return;
    try {
      const { status } = JSON.parse(saved) as { status: string };
      if (status !== "done" && status !== "failed") {
        setShowEegUpload(true);
        setEegUploadTab("nedf");
      }
    } catch {}
  }, [selectedSection, id]);

  const addDoctorNote = () => {
    if (!newNoteBody.trim()) return;
    setDoctorNotes((list) => [{ date: formatDate(new Date().toISOString()), author: doctorDisplayName, category: newNoteCategory, body: newNoteBody }, ...list]);
    setNewNoteBody("");
    setNoteAdding(false);
  };

  const saveWidgetNote = () => {
    if (!widgetBody.trim()) return;
    setDoctorNotes((list) => [
      { date: formatDate(new Date().toISOString()), author: doctorDisplayName, category: widgetCategory, body: `(from ${SECTION_LABELS[selectedSection] ?? selectedSection}) ${widgetBody}` },
      ...list,
    ]);
    setWidgetBody("");
    setWidgetSaved(true);
    setTimeout(() => { setWidgetSaved(false); setNoteWidgetOpen(false); }, 1400);
  };

  if (isLoading) return <PatientDetailSkeleton />;

  if (patientError || !patient) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-center px-4">
        <p className="text-sm font-medium text-neutral-600">Couldn&apos;t load this patient.</p>
        <p className="text-xs text-neutral-400">{patientErrorMessage || "Please try again."}</p>
        <button
          onClick={() => router.push("/doctor/patients")}
          className="px-4 py-2 text-sm font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors"
        >
          Back to patients
        </button>
      </div>
    );
  }

  const fullName = patient?.full_name || "Patient";
  const currentIdx = patientList.findIndex((p) => p.id === id);
  const prevPatient = currentIdx > 0 ? patientList[currentIdx - 1] : null;
  const nextPatient = currentIdx >= 0 && currentIdx < patientList.length - 1 ? patientList[currentIdx + 1] : null;

  const age = patient?.date_of_birth
    ? new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()
    : null;

  const nextAssessment = (assessments as Permission[]).find((a: Permission) => a.status === "granted");
  const completedAssessments = (assessments as Permission[]).filter((a: Permission) => a.status === "completed");
  const pendingAssessments = (assessments as Permission[]).filter((a: Permission) => a.status === "granted");

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-100 to-neutral-50 -mt-14 md:-mt-6 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6">
      {/* Top Header with Navigation */}
      <div className="bg-white border-b border-neutral-200 px-4 sm:px-8 py-3">
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={goBack}
            className="flex items-center gap-2 text-neutral-700 hover:text-neutral-900 transition-colors text-sm font-medium flex-shrink-0"
          >
            <ChevronRight className="w-5 h-5 -scale-x-100" />
            <span className="hidden sm:inline">Back</span>
          </button>
          <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
            <div className="relative flex-1 max-w-xs bg-white border border-neutral-200 rounded-full flex items-center px-4 py-2 shadow-sm hidden sm:flex">
              <input
                type="text"
                placeholder="Search patients..."
                value={headerSearch}
                onChange={(e) => setHeaderSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && headerSearch.trim()) {
                    router.push(`/doctor/patients?q=${encodeURIComponent(headerSearch.trim())}`);
                  }
                }}
                className="flex-1 bg-transparent outline-none text-sm text-neutral-600 placeholder:text-neutral-400"
              />
            </div>
            <button className="w-9 h-9 rounded-full bg-white hover:bg-neutral-50 flex items-center justify-center transition-colors shadow-sm border border-neutral-200 flex-shrink-0">
              <HelpCircle className="w-4 h-4 text-neutral-600" />
            </button>
            <button className="relative w-9 h-9 rounded-full bg-white hover:bg-neutral-50 flex items-center justify-center transition-colors shadow-sm border border-neutral-200 flex-shrink-0">
              <Bell className="w-4 h-4 text-neutral-600" />
            </button>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-8 py-3 sm:py-5 space-y-3 sm:space-y-4">
        {/* Patient info + Next Activity — two side-by-side cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {/* Left — Patient Name Card */}
          <div className="bg-white rounded-lg shadow-md p-2 sm:p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white font-bold text-xl border-2 border-[#f47920] flex-shrink-0">
                {fullName?.[0]?.toUpperCase()}
              </div>
              <div>
                <h1 className="text-xl font-bold text-neutral-900">{fullName}</h1>
                {patient?.mrn && (
                  <p className="text-sm text-neutral-600">({patient.mrn})</p>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {age && (
                    <span className="text-base text-neutral-700">
                      {age} Yrs{patient?.gender ? ` · ${patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)}` : ""}
                    </span>
                  )}
                  {patient?.approval_status && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg capitalize">
                      {patient.approval_status}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                onClick={() => prevPatient && router.push(`/doctor/patients/${prevPatient.id}`)}
                disabled={!prevPatient}
                className="px-4 py-2 bg-neutral-800 text-white text-sm font-medium rounded-full hover:bg-neutral-700 transition-colors flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                title={prevPatient?.full_name ?? ""}
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <button
                onClick={() => nextPatient && router.push(`/doctor/patients/${nextPatient.id}`)}
                disabled={!nextPatient}
                className="px-4 py-2 bg-neutral-800 text-white text-sm font-medium rounded-full hover:bg-neutral-700 transition-colors flex items-center gap-1.5 disabled:opacity-30 disabled:cursor-not-allowed"
                title={nextPatient?.full_name ?? ""}
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Right — Next Activity Card */}
          <div className="bg-white rounded-lg shadow-md p-2 sm:p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            {nextAssessment ? (
              <>
                <div>
                  <p className="text-neutral-500 text-sm mb-0.5">Next Activity</p>
                  <h3 className="text-xl font-bold text-neutral-900">{nextAssessment.disease_name}</h3>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg">Basic 2/7</span>
                </div>
                <button
                  onClick={() => router.push(`/doctor/patients/${id}/assessment/${nextAssessment.permission_id}${sessionId ? `?session=${sessionId}` : ""}`)}
                  className="px-6 py-3 bg-orange-500 text-white font-semibold text-base rounded-full hover:bg-orange-600 transition-colors flex items-center gap-2 flex-shrink-0"
                >
                  ▶ Start
                </button>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center w-full py-2 text-center">
                <p className="text-neutral-500 text-sm">No pending activity</p>
                <p className="text-neutral-400 text-xs mt-1">Assign an assessment to get started</p>
              </div>
            )}
          </div>
        </div>

        {/* Consultation / Follow-up / Protocol Follow-up session switcher */}
        <SessionTabsBar patientId={id} activeSessionId={sessionId} onCompare={clinicalSessions.length >= 2 ? () => setShowCompare(true) : undefined} />

        {/* Not started yet — no tab has been created for this session because
            the doctor hasn't clicked "Start Consultation". The workspace is
            visible for context but every action on it is read-only until then.
            Check-in / No-Show / Reschedule never unlock it. */}
        {consultationNotStarted && (
          <div className="rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap bg-amber-50 border border-amber-200">
            <Lock className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <div className="flex-1 min-w-[220px]">
              <p className="text-sm font-semibold text-amber-900">
                {sessionId ? "Session not started" : "Consultation not started"}
              </p>
              <p className="text-xs text-amber-700">
                This workspace is read-only until the doctor clicks “Start Consultation” on the appointment.
              </p>
            </div>
          </div>
        )}

        {/* Session context banner — only for a Follow-up / Protocol Follow-up
            session; the Consultation view (no ?session=) doesn't need one. */}
        {currentSession && sessionId && !isLatestSession && (
          <div className="rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap bg-neutral-100 border border-neutral-200">
            <div className="flex items-center gap-2 flex-1 min-w-[220px]">
              <Lock className="w-4 h-4 text-neutral-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-neutral-900">{currentSession.label}</p>
                <p className="text-xs text-neutral-500">This session is frozen — a later session exists, so its data is read-only.</p>
              </div>
            </div>
            <button
              onClick={() => openFinalReport(currentSession)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 text-xs font-semibold flex-shrink-0"
            >
              <FileText className="w-3.5 h-3.5" /> Generate Final Report
            </button>
          </div>
        )}

        {/* Consultation itself is frozen once any Follow-up exists. No
            heading here — the SessionTabsBar above already shows
            "Consultation" as the active tab, so repeating it here just
            duplicates the same label right underneath it. */}
        {!sessionId && clinicalSessions.length > 1 && (
          <div className="rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap bg-neutral-100 border border-neutral-200">
            <Lock className="w-4 h-4 text-neutral-500 flex-shrink-0" />
            <div className="flex-1 min-w-[220px]">
              <p className="text-xs text-neutral-500">This session is frozen — a Follow-up already exists, so its data is read-only.</p>
            </div>
            <button
              onClick={() => clinicalSessions[0] && openFinalReport(clinicalSessions[0])}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-700 text-xs font-semibold flex-shrink-0"
            >
              <FileText className="w-3.5 h-3.5" /> Generate Final Report
            </button>
          </div>
        )}

        {/* Assessment Content */}
        <div className="space-y-6">
          {/* Main Content Area */}
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 min-h-96">
            {/* Left Sidebar - Assessment Sections */}
            <div className="w-full lg:w-72 xl:w-80 bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
              <button
                onClick={() => setBasicOpen((o) => !o)}
                className="border-b border-neutral-200 p-4 flex items-center justify-between w-full text-left hover:bg-neutral-50 transition-colors"
              >
                <h3 className="font-semibold text-neutral-900">Basic</h3>
                <ChevronRight className={`w-5 h-5 text-neutral-600 transition-transform duration-150 ${basicOpen ? "-rotate-90" : "rotate-0"}`} />
              </button>
              <div className={`overflow-y-auto space-y-0 transition-all duration-150 ${basicOpen ? "flex-1" : "hidden"}`}>
                {buildSections(visitSummary?.anamnesis?.status ?? null, doctorNotes.length > 0, !!sessionId, treatmentPlanLocked).map((section) => {
                  return (
                    <button
                      key={section.id}
                      onClick={() => (section.id === "final-report" ? openFinalReport(currentSession) : setSelectedSection(section.id))}
                      className={`w-full px-4 py-4 text-left transition-colors border-l-4 flex items-center justify-between ${
                        selectedSection === section.id
                          ? "bg-blue-50 border-l-blue-500 text-blue-700"
                          : "bg-white border-l-transparent text-neutral-700 hover:bg-neutral-50"
                      }`}
                    >
                      <span className="font-medium">{section.name}</span>
                      {section.status === "done" && (
                        <span className="px-2 py-1 bg-green-50 text-green-700 text-xs font-medium rounded">Done</span>
                      )}
                      {section.status === "start" && (
                        <span className="px-2 py-1 bg-orange-50 text-orange-600 text-xs font-medium rounded">Start</span>
                      )}
                      {section.status === "locked" && (
                        <Lock className="w-4 h-4 text-neutral-400" />
                      )}
                    </button>
                  );
                })}
              </div>
             
            </div>

            {/* Right Content - Assessment Details */}
            <div className="flex-1 bg-white rounded-lg shadow-md p-4 sm:p-8 overflow-y-auto">
              {selectedSection === "medical-history" ? (
                <PatientHistoryPanel
                  patientId={id}
                  clinicId={patient?.clinic_id}
                  initialTab={(searchParams.get("tab") as PatientHistoryTab | null) ?? undefined}
                />
              ) : selectedSection === "registration-record" ? (
                <div className="space-y-5">
                  <div>
                    <h2 className="text-2xl font-bold text-neutral-900 mb-1">Registration Record</h2>
                    <p className="text-neutral-600 text-sm">
                      Anamnesis and general PRS collected during this patient's registration —
                      reference data only, separate from ongoing treatment-session Anamnesis/PRS.
                    </p>
                  </div>
                  {registrationRecordError ? (
                    <p className="text-sm text-red-600">{registrationRecordError}</p>
                  ) : !registrationRecord ? (
                    <p className="text-sm text-neutral-400">Loading…</p>
                  ) : (
                    <PatientJourneySections detail={registrationRecord as unknown as PatientJourneyDetail} />
                  )}
                </div>
              ) : selectedSection === "anamnesis" ? (
                <AnamnesisForm
                  patientId={id}
                  mode="doctor"
                  assessmentStage="main"
                  initialRecord={
                    sessionLocked
                      ? undefined // frozen: let the form self-fetch the patient-wide latest (matches its own banner text) instead of this older visit's own (often-null) get_by_appointment record
                      : visitSummaryLoading
                        ? undefined
                        : (visitSummary?.anamnesis ?? null)
                  }
                  onSubmitted={() => {
                    dispatch(invalidatePatientAnamnesis({ patientId: id, stage: "main" }));
                    reloadVisitSummary();
                  }}
                  lockedForSession={sessionLocked}
                  appointmentId={currentSession?.appointment.appointment_id ?? sessionId}
                  sessionDate={currentSession?.appointment.appointment_date}
                />
              ) : selectedSection === "brain-mapping" ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-neutral-900">Brain Mapping</h2>
                      <p className="text-sm text-neutral-500">EEG analysis and connectivity reports</p>
                    </div>
                    <button
                      onClick={() => setShowEegUpload((v) => !v)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      {showEegUpload ? "Cancel" : "Upload / Analyze"}
                    </button>
                  </div>

                  {showEegUpload && (
                    <div className="space-y-3">
                      {/* Tab switcher */}
                      <div className="flex gap-1 bg-neutral-100 rounded-lg p-1 w-fit">
                        <button
                          onClick={() => setEegUploadTab("nedf")}
                          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            eegUploadTab === "nedf"
                              ? "bg-white text-neutral-900 shadow-sm"
                              : "text-neutral-500 hover:text-neutral-700"
                          }`}
                        >
                          .nedf / .edf
                        </button>
                        <button
                          onClick={() => setEegUploadTab("pdf")}
                          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                            eegUploadTab === "pdf"
                              ? "bg-white text-neutral-900 shadow-sm"
                              : "text-neutral-500 hover:text-neutral-700"
                          }`}
                        >
                          PDF report
                        </button>
                      </div>

                      {eegUploadTab === "nedf" ? (
                        <NEDFUploadForm
                          patientId={id}
                          onComplete={() => { setEegRefreshKey((k) => k + 1); setShowEegUpload(false); }}
                        />
                      ) : (
                        <EEGUploadForm
                          patientId={id}
                          onUploaded={() => { setEegRefreshKey((k) => k + 1); setShowEegUpload(false); }}
                        />
                      )}
                    </div>
                  )}

                  <EEGReportList patientId={id} canDelete refreshTrigger={eegRefreshKey} />
                </div>
              ) : selectedSection === "medicine" ? (
                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <h2 className="text-2xl font-bold text-neutral-900 mb-1">Prescribed Medicine</h2>
                      <p className="text-neutral-600 text-sm">Current and past prescriptions for {fullName}.</p>
                    </div>
                    <Button
                      size="sm"
                      variant={medForm ? "outline" : "primary"}
                      onClick={() => setMedForm(medForm ? null : { name: "", dose: "", timing: MEDICINE_TIMINGS[0], meal: MEDICINE_MEALS[1], duration: "", note: "" })}
                    >
                      {medForm ? "Cancel" : <><Plus className="h-4 w-4" /> Prescribe Medicine</>}
                    </Button>
                  </div>

                  {medForm && (
                    <div className="border border-blue-100 bg-blue-50/50 rounded-lg p-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-neutral-700">Medicine name *</label>
                          <input
                            value={medForm.name}
                            onChange={(e) => setMedForm((f) => f && { ...f, name: e.target.value })}
                            placeholder="e.g. Escitalopram 10 mg"
                            className="w-full mt-1.5 h-9 border border-neutral-200 rounded-lg px-3 text-sm bg-white outline-none focus:border-blue-400"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-neutral-700">Dose</label>
                          <input
                            value={medForm.dose}
                            onChange={(e) => setMedForm((f) => f && { ...f, dose: e.target.value })}
                            placeholder="e.g. 1 tablet"
                            className="w-full mt-1.5 h-9 border border-neutral-200 rounded-lg px-3 text-sm bg-white outline-none focus:border-blue-400"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-neutral-700">Timing</label>
                          <select
                            value={medForm.timing}
                            onChange={(e) => setMedForm((f) => f && { ...f, timing: e.target.value })}
                            className="w-full mt-1.5 h-9 border border-neutral-200 rounded-lg px-3 text-sm bg-white outline-none focus:border-blue-400"
                          >
                            {MEDICINE_TIMINGS.map((t) => <option key={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-neutral-700">Meal instruction</label>
                          <select
                            value={medForm.meal}
                            onChange={(e) => setMedForm((f) => f && { ...f, meal: e.target.value })}
                            className="w-full mt-1.5 h-9 border border-neutral-200 rounded-lg px-3 text-sm bg-white outline-none focus:border-blue-400"
                          >
                            {MEDICINE_MEALS.map((m) => <option key={m}>{m}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-neutral-700">Duration</label>
                          <input
                            value={medForm.duration}
                            onChange={(e) => setMedForm((f) => f && { ...f, duration: e.target.value })}
                            placeholder="e.g. 8 weeks"
                            className="w-full mt-1.5 h-9 border border-neutral-200 rounded-lg px-3 text-sm bg-white outline-none focus:border-blue-400"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-neutral-700">Note</label>
                        <input
                          value={medForm.note}
                          onChange={(e) => setMedForm((f) => f && { ...f, note: e.target.value })}
                          placeholder="Optional prescribing note"
                          className="w-full mt-1.5 h-9 border border-neutral-200 rounded-lg px-3 text-sm bg-white outline-none focus:border-blue-400"
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={!medForm.name.trim()}
                        onClick={() => {
                          setMedicines((list) => [
                            { id: `m${Date.now()}`, ...medForm, started: formatDate(new Date().toISOString()), status: "Active" },
                            ...list,
                          ]);
                          setMedForm(null);
                        }}
                      >
                        <Save className="h-4 w-4" /> Save Prescription
                      </Button>
                    </div>
                  )}

                  {medicines.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-neutral-200 rounded-lg">
                      <Pill className="w-6 h-6 text-neutral-300 mb-2" />
                      <p className="text-neutral-600 font-medium mb-1">No medicine prescribed yet</p>
                      <p className="text-neutral-500 text-sm">Prescribe medicine to start tracking it here</p>
                    </div>
                  ) : (
                    <div className="border border-neutral-200 rounded-lg overflow-x-auto">
                      <div className="min-w-[820px]">
                        <div className="grid grid-cols-[1.6fr_0.9fr_1fr_1.3fr_0.9fr_0.9fr_0.9fr] gap-2.5 px-4 py-2.5 bg-neutral-50 border-b border-neutral-200 text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">
                          <span>Medicine</span><span>Dose</span><span>Timing</span><span>Meal Instruction</span><span>Duration</span><span>Started</span><span>Status</span>
                        </div>
                        {medicines.map((m, i) => (
                          <div
                            key={m.id}
                            className={`grid grid-cols-[1.6fr_0.9fr_1fr_1.3fr_0.9fr_0.9fr_0.9fr] gap-2.5 items-center px-4 py-3 ${i < medicines.length - 1 ? "border-b border-neutral-100" : ""} ${m.status === "Stopped" ? "opacity-60" : ""}`}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-neutral-900">{m.name}</p>
                              {m.note && <p className="text-xs text-neutral-400 mt-0.5">{m.note}</p>}
                            </div>
                            <span className="text-xs text-neutral-700">{m.dose || "—"}</span>
                            <span className="text-xs text-neutral-700">{m.timing}</span>
                            <span className="text-xs text-neutral-700">{m.meal}</span>
                            <span className="text-xs text-neutral-600">{m.duration || "—"}</span>
                            <span className="text-xs text-neutral-500">{m.started}</span>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full w-fit ${m.status === "Active" ? "bg-green-50 text-green-700" : "bg-neutral-100 text-neutral-600"}`}>
                                {m.status}
                              </span>
                              <button
                                onClick={() => setMedicines((list) => list.map((x) => x.id === m.id ? { ...x, status: x.status === "Active" ? "Stopped" : "Active" } : x))}
                                className="text-xs font-medium text-neutral-400 hover:text-neutral-600 transition-colors"
                              >
                                {m.status === "Active" ? "Stop" : "Resume"}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : selectedSection === "treatment-protocol" ? (
                <TreatmentProtocolPanel patientId={id} />
              ) : selectedSection === "treatment-plan" ? (
                <TreatmentPlanFull
                  patientId={id}
                  patient={patient}
                  clinicalSessions={clinicalSessions}
                  sessionLocked={sessionLocked}
                  doctorNoteText={doctorNotes[0]?.body ?? null}
                  onNavigateSection={setSelectedSection}
                  onGenerateFinalReport={() => openFinalReport(currentSession)}
                />
              ) : selectedSection === "sessions" ? (
                <DeviceSessionsPanel patientId={id} />
              ) : selectedSection === "notes" ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <h2 className="text-2xl font-bold text-neutral-900 mb-1">Doctor's Notes</h2>
                      <p className="text-neutral-600 text-sm">Chronological clinical record for {fullName}.</p>
                    </div>
                    <Button size="sm" variant={noteAdding ? "outline" : "primary"} onClick={() => setNoteAdding((a) => !a)}>
                      {noteAdding ? "Cancel" : <><Plus className="h-4 w-4" /> Add Clinical Note</>}
                    </Button>
                  </div>

                  {noteAdding && (
                    <div className="border border-blue-100 bg-blue-50/50 rounded-lg p-4 space-y-3">
                      <div>
                        <label className="text-xs font-semibold text-neutral-700">Category</label>
                        <select
                          value={newNoteCategory}
                          onChange={(e) => setNewNoteCategory(e.target.value)}
                          className="w-full mt-1.5 h-9 border border-neutral-200 rounded-lg px-3 text-sm bg-white outline-none focus:border-blue-400"
                        >
                          {NOTE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-neutral-700">Note</label>
                        <textarea
                          value={newNoteBody}
                          onChange={(e) => setNewNoteBody(e.target.value)}
                          rows={4}
                          placeholder="Clinical observations, plan, and next steps…"
                          className="w-full mt-1.5 border border-neutral-200 rounded-lg p-3 text-sm text-neutral-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-colors resize-y"
                        />
                      </div>
                      <Button size="sm" variant="primary" disabled={!newNoteBody.trim()} onClick={addDoctorNote}>
                        <Save className="h-4 w-4" /> Save Note
                      </Button>
                    </div>
                  )}

                  {doctorNotes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-neutral-200 rounded-lg">
                      <p className="text-neutral-600 font-medium mb-1">No clinical notes yet</p>
                      <p className="text-neutral-500 text-sm">Add a note to start this patient&apos;s clinical record</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {doctorNotes.map((n, i) => (
                        <div key={i} className="border border-neutral-200 border-l-4 border-l-blue-400 rounded-lg p-4">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-neutral-900">{n.date}</span>
                              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700">{n.category}</span>
                            </div>
                            <span className="text-xs text-neutral-400">{n.author}</span>
                          </div>
                          <p className="text-sm text-neutral-800 mt-2 leading-relaxed">{n.body}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                // PRS View - Show Completed Assessments
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-neutral-900 mb-1">PRS Assessments</h2>
                      <p className="text-neutral-600 text-sm">Completed assessments and assignment options</p>
                    </div>
                    <Link href={`/doctor/patients/${id}/assign`}>
                      <Button size="sm" variant="primary">
                        <Plus className="h-4 w-4" /> Assign New Assessment
                      </Button>
                    </Link>
                  </div>

                  {/* Summary Stats */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-neutral-600 text-sm mb-1">Total Assessments</p>
                      <p className="text-2xl font-bold text-neutral-900">{totalAssessments || assessments.length}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-neutral-600 text-sm mb-1">Completed</p>
                      <p className="text-2xl font-bold text-neutral-900">{completedAssessments.length}</p>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-4">
                      <p className="text-neutral-600 text-sm mb-1">Pending</p>
                      <p className="text-2xl font-bold text-neutral-900">{pendingAssessments.length}</p>
                    </div>
                  </div>

                  {/* Completed Assessments */}
                  {completedAssessments.length > 0 ? (
                    <div className="space-y-4">
                      <h3 className="font-semibold text-neutral-900">Completed</h3>
                      {completedAssessments.map(a => {
                        const result = scoreInstances.find(
                          s => s.instance_id === a.instance_id || s.disease_id === a.disease_id
                        );
                        return (
                          <div key={a.permission_id} className="border border-neutral-200 rounded-lg p-4 space-y-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-semibold text-neutral-900">{a.disease_name}</h4>
                                <p className="text-sm text-neutral-600 mt-1">
                                  Completed on {formatDateTime(result?.completed_at ?? a.granted_at)}
                                </p>
                              </div>
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-lg">
                                <Check className="w-3 h-3" /> Completed
                              </span>
                            </div>

                            {/* Score results */}
                            {result && (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                {result.disease_score != null && (
                                  <div className="bg-neutral-50 rounded-lg p-3">
                                    <p className="text-xs text-neutral-500 mb-0.5">Overall Score</p>
                                    <p className="text-xl font-bold text-neutral-900">
                                      {result.disease_score.toFixed(0)}
                                      <span className="text-sm font-normal text-neutral-400"> /100</span>
                                    </p>
                                  </div>
                                )}
                                {result.severity_label && (
                                  <div className="bg-neutral-50 rounded-lg p-3">
                                    <p className="text-xs text-neutral-500 mb-0.5">Severity</p>
                                    <p className={`text-sm font-semibold ${
                                      result.severity_level === "severe" ? "text-red-700" :
                                      result.severity_level === "moderate" ? "text-orange-700" :
                                      result.severity_level === "mild" ? "text-yellow-700" :
                                      "text-green-700"
                                    }`}>{result.severity_label}</p>
                                  </div>
                                )}
                                {result.percentage != null && (
                                  <div className="bg-neutral-50 rounded-lg p-3">
                                    <p className="text-xs text-neutral-500 mb-0.5">Percentage</p>
                                    <p className="text-xl font-bold text-neutral-900">
                                      {result.percentage.toFixed(0)}%
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Scale summaries */}
                            {result?.scale_summaries && result.scale_summaries.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">Scale Results</p>
                                <div className="grid grid-cols-2 gap-2">
                                  {result.scale_summaries.map((scale, i) => (
                                    <div key={scale.scale_id ?? i} className="flex items-center justify-between bg-neutral-50 rounded-lg px-3 py-2">
                                      <span className="text-sm text-neutral-700">{scale.scale_name ?? scale.scale_code}</span>
                                      <div className="flex items-center gap-2">
                                        {scale.calculated_value != null && (
                                          <span className="text-sm font-semibold text-neutral-900">
                                            {scale.calculated_value}
                                            {scale.max_possible != null && <span className="text-xs font-normal text-neutral-400">/{scale.max_possible}</span>}
                                          </span>
                                        )}
                                        {scale.severity_label && (
                                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                                            scale.severity_level === "severe" ? "bg-red-50 text-red-700" :
                                            scale.severity_level === "moderate" ? "bg-orange-50 text-orange-700" :
                                            scale.severity_level === "mild" ? "bg-yellow-50 text-yellow-700" :
                                            "bg-green-50 text-green-700"
                                          }`}>{scale.severity_label}</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-3">
                              {a.instance_id ? (
                                <Link href={`/doctor/patients/${id}/results?instance_id=${a.instance_id}`}>
                                  <button className="px-5 py-2 border border-neutral-400 text-neutral-900 font-medium rounded-lg hover:bg-neutral-50 transition-colors text-sm flex items-center gap-2">
                                    <BarChart2 className="w-4 h-4" /> View Detailed Report
                                  </button>
                                </Link>
                              ) : (
                                <button className="px-5 py-2 border border-neutral-400 text-neutral-900 font-medium rounded-lg hover:bg-neutral-50 transition-colors text-sm flex items-center gap-2">
                                  <BarChart2 className="w-4 h-4" /> View Detailed Report
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-neutral-200 rounded-lg">
                      <p className="text-neutral-600 font-medium mb-2">No completed PRS assessments yet</p>
                      <p className="text-neutral-500 text-sm">Assign an assessment to get started</p>
                    </div>
                  )}

                  {/* Pending Assessments */}
                  {pendingAssessments.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="font-semibold text-neutral-900">Pending</h3>
                      {pendingAssessments.map(a => (
                        <div key={a.permission_id} className="border border-neutral-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h4 className="font-semibold text-neutral-900">{a.disease_name}</h4>
                              <p className="text-sm text-neutral-600 mt-1">Assigned on {formatDateTime(a.granted_at)}</p>
                            </div>
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg">
                              Pending
                            </span>
                          </div>
                          <Link href={`/doctor/patients/${id}/assessment/${a.permission_id}${sessionId ? `?session=${sessionId}` : ""}`}>
                            <Button size="sm" variant="secondary">
                              <PlayCircle className="h-4 w-4" /> Start Assessment
                            </Button>
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Doctor's Note — fixed to the viewport so it's reachable from
          every section tab; saves into the same categorized Doctor's Notes
          feed, tagged with the section it was written from. */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {noteWidgetOpen && (
          <div className="w-[300px] bg-white rounded-xl shadow-xl border border-neutral-200 p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-neutral-900">Quick Doctor&apos;s Note</p>
              <button onClick={() => setNoteWidgetOpen(false)} className="text-neutral-400 hover:text-neutral-600 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-neutral-400 -mt-1.5">From: {SECTION_LABELS[selectedSection] ?? selectedSection}</p>
            <select
              value={widgetCategory}
              onChange={(e) => setWidgetCategory(e.target.value)}
              className="w-full h-9 border border-neutral-200 rounded-lg px-2 text-xs bg-white outline-none focus:border-blue-400"
            >
              {NOTE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <textarea
              value={widgetBody}
              onChange={(e) => setWidgetBody(e.target.value)}
              rows={3}
              placeholder="Jot a note while reviewing this section…"
              className="w-full border border-neutral-200 rounded-lg p-2 text-xs text-neutral-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-colors resize-y"
            />
            <Button size="sm" variant="primary" disabled={!widgetBody.trim()} onClick={saveWidgetNote}>
              {widgetSaved ? "✓ Saved to Doctor's Notes" : "Save to Doctor's Notes"}
            </Button>
          </div>
        )}

        <button
          onClick={() => setNoteWidgetOpen((o) => !o)}
          className="w-12 h-12 rounded-full bg-brand-gradient text-white shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity flex-shrink-0"
          title="Add a doctor's note"
        >
          {noteWidgetOpen ? <X className="w-5 h-5" /> : <NotebookPen className="w-5 h-5" />}
        </button>
      </div>

      {finalReportFor && (
        <SessionFinalReportModal
          patientName={fullName}
          mrn={patient?.mrn}
          session={finalReportFor}
          anamnesis={anamnesisRecord ?? null}
          scoreSummary={(() => {
            const latest = scoreInstances.slice().sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))[0];
            if (!latest) return null;
            return `${latest.disease_score != null ? `Score ${latest.disease_score.toFixed(0)}/100` : ""}${latest.severity_label ? ` · ${latest.severity_label}` : ""}`.trim() || null;
          })()}
          doctorNoteText={doctorNotes[0]?.body ?? null}
          protocol={finalReportProtocol}
          onClose={() => setFinalReportFor(null)}
        />
      )}

      {showCompare && (
        <CompareSessionsModal patientId={id} sessions={clinicalSessions} onClose={() => setShowCompare(false)} />
      )}
    </div>
  );
}
