"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ClipboardList,
  ChevronRight, AlertTriangle,
  Search, Bell, User, BookOpen, Brain, CheckSquare, FileText, Lock, Hand, Phone, Check, PlayCircle,
} from "lucide-react";
import {
  usePatientDashboard,
  useMyAssessments,
  useMyAnamnesis,
  useMyScoresSummary,
  useMyDoctorNotes,
} from "@/lib/hooks";
import type { DoctorNote } from "@/lib/api/services/doctorNotes.service";
import { PatientDashboardSkeleton } from "@/components/ui";
import { AnamnesisForm } from "@/components/assessment/AnamnesisForm";
import type {
  AssessmentPermission,
  AnamnesisRecord,
  AssessmentInstance,
} from "@/types/domain.types";

type SectionId = "anamnesis" | "brain-mapping" | "prs" | "notes" | "treatment-plan" | "final-report";

const VALID_SECTIONS: SectionId[] = ["anamnesis", "brain-mapping", "prs", "notes", "treatment-plan", "final-report"];

function isSectionId(v: string | null): v is SectionId {
  return v !== null && (VALID_SECTIONS as string[]).includes(v);
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function PatientDashboardPage() {
  return (
    <Suspense fallback={<PatientDashboardSkeleton />}>
      <PatientDashboard />
    </Suspense>
  );
}

function PatientDashboard() {
  const { dashboard, isLoading: dashLoading } = usePatientDashboard();
  const { assessments, isLoading: assessLoading } = useMyAssessments();
  const { record: anamnesisRecord, isLoading: anamnesisLoading } = useMyAnamnesis();
  const { summary, isLoading: scoresLoading } = useMyScoresSummary();
  const { notes: doctorNotes, isLoading: notesLoading } = useMyDoctorNotes();

  const isLoading = dashLoading || assessLoading;

  const scoreInstances = summary?.instances ?? [];
  const totalAssessments = summary?.total ?? 0;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedAssessment, setSelectedAssessment] = useState<AssessmentPermission | null>(null);

  const sectionParam = searchParams.get("section");
  const selectedSection: SectionId | null = isSectionId(sectionParam) ? sectionParam : null;

  const setSelectedSection = useCallback(
    (s: SectionId | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (s) params.set("section", s);
      else params.delete("section");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (!selectedAssessment && assessments.length > 0) {
      const firstCompleted = assessments.find((a) => a.status === "completed");
      if (firstCompleted) setSelectedAssessment(firstCompleted);
    }
  }, [assessments, selectedAssessment]);

  if (isLoading) return <PatientDashboardSkeleton />;

  const completed    = assessments.filter((a) => a.status === "completed");
  const doctor       = dashboard?.assigned_doctor;
  const fullName     = dashboard?.profile?.full_name ?? "";
  const firstName    = fullName ? fullName.split(" ")[0] : "User";

  const anamnesisStatus: "done" | "pending" | "locked" =
    anamnesisRecord?.status === "completed" ? "done" : anamnesisRecord ? "pending" : "pending";
  const pendingAssessments = assessments.filter((a) => a.status === "granted");
  const prsStatus: "done" | "pending" | "locked" =
    pendingAssessments.length > 0
      ? "pending"
      : scoreInstances.length > 0
        ? "done"
        : "pending";
  const notesStatus: "done" | "pending" | "locked" =
    doctorNotes.length > 0 ? "done" : "pending";

  return (
    <div className="w-full bg-gray-50 min-h-screen p-8 animate-fade-in">
      {/* Top Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Hello {firstName} 👋</h1>
          <p className="text-gray-600 text-sm mt-1">Here's everything you need for your doctor's visit</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search patients, schedule, courses, equipments, etc"
              className="pl-10 pr-4 py-2 bg-white rounded-full border border-gray-200 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 w-96"
            />
          </div>
          <button className="p-2 hover:bg-gray-100 rounded-full">
            <AlertTriangle className="h-5 w-5 text-gray-600" />
          </button>
          <div className="relative">
            <button className="p-2 hover:bg-gray-100 rounded-full">
              <Bell className="h-5 w-5 text-gray-600" />
            </button>
            <span className="absolute top-1 right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">3</span>
          </div>
        </div>
      </div>

      {/* Next Activity & Doctor Cards */}
      <div className="flex gap-5 mb-8">
        <div className="flex-1 bg-white rounded-lg p-5 shadow-sm flex items-center gap-4">
          <div className="bg-blue-50 rounded-lg p-4 flex-shrink-0">
            <BookOpen className="h-8 w-8 text-blue-500" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500 font-medium">Next Activity</p>
            <p className="text-xl font-semibold text-gray-900">
              {pendingAssessments.length > 0
                ? `${pendingAssessments[0].disease_name} Assessment`
                : "No pending activity"}
            </p>
            {pendingAssessments.length > 1 && (
              <p className="text-xs text-gray-500 mt-0.5">
                +{pendingAssessments.length - 1} more pending
              </p>
            )}
          </div>
          {pendingAssessments.length > 0 ? (
            <Link
              href={`/patient/assessment/${pendingAssessments[0].permission_id}`}
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-full text-sm font-medium flex-shrink-0"
            >
              <PlayCircle className="w-4 h-4" /> Start
            </Link>
          ) : (
            <Link
              href="/patient/appointments/request"
              className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2 rounded-full text-sm font-medium flex-shrink-0 inline-flex items-center"
            >
              Book Appointment
            </Link>
          )}
        </div>

        {doctor && (
          <div className="flex-1 bg-white rounded-lg p-5 shadow-sm flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-orange-500 flex-shrink-0 border-2 border-orange-500">
              <User className="w-full h-full p-3 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-3">
                <p className="text-xl font-semibold text-gray-900">{doctor.full_name}</p>
                {doctor.specialization && (
                  <p className="text-sm text-gray-600">{doctor.specialization}</p>
                )}
              </div>
              {doctor.phone && (
                <div className="flex items-center gap-1 mt-2 text-gray-900">
                  <Phone className="h-5 w-5" />
                  <p className="text-sm">{doctor.phone}</p>
                </div>
              )}
            </div>
            <button className="bg-white border border-gray-400 hover:bg-gray-50 text-gray-900 px-5 py-2 rounded-full text-sm font-medium flex-shrink-0">
              Make Payment
            </button>
          </div>
        )}
      </div>

      {/* Activity Tabs */}
      <div className="flex gap-3 mb-8">
        <button className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium">Today's Activity</button>
        <button className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
          Clinical Assessment 1 <span className="ml-2 inline-flex items-center justify-center w-5 h-5 bg-green-500 text-white text-xs rounded-full">✓</span>
        </button>
        <button className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium">Follow Up Assessment 1</button>
      </div>

      {/* Main Content Area */}
      <div className="flex gap-6">
        {/* Left Sidebar */}
        <div className="w-80 space-y-4">
          {/* Basic Section */}
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="border-b border-gray-200 px-4 py-4 flex items-center justify-between">
              <h3 className="font-medium text-gray-900">Basic</h3>
              <ChevronRight className="h-5 w-5 text-gray-400 transform -rotate-90" />
            </div>

            <AssessmentItem
              icon={User}
              label="Anamnesis"
              status={anamnesisStatus}
              isActive={selectedSection === "anamnesis"}
              onSelect={() => setSelectedSection("anamnesis")}
            />
            <AssessmentItem
              icon={Brain}
              label="Brain Mapping"
              status="pending"
              isActive={selectedSection === "brain-mapping"}
              onSelect={() => setSelectedSection("brain-mapping")}
            />
            <AssessmentItem
              icon={CheckSquare}
              label="PRS"
              status={prsStatus}
              isActive={selectedSection === "prs"}
              onSelect={() => setSelectedSection("prs")}
            />
            <AssessmentItem
              icon={FileText}
              label="Doctor's Notes"
              status={notesStatus}
              isActive={selectedSection === "notes"}
              onSelect={() => setSelectedSection("notes")}
            />
            <AssessmentItem icon={ClipboardList} label="Treatment Plan" status="locked" />
            <AssessmentItem icon={Hand} label="Final Report" status="locked" />
          </div>

          {/* Treatment Sessions */}
          <div className="bg-white rounded-lg shadow-sm p-4 border-b border-gray-200">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              Treatment Sessions
              <Lock className="h-5 w-5 text-gray-400" />
            </h3>
          </div>
        </div>

        {/* Right Content */}
        <div className="flex-1 bg-white rounded-lg shadow-sm p-8 min-h-[24rem]">
          {selectedSection === "anamnesis" ? (
            <PatientAnamnesisView record={anamnesisLoading ? undefined : anamnesisRecord} />
          ) : selectedSection === "brain-mapping" ? (
            <PlaceholderView
              icon="🧠"
              title="Brain Mapping"
              description="Your brain mapping results will appear here once available."
            />
          ) : selectedSection === "prs" ? (
            <PatientPrsView
              instances={scoreInstances}
              total={totalAssessments}
              pending={assessments.filter((a) => a.status === "granted")}
            />
          ) : selectedSection === "notes" ? (
            <PatientDoctorNotesView notes={doctorNotes} />
          ) : selectedAssessment ? (
            <>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">{selectedAssessment.disease_name}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <CheckSquare className="h-5 w-5 text-green-500" />
                    <p className="text-gray-600 text-sm">completed on 24 Jan, 2026</p>
                  </div>
                </div>
                <button className="border border-gray-400 text-gray-900 px-5 py-2 rounded-full text-sm font-medium hover:bg-gray-50">
                  View Detailed Report
                </button>
              </div>

              {/* Score Cards */}
              <div className="grid grid-cols-4 gap-6 mb-8">
                <ScoreCard label="FNON Score" value="32" />
                <ScoreCard label="Improvement" value="+20%" />
                <ScoreCard label="Duration" value="45 mins" />
                <ScoreCard label="Completed by" value="Dr. James" />
              </div>

              {/* Activities Performed */}
              <div>
                <h3 className="font-medium text-gray-900 mb-4">Activities Performed</h3>
                <div className="flex flex-wrap gap-3">
                  {["Crossword", "Toe Touch", "Walking", "Sudoku", "Balance Test"].map((activity) => (
                    <span key={activity} className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-md text-sm">
                      {activity}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <PlaceholderView
              icon="📋"
              title="No section selected"
              description="Select a section from the sidebar to view its details."
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface AssessmentItemProps {
  icon: any;
  label: string;
  status: "done" | "pending" | "locked";
  isActive?: boolean;
  onSelect?: () => void;
}

function AssessmentItem({ icon: Icon, label, status, isActive, onSelect }: AssessmentItemProps) {
  const bgClass = isActive ? "bg-blue-50 border-l-4 border-blue-500" : "";
  const textClass = isActive ? "text-blue-600" : status === "locked" ? "text-gray-400" : "text-gray-900";

  return (
    <button
      onClick={onSelect}
      className={`w-full px-4 py-4 flex items-center justify-between border-b border-gray-100 hover:bg-gray-50 transition-colors ${bgClass}`}
    >
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${textClass}`} />
        <span className={`text-sm font-medium ${textClass}`}>{label}</span>
      </div>
      {status === "done" && <span className="bg-green-500 text-white px-2 py-1 rounded text-xs font-medium">Done</span>}
      {status === "pending" && <span className="bg-blue-600 text-white px-2 py-1 rounded text-xs font-medium">Pending</span>}
      {status === "locked" && <Lock className="h-5 w-5 text-gray-300" />}
    </button>
  );
}

interface ScoreCardProps {
  label: string;
  value: string;
}

function ScoreCard({ label, value }: ScoreCardProps) {
  return (
    <div className="bg-blue-50 rounded-lg p-4">
      <p className="text-gray-600 text-sm">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  );
}

function PlaceholderView({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
        <span className="text-2xl">{icon}</span>
      </div>
      <h2 className="text-xl font-bold text-neutral-700 mb-2">{title}</h2>
      <p className="text-sm text-neutral-500 max-w-md">{description}</p>
    </div>
  );
}

function PatientAnamnesisView({ record }: { record: AnamnesisRecord | null | undefined }) {
  if (record === undefined) {
    return <PlaceholderView icon="⏳" title="Loading anamnesis..." description="" />;
  }

  if (!record) {
    return (
      <PlaceholderView
        icon="📝"
        title="No anamnesis on file"
        description="Once you complete your medical history intake, it will appear here."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Anamnesis</h2>
          <p className="text-sm text-gray-600 mt-1">
            {record.status === "completed"
              ? `Submitted on ${formatDate(record.completed_at)} — view only.`
              : "Your anamnesis is in progress."}
          </p>
        </div>
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg">
          <Lock className="w-3 h-3" /> View only
        </span>
      </div>
      <AnamnesisForm
        patientId={record.patient_id}
        mode="patient"
        initialRecord={record}
      />
    </div>
  );
}

function PatientPrsView({
  instances,
  total,
  pending,
}: {
  instances: AssessmentInstance[];
  total: number;
  pending: AssessmentPermission[];
}) {
  if (instances.length === 0 && pending.length === 0) {
    return (
      <PlaceholderView
        icon="📊"
        title="No PRS assessments yet"
        description="Once your doctor assigns an assessment or you complete one, it will appear here."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">PRS Assessments</h2>
          <p className="text-sm text-gray-600 mt-1">
            {pending.length > 0
              ? `You have ${pending.length} pending assessment${pending.length === 1 ? "" : "s"} to complete.`
              : "Your most recent assessment results across diseases."}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <ScoreCard label="Pending" value={String(pending.length)} />
        <ScoreCard label="Completed" value={String(instances.length)} />
        <ScoreCard
          label="Last Completed"
          value={formatDate(instances[0]?.completed_at)}
        />
      </div>

      {pending.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900">Pending</h3>
          {pending.map((p) => (
            <div
              key={p.permission_id}
              className="border border-blue-200 bg-blue-50/40 rounded-lg p-4 flex items-start justify-between gap-4"
            >
              <div>
                <h4 className="font-semibold text-gray-900">{p.disease_name}</h4>
                <p className="text-sm text-gray-600 mt-1">Assigned on {formatDate(p.granted_at)}</p>
                {p.scales && p.scales.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {p.scales.length} scale{p.scales.length === 1 ? "" : "s"} included
                  </p>
                )}
              </div>
              <Link
                href={`/patient/assessment/${p.permission_id}`}
                className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-full text-sm font-medium flex-shrink-0"
              >
                <PlayCircle className="w-4 h-4" /> Start
              </Link>
            </div>
          ))}
        </div>
      )}

      {instances.length > 0 && (
        <h3 className="font-semibold text-gray-900">Completed</h3>
      )}
      <div className="space-y-4">
        {instances.map((inst) => (
          <div key={inst.instance_id} className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{inst.disease_name ?? inst.disease_id}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Completed on {formatDate(inst.completed_at)}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-lg">
                <Check className="w-3 h-3" /> Completed
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {inst.disease_score != null && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Overall Score</p>
                  <p className="text-xl font-bold text-gray-900">
                    {inst.disease_score.toFixed(0)}
                    <span className="text-sm font-normal text-gray-400"> /100</span>
                  </p>
                </div>
              )}
              {inst.severity_label && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Severity</p>
                  <p className={`text-sm font-semibold ${
                    inst.severity_level === "severe" ? "text-red-700" :
                    inst.severity_level === "moderate" ? "text-orange-700" :
                    inst.severity_level === "mild" ? "text-yellow-700" :
                    "text-green-700"
                  }`}>{inst.severity_label}</p>
                </div>
              )}
              {inst.percentage != null && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">Percentage</p>
                  <p className="text-xl font-bold text-gray-900">{inst.percentage.toFixed(0)}%</p>
                </div>
              )}
            </div>

            {inst.scale_summaries && inst.scale_summaries.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Scale Results</p>
                <div className="grid grid-cols-2 gap-2">
                  {inst.scale_summaries.map((s, i) => (
                    <div key={s.scale_id ?? i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-sm text-gray-700">{s.scale_name ?? s.scale_code}</span>
                      <div className="flex items-center gap-2">
                        {s.calculated_value != null && (
                          <span className="text-sm font-semibold text-gray-900">
                            {s.calculated_value}
                            {s.max_possible != null && <span className="text-xs font-normal text-gray-400">/{s.max_possible}</span>}
                          </span>
                        )}
                        {s.severity_label && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            s.severity_level === "severe" ? "bg-red-50 text-red-700" :
                            s.severity_level === "moderate" ? "bg-orange-50 text-orange-700" :
                            s.severity_level === "mild" ? "bg-yellow-50 text-yellow-700" :
                            "bg-green-50 text-green-700"
                          }`}>{s.severity_label}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PatientDoctorNotesView({ notes }: { notes: DoctorNote[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Doctor's Notes</h2>
          <p className="text-sm text-gray-600 mt-1">
            Notes recorded by your doctor about your care.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-lg">
          <Lock className="w-3 h-3" /> View only
        </span>
      </div>

      {notes.length === 0 ? (
        <div className="border border-dashed border-gray-200 rounded-lg p-8 text-center">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-700 font-medium mb-1">No notes yet</p>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            Your doctor hasn't added any notes about your care yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note, idx) => (
            <div
              key={note.id ?? `${note.doctor_id}-${idx}`}
              className="border border-gray-200 rounded-lg p-5 bg-white"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Last updated {formatDate(note.updated_at ?? note.created_at)}
                </p>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {note.note_text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
