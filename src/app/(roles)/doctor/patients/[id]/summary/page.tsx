"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  UserCircle,
  Zap,
  ClipboardList,
  HeartPulse,
  FileText,
  FileCheck,
  Brain,
  StickyNote,
  CalendarClock,
  ChevronRight,
  BarChart2,
  Download,
  Eye,
} from "lucide-react";
import { PatientDetailSkeleton, Button, ProgressBar, Badge } from "@/components/ui";
import { PatientHistoryPanel, REPORT_TYPE_OPTIONS } from "@/components/admin/PatientHistoryPanel";
import { DeviceSessionsPanel, ProtocolFacts, ElectrodeChips, splitReason, versionLabel } from "@/components/doctor/TreatmentProtocolPanel";
import { EEGReportList } from "@/components/eeg";
import {
  useDoctorPatient,
  usePatientScoresSummary,
  usePatientAnamnesis,
} from "@/lib/hooks";
import { useUpcomingAppointments } from "@/lib/hooks/useAppointments";
import { useGoBack } from "@/lib/hooks/useGoBack";
import { treatmentProtocolService } from "@/lib/api/services/treatmentProtocol.service";
import { patientFilesService, type PatientFile } from "@/lib/api/services/patientFiles.service";
import { anamnesisService, type AnamnesisQuestion } from "@/lib/api/services/anamnesis.service";
import type { ProtocolDetail } from "@/types/treatmentProtocol.types";

const NAV_SECTIONS = [
  { id: "patient-summary", label: "Patient Summary", icon: LayoutDashboard },
  { id: "demographics", label: "Demographics", icon: UserCircle },
  { id: "current-treatment", label: "Current Treatment", icon: Zap },
  { id: "prs-summary", label: "PRS Summary", icon: ClipboardList },
  { id: "medical-history", label: "Medical History", icon: HeartPulse },
  { id: "anamnesis", label: "Anamnesis", icon: FileText },
  { id: "brain-mapping", label: "Brain Mapping", icon: Brain },
  { id: "reports-documents", label: "Reports & Documents", icon: FileCheck },
  { id: "doctor-notes", label: "Doctor's Notes", icon: StickyNote },
  { id: "sessions", label: "Sessions", icon: CalendarClock },
];

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function severityClass(level?: string) {
  switch (level) {
    case "severe": return "text-red-700 bg-red-50";
    case "moderate": return "text-orange-700 bg-orange-50";
    case "mild": return "text-yellow-700 bg-yellow-50";
    default: return "text-green-700 bg-green-50";
  }
}

export default function DoctorPatientSummaryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const goBack = useGoBack(`/doctor/patients`);

  const { patient, isLoading: patientLoading, isError: patientError, error: patientErrorMessage } = useDoctorPatient(id);
  const { instances: scoreInstances, total: totalAssessments } = usePatientScoresSummary(id);
  const { record: anamnesisRecord } = usePatientAnamnesis(id, "main");
  const { upcoming } = useUpcomingAppointments();

  const [activeSection, setActiveSection] = useState("patient-summary");
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});

  useEffect(() => {
    const els = NAV_SECTIONS.map((s) => sectionRefs.current[s.id]).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length) {
          visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          const sectionId = visible[0].target.id;
          setActiveSection((prev) => (prev === sectionId ? prev : sectionId));
        }
      },
      { rootMargin: "-96px 0px -65% 0px", threshold: 0 },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [patient]);

  const scrollToSection = (sectionId: string) => {
    const el = sectionRefs.current[sectionId];
    if (el) {
      const y = el.getBoundingClientRect().top + window.scrollY - 88;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
    setActiveSection(sectionId);
  };

  const nextAppointment = useMemo(() => {
    return upcoming
      .filter((a) => (a.patient_public_id ?? a.patient_id) === id)
      .slice()
      .sort((a, b) => (a.start_at || "").localeCompare(b.start_at || ""))[0] ?? null;
  }, [upcoming, id]);

  const [protocolDetail, setProtocolDetail] = useState<ProtocolDetail | null>(null);

  useEffect(() => {
    let cancelled = false;
    treatmentProtocolService
      .listProtocols({ patientId: id })
      .then((protocols) => {
        const active = protocols.find((p) => p.status === "active") ?? protocols[0];
        if (!active) return null;
        return treatmentProtocolService.getProtocolDetail(active.protocol_id);
      })
      .then((detail) => { if (!cancelled) setProtocolDetail(detail ?? null); })
      .catch(() => { if (!cancelled) setProtocolDetail(null); });
    return () => { cancelled = true; };
  }, [id]);

  const treatmentProgress = protocolDetail
    ? { completed: protocolDetail.sessions.filter((s) => s.status === "completed").length, total: protocolDetail.session_count }
    : null;

  const [anamnesisQuestions, setAnamnesisQuestions] = useState<AnamnesisQuestion[]>([]);

  useEffect(() => {
    let cancelled = false;
    anamnesisService.getQuestions("main").then((qs) => { if (!cancelled) setAnamnesisQuestions(qs); }).catch(() => { if (!cancelled) setAnamnesisQuestions([]); });
    return () => { cancelled = true; };
  }, []);

  // Legacy chief_complaint/main_symptoms/initial_symptoms columns are always
  // written null (AnamnesisForm only ever saves dynamic Q&A) — the real
  // answers live in record.responses keyed by question_id, so look them up
  // by the catalog question whose question_code matches.
  const anamnesisAnswer = (code: string): string => {
    const question = anamnesisQuestions.find((q) => q.question_code === code);
    const response = question && anamnesisRecord?.responses?.find((r) => r.question_id === question.question_id);
    if (!response) return "—";
    if (response.response_values?.length) return response.response_values.join("; ");
    return response.response_value || "—";
  };

  const [reportFiles, setReportFiles] = useState<PatientFile[]>([]);

  useEffect(() => {
    let cancelled = false;
    patientFilesService.list(id).then((files) => { if (!cancelled) setReportFiles(files); }).catch(() => { if (!cancelled) setReportFiles([]); });
    return () => { cancelled = true; };
  }, [id]);

  const viewReport = async (fileId: string) => {
    const url = await patientFilesService.downloadUrl(fileId);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const downloadReport = async (fileId: string, fileName: string) => {
    const url = await patientFilesService.downloadUrl(fileId);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  if (patientLoading) return <PatientDetailSkeleton />;

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

  const fullName = patient.full_name || "Patient";
  const age = patient.date_of_birth
    ? new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()
    : patient.age ?? null;
  const genderLabel = patient.gender ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1) : null;

  const completedAssessments = scoreInstances.filter((s: any) => s.completed_at);

  return (
    <div className="-mt-14 md:-mt-6 -mx-4 sm:-mx-6 -mb-4 sm:-mb-6 min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200 px-4 sm:px-8 py-3 sticky top-0 z-20">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <button
            onClick={goBack}
            className="flex items-center gap-1.5 text-neutral-700 hover:text-neutral-900 transition-colors text-sm font-medium"
          >
            <ChevronRight className="w-5 h-5 -scale-x-100" />
            Back
          </button>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!nextAppointment}
              onClick={() => nextAppointment && router.push(`/doctor/appointments/${nextAppointment.appointment_id}`)}
            >
              View Appointment
            </Button>
            <Button size="sm" variant="primary" onClick={() => router.push(`/doctor/patients/${id}`)}>
              Open Clinical Workspace
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile section pills */}
      <div className="lg:hidden sticky top-[57px] z-10 bg-neutral-50 flex gap-2 overflow-x-auto px-4 py-3">
        {NAV_SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => scrollToSection(s.id)}
            className={`flex-shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              activeSection === s.id
                ? "bg-blue-50 border-blue-600 text-blue-700"
                : "bg-white border-neutral-200 text-neutral-600"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="px-4 sm:px-8 py-5 flex gap-6 items-start">
        {/* Desktop sticky section nav */}
        <nav className="hidden lg:flex flex-col gap-0.5 w-60 flex-shrink-0 sticky top-20">
          {NAV_SECTIONS.map((s) => {
            const Icon = s.icon;
            const active = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => scrollToSection(s.id)}
                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left border-l-2 transition-colors ${
                  active
                    ? "bg-blue-50 border-l-blue-600 text-blue-700 font-semibold"
                    : "border-l-transparent text-neutral-600 hover:bg-neutral-100 font-medium"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {s.label}
              </button>
            );
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-8">
          {/* PATIENT SUMMARY */}
          <section
            id="patient-summary"
            ref={(el) => { sectionRefs.current["patient-summary"] = el; }}
            className="scroll-mt-24 flex flex-col gap-5"
          >
            <div className="bg-white rounded-lg shadow-md p-5 sm:p-6 flex flex-wrap gap-5 items-start">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
                {fullName[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl font-bold text-neutral-900">{fullName}</h1>
                  <span className="px-2.5 py-0.5 bg-green-50 text-green-700 text-xs font-semibold rounded-full">
                    {patient.status ? patient.status.charAt(0).toUpperCase() + patient.status.slice(1) : "Active"}
                  </span>
                </div>
                <p className="text-sm text-neutral-500 mt-1">
                  {patient.mrn || "—"} · {age != null ? `${age} yrs` : "—"} · {genderLabel || "—"} · DOB {formatDate(patient.date_of_birth)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="bg-white rounded-lg shadow-md p-5">
                <p className="text-xs font-semibold text-neutral-500 mb-2.5">Treatment Progress</p>
                {treatmentProgress ? (
                  <>
                    <p className="text-2xl font-bold text-neutral-900">
                      {treatmentProgress.completed} <span className="text-sm font-normal text-neutral-500">/ {treatmentProgress.total} sessions</span>
                    </p>
                    <div className="mt-4">
                      <ProgressBar value={treatmentProgress.completed} max={treatmentProgress.total} showLabel />
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-neutral-400">No active treatment protocol</p>
                )}
              </div>
              <div className="bg-white rounded-lg shadow-md p-5">
                <p className="text-xs font-semibold text-neutral-500 mb-2.5">Next Appointment</p>
                {nextAppointment ? (
                  <>
                    <p className="text-sm font-semibold text-neutral-900">
                      {formatDate(nextAppointment.appointment_date)} · {nextAppointment.start_time}
                    </p>
                    <p className="text-xs text-neutral-500 mt-1 capitalize">{nextAppointment.appointment_type?.replace(/_/g, " ")}</p>
                    <span className="inline-block mt-2.5 px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-medium rounded-full capitalize">
                      {nextAppointment.status.replace(/_/g, " ")}
                    </span>
                  </>
                ) : (
                  <p className="text-sm text-neutral-400">No upcoming appointment scheduled</p>
                )}
              </div>
            </div>
          </section>

          {/* DEMOGRAPHICS */}
          <section
            id="demographics"
            ref={(el) => { sectionRefs.current["demographics"] = el; }}
            className="scroll-mt-24 bg-white rounded-lg shadow-md p-5 sm:p-6"
          >
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Demographics</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
              <Field label="Full Name" value={fullName} />
              <Field label="Date of Birth" value={formatDate(patient.date_of_birth)} />
              <Field label="Age" value={age != null ? String(age) : "—"} />
              <Field label="Gender" value={genderLabel || "—"} />
              <Field label="Blood Group" value={patient.blood_group || "—"} />
              <Field label="Phone" value={patient.phone || "—"} />
              <Field label="Email" value={patient.email || "—"} />
              <Field label="Clinic" value={patient.clinic_name || patient.clinic_city || "—"} />
              <Field label="Emergency Contact" value={patient.emergency_contact || "—"} />
            </div>
          </section>

          {/* CURRENT TREATMENT */}
          <section
            id="current-treatment"
            ref={(el) => { sectionRefs.current["current-treatment"] = el; }}
            className="scroll-mt-24 bg-white rounded-lg shadow-md p-5 sm:p-6"
          >
            {!protocolDetail ? (
              <>
                <h2 className="text-lg font-semibold text-neutral-900 mb-4">Current Treatment</h2>
                <p className="text-sm text-neutral-400">No treatment protocol assigned.</p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold tracking-wide uppercase text-blue-600">
                  {protocolDetail.status === "active" ? "Active Treatment Protocol"
                    : protocolDetail.status === "completed" ? "Completed Treatment Protocol · History"
                    : "Most Recent Protocol"}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <h2 className="text-xl font-bold text-neutral-900">{protocolDetail.device_name || protocolDetail.modality || "Protocol"}</h2>
                  <Badge className="bg-blue-600 text-white">{versionLabel(protocolDetail)}</Badge>
                </div>
                <div className="flex items-center gap-6 text-xs mt-3">
                  <div>
                    <p className="text-neutral-400 uppercase tracking-wide">Effective From</p>
                    <p className="font-medium text-neutral-800 mt-0.5">{formatDate(protocolDetail.activated_at ?? protocolDetail.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-neutral-400 uppercase tracking-wide">Reason For Change</p>
                    <p className="font-medium text-neutral-800 mt-0.5">{splitReason(protocolDetail.notes).reason}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5">
                  <ProtocolFacts detail={protocolDetail} title={`Protocol ${versionLabel(protocolDetail)}`} />
                  <ElectrodeChips detail={protocolDetail} />
                </div>

                <div className="mt-5">
                  <p className="text-xs text-neutral-500 mb-1.5">
                    Progress · {treatmentProgress?.completed ?? 0} / {treatmentProgress?.total ?? 0} sessions completed
                  </p>
                  <ProgressBar value={treatmentProgress?.completed ?? 0} max={treatmentProgress?.total ?? 1} />
                </div>

                <div className="flex flex-wrap gap-2 mt-5">
                  <Button size="sm" variant="outline" onClick={() => router.push(`/doctor/patients/${id}?section=treatment-protocol`)}>
                    View Treatment Protocol
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => router.push(`/doctor/patients/${id}?section=treatment-plan`)}>
                    View Treatment Plan
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => router.push(`/doctor/patients/${id}?section=sessions`)}>
                    View Session Details
                  </Button>
                </div>
              </>
            )}
          </section>

          {/* PRS SUMMARY */}
          <section
            id="prs-summary"
            ref={(el) => { sectionRefs.current["prs-summary"] = el; }}
            className="scroll-mt-24 bg-white rounded-lg shadow-md p-5 sm:p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-900">Patient Reported Scales / PRS Summary</h2>
              <Link href={`/doctor/patients/${id}?section=prs`} className="text-xs font-medium text-blue-600 hover:underline">
                View Full PRS Results →
              </Link>
            </div>
            {completedAssessments.length === 0 ? (
              <p className="text-sm text-neutral-400">No completed assessments yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {completedAssessments.slice(0, 5).map((r: any) => (
                  <div key={r.instance_id} className="flex flex-wrap items-center gap-3 bg-neutral-50 rounded-lg px-4 py-3">
                    <span className="text-sm font-semibold text-neutral-900 min-w-[110px]">{r.disease_name ?? "Assessment"}</span>
                    {r.disease_score != null && (
                      <span className="text-sm font-bold text-neutral-900">
                        {Number(r.disease_score).toFixed(0)}<span className="text-xs font-normal text-neutral-400">/100</span>
                      </span>
                    )}
                    {(r.severity_label || r.overall_severity) && (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${severityClass(r.severity_level ?? r.overall_severity)}`}>
                        {r.severity_label ?? r.overall_severity}
                      </span>
                    )}
                    <span className="text-xs text-neutral-400">{formatDate(r.completed_at)}</span>
                    <Link href={`/doctor/patients/${id}/results?instance_id=${r.instance_id}`} className="ml-auto text-xs font-medium text-blue-600 hover:underline flex items-center gap-1">
                      <BarChart2 className="w-3.5 h-3.5" /> View
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* MEDICAL HISTORY */}
          <section
            id="medical-history"
            ref={(el) => { sectionRefs.current["medical-history"] = el; }}
            className="scroll-mt-24 bg-white rounded-lg shadow-md p-5 sm:p-6"
          >
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Medical History</h2>
            <PatientHistoryPanel patientId={id} clinicId={patient.clinic_id} />
          </section>

          {/* ANAMNESIS */}
          <section
            id="anamnesis"
            ref={(el) => { sectionRefs.current["anamnesis"] = el; }}
            className="scroll-mt-24 bg-white rounded-lg shadow-md p-5 sm:p-6"
          >
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Anamnesis / Clinical History</h2>
            {!anamnesisRecord ? (
              <p className="text-sm text-neutral-400">No anamnesis recorded yet.</p>
            ) : (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Chief Complaint</p>
                  <p className="text-sm text-neutral-800">{anamnesisAnswer("chief_complaint")}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Main Symptoms</p>
                  <p className="text-sm text-neutral-800">{anamnesisAnswer("main_symptoms")}</p>
                </div>
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Initial Symptoms</p>
                  <p className="text-sm text-neutral-800">{anamnesisAnswer("initial_symptoms")}</p>
                </div>
                <Link href={`/doctor/patients/${id}?section=anamnesis`} className="text-xs font-medium text-blue-600 hover:underline">
                  View Full Anamnesis →
                </Link>
              </div>
            )}
          </section>

          {/* BRAIN MAPPING & REPORTS */}
          <section
            id="brain-mapping"
            ref={(el) => { sectionRefs.current["brain-mapping"] = el; }}
            className="scroll-mt-24 bg-white rounded-lg shadow-md p-5 sm:p-6"
          >
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Brain Mapping</h2>
            <EEGReportList patientId={id} />
          </section>

          {/* REPORTS & DOCUMENTS */}
          <section
            id="reports-documents"
            ref={(el) => { sectionRefs.current["reports-documents"] = el; }}
            className="scroll-mt-24 bg-white rounded-lg shadow-md p-5 sm:p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-900">Reports &amp; Documents</h2>
              <Link href={`/doctor/patients/${id}?section=medical-history&tab=reports`} className="text-xs font-medium text-blue-600 hover:underline">
                View All Reports →
              </Link>
            </div>
            {reportFiles.length === 0 ? (
              <p className="text-sm text-neutral-400">No reports or documents uploaded yet.</p>
            ) : (
              <div className="flex flex-col">
                {reportFiles.map((f) => (
                  <div key={f.file_id} className="flex items-center gap-3.5 py-3 border-b border-neutral-100 last:border-0">
                    <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-900 truncate">{f.file_name}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {REPORT_TYPE_OPTIONS.find((o) => o.value === f.document_type)?.label ?? f.document_type ?? "Document"}
                        {f.file_size ? ` · ${formatFileSize(f.file_size)}` : ""}
                        {f.created_at ? ` · ${formatDate(f.created_at)}` : ""}
                      </p>
                    </div>
                    <button onClick={() => viewReport(f.file_id)} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline flex-shrink-0">
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                    <button onClick={() => downloadReport(f.file_id, f.file_name)} className="flex items-center gap-1 text-xs font-medium text-neutral-500 hover:underline flex-shrink-0">
                      <Download className="w-3.5 h-3.5" /> Download
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* DOCTOR'S NOTES */}
          <section
            id="doctor-notes"
            ref={(el) => { sectionRefs.current["doctor-notes"] = el; }}
            className="scroll-mt-24 bg-white rounded-lg shadow-md p-5 sm:p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-neutral-900">Latest Doctor&apos;s Notes</h2>
              <Link href={`/doctor/patients/${id}?section=notes`} className="text-xs font-medium text-blue-600 hover:underline">
                View All Notes →
              </Link>
            </div>
            {/* Notes are chronological/categorized and only kept in the
                clinical workspace's own session state — nothing to preview
                here, just the link into it. */}
            <p className="text-sm text-neutral-400">Open the clinical workspace to view and add clinical notes.</p>
          </section>

          {/* SESSIONS */}
          <section
            id="sessions"
            ref={(el) => { sectionRefs.current["sessions"] = el; }}
            className="scroll-mt-24 bg-white rounded-lg shadow-md p-5 sm:p-6"
          >
            <h2 className="text-lg font-semibold text-neutral-900 mb-4">Sessions</h2>
            <DeviceSessionsPanel patientId={id} />
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-neutral-500 mb-1">{label}</p>
      <p className="text-sm font-medium text-neutral-900">{value}</p>
    </div>
  );
}
