"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Plus, HelpCircle, Bell, Check, Lock, PlayCircle, BarChart2 } from "lucide-react";
import { PatientDetailSkeleton, Button } from "@/components/ui";
import { AnamnesisForm } from "@/components/assessment/AnamnesisForm";
import { doctorsService } from "@/lib/api/services/doctors.service";
import { permissionsService } from "@/lib/api/services/permissions.service";
import { scoresService } from "@/lib/api/services/scores.service";
import type { PatientDetail, Permission, AssessmentInstance } from "@/types/domain.types";

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

const ASSESSMENT_SECTIONS = [
  { id: "anamnesis", name: "Anamnesis", status: "done" },
  { id: "brain-mapping", name: "Brain Mapping", status: "start" },
  { id: "prs", name: "PRS", status: "start" },
  { id: "notes", name: "Doctor's Notes", status: null },
  { id: "treatment-plan", name: "Treatment Plan", status: "locked" },
  { id: "final-report", name: "Final Report", status: "locked" },
];

export default function DoctorPatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [assessments, setAssessments] = useState<Permission[]>([]);
  const [scoreInstances, setScoreInstances] = useState<AssessmentInstance[]>([]);
  const [totalAssessments, setTotalAssessments] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSection, setSelectedSection] = useState("anamnesis");
  const [selectedAssessmentTab, setSelectedAssessmentTab] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [patientData, permissionsData, scoresSummary] = await Promise.all([
          doctorsService.getPatient(id),
          permissionsService.getPatientPermissions(id),
          scoresService.getPatientScoresSummary(id).catch(() => ({ instances: [], total: 0, diseases: 0 })),
        ]);

        if (cancelled) return;
        setPatient(patientData);
        setAssessments(permissionsData.permissions ?? []);
        setScoreInstances(scoresSummary.instances ?? []);
        setTotalAssessments(scoresSummary.total ?? 0);
      } catch {
        if (cancelled) return;
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [id]);

  if (isLoading) return <PatientDetailSkeleton />;

  const fullName = patient?.full_name || "Patient";
  const age = patient?.date_of_birth
    ? new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()
    : null;

  const nextAssessment = assessments.find(a => a.status === "granted");
  const completedAssessments = assessments.filter(a => a.status === "completed");
  const pendingAssessments = assessments.filter(a => a.status === "granted");

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-100 to-neutral-50">
      {/* Top Header with Navigation */}
      <div className="bg-white border-b border-neutral-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-neutral-700 hover:text-neutral-900 transition-colors text-sm font-medium"
          >
            <ChevronRight className="w-5 h-5 -scale-x-100" />
            back to Search
          </button>
          <div className="flex items-center gap-4">
            <div className="relative w-96 bg-white border border-neutral-200 rounded-full flex items-center px-6 py-3 shadow-sm">
              <input
                type="text"
                placeholder="Search patients, schedule, courses, equipments, etc"
                className="flex-1 bg-transparent outline-none text-sm text-neutral-600 placeholder:text-neutral-400"
              />
            </div>
            <button className="w-12 h-12 rounded-full bg-white hover:bg-neutral-50 flex items-center justify-center transition-colors shadow-sm border border-neutral-200">
              <HelpCircle className="w-5 h-5 text-neutral-600" />
            </button>
            <button className="relative w-12 h-12 rounded-full bg-white hover:bg-neutral-50 flex items-center justify-center transition-colors shadow-sm border border-neutral-200">
              <Bell className="w-5 h-5 text-neutral-600" />
              <div className="absolute -top-1 -right-1 w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">3</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 py-8 space-y-6">
        {/* Patient Card */}
        <div className="bg-white rounded-lg shadow-md p-7 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white font-bold text-2xl border-2 border-[#f47920]">
              {fullName?.[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-900">{fullName}</h1>
              {patient?.mrn && (
                <p className="text-sm text-neutral-600">({patient.mrn})</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                {age && <span className="text-base text-neutral-700">{age} Yrs · Female</span>}
                <span className="px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg">New</span>
                <span className="px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-lg flex items-center gap-1">
                  <Check className="w-3 h-3" /> Paid
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-6 py-3 border border-neutral-400 text-neutral-900 font-medium rounded-full hover:bg-neutral-50 transition-colors">
              Prev. Patient
            </button>
            <button className="px-6 py-3 border border-neutral-400 text-neutral-900 font-medium rounded-full hover:bg-neutral-50 transition-colors">
              Next Patient
            </button>
          </div>
        </div>

        {/* Next Activity Card */}
        {nextAssessment && (
          <div className="bg-white rounded-lg shadow-md p-6 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <p className="text-neutral-600 text-sm">Next Activity</p>
                <h3 className="text-2xl font-bold text-neutral-900">{nextAssessment.disease_name}</h3>
                <span className="inline-block mt-1 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg">Basic 2/7</span>
              </div>
            </div>
            <button className="px-6 py-3 bg-orange-500 text-white font-medium rounded-full hover:bg-orange-600 transition-colors flex items-center gap-2">
              ▶ Start
            </button>
          </div>
        )}

        {/* Assessment Tabs and Content */}
        <div className="space-y-6">
          {/* Tabs */}
          <div className="flex items-center gap-4">
            <div className="px-4 py-2 bg-neutral-900 text-white font-medium rounded-lg text-sm">
              Today's Activity
            </div>
            {assessments.slice(0, 2).map((a, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedAssessmentTab(idx)}
                className={`px-4 py-2 font-medium rounded-lg text-sm flex items-center gap-2 transition-colors ${
                  selectedAssessmentTab === idx
                    ? "bg-neutral-900 text-white"
                    : "bg-white text-neutral-700 border border-neutral-200 hover:border-neutral-300"
                }`}
              >
                {a.disease_name}
                {a.status === "completed" && <Check className="w-4 h-4" />}
              </button>
            ))}
            <button className="px-3 py-2 border border-neutral-300 text-neutral-600 rounded-lg hover:bg-neutral-50 transition-colors">
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Main Content Area */}
          <div className="flex gap-6 min-h-96">
            {/* Left Sidebar - Assessment Sections */}
            <div className="w-80 bg-white rounded-lg shadow-md overflow-hidden flex flex-col">
              <div className="border-b border-neutral-200 p-4 flex items-center justify-between">
                <h3 className="font-semibold text-neutral-900">Basic</h3>
                <ChevronRight className="w-5 h-5 -rotate-90 text-neutral-600" />
              </div>
              <div className="flex-1 overflow-y-auto space-y-0">
                {ASSESSMENT_SECTIONS.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setSelectedSection(section.id)}
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
                ))}
              </div>
              <div className="border-t border-neutral-200 p-4">
                <h3 className="font-semibold text-neutral-900">Treatment Sessions</h3>
              </div>
            </div>

            {/* Right Content - Assessment Details */}
            <div className="flex-1 bg-white rounded-lg shadow-md p-8 overflow-y-auto">
              {selectedSection === "anamnesis" ? (
                // Anamnesis Form
                <AnamnesisForm patient={patient || undefined} patientId={id} />
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
                  <div className="grid grid-cols-3 gap-4">
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
                                  Completed on {formatDate(result?.completed_at ?? a.granted_at)}
                                </p>
                              </div>
                              <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-lg">
                                <Check className="w-3 h-3" /> Completed
                              </span>
                            </div>

                            {/* Score results */}
                            {result && (
                              <div className="grid grid-cols-3 gap-3">
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
                              <button className="px-5 py-2 border border-neutral-400 text-neutral-900 font-medium rounded-lg hover:bg-neutral-50 transition-colors text-sm">
                                Edit Report
                              </button>
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
                              <p className="text-sm text-neutral-600 mt-1">Assigned on {formatDate(a.granted_at)}</p>
                            </div>
                            <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-lg">
                              Pending
                            </span>
                          </div>
                          <Link href={`/doctor/patients/${id}/assessment/${a.permission_id}`}>
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
    </div>
  );
}
