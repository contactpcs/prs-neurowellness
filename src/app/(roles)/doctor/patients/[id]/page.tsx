"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Search, HelpCircle, Bell, Play, Lock, Plus } from "lucide-react";
import { useSessions } from "@/lib/hooks";
import { PageLoader } from "@/components/ui";
import { DUMMY_PATIENTS } from "../../dashboard/page";
import type { AssessmentSession } from "@/types/prs.types";

interface PatientDetails {
  id: string;
  name: string;
  age: number;
  gender?: string;
  condition: string;
  status: "new" | "paid" | "pending" | "assessment";
  email?: string;
  phone?: string;
  lastVisit?: string;
}

interface Assessment {
  id: string;
  icon: string;
  name: string;
  status: "done" | "start" | "locked";
  statusColor?: string;
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { sessions, loadPatientSessions } = useSessions();
  const [patient, setPatient] = useState<PatientDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAssessment, setSelectedAssessment] = useState<string>("FNON");
  const [activeTab, setActiveTab] = useState("today");

  useEffect(() => {
    setIsLoading(true);
    
    // Load patient from dummy data or create one
    const dummyPatient = DUMMY_PATIENTS[id];
    if (dummyPatient) {
      setPatient({
        id,
        ...dummyPatient,
      });
    } else {
      setPatient({
        id,
        name: "Patient",
        age: 25,
        gender: "Unknown",
        condition: "General",
        status: "new",
      });
    }

    loadPatientSessions(id);
    setIsLoading(false);
  }, [id, loadPatientSessions]);

  if (isLoading) return <PageLoader />;

  const assessments: Assessment[] = [
    { id: "prs", icon: "✓", name: "PRS", status: "start" },
    { id: "doctors-notes", icon: "📝", name: "Doctor's Notes", status: "start" },
    { id: "final-report", icon: "💰", name: "Final Report", status: "locked" },
  ];

  const activitiesPerformed = ["Crossword", "Toe Touch", "Walking", "Sudoku", "Balance Test"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f7f6f2] to-[#f4f0ef]">
      {/* Header with navigation */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-full px-8 py-4 flex items-center justify-between">
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            <ChevronRight className="w-6 h-6 rotate-180" />
            <span>back to Search</span>
          </button>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white border border-neutral-200 px-5 py-3 rounded-full shadow-sm w-96">
              <Search className="w-5 h-5 text-neutral-400" />
              <input 
                type="text"
                placeholder="Search patients, schedule, courses, equipments, etc"
                className="flex-1 outline-none text-neutral-700 placeholder:text-neutral-400"
              />
            </div>
            <button className="p-3 hover:bg-neutral-100 rounded-full transition-colors">
              <HelpCircle className="w-6 h-6 text-neutral-600" />
            </button>
            <div className="relative">
              <button className="p-3 hover:bg-neutral-100 rounded-full transition-colors">
                <Bell className="w-6 h-6 text-neutral-600" />
                <span className="absolute top-2 right-2 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-semibold">3</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-full px-8 py-8">
        {/* Patient info panel */}
        <div className="grid grid-cols-3 gap-5 mb-8">
          {/* Patient card */}
          <div className="col-span-2 bg-white rounded-lg shadow-md p-7 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white font-bold text-2xl border-2 border-[#f47920]">
                  {patient?.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-neutral-900">{patient?.name}</h1>
                    <span className="text-neutral-600">({patient?.id})</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-neutral-900">{patient?.age} Yrs · {patient?.gender || "Unknown"}</span>
                    {patient?.status === "new" && (
                      <span className="px-3 py-1 bg-[#f7f4fe] text-[#7343ea] text-sm font-semibold rounded-lg">New</span>
                    )}
                    {patient?.status === "paid" && (
                      <span className="px-3 py-1 bg-[#f0fbf6] text-[#06c270] text-sm font-semibold rounded-lg">Paid</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className="px-5 py-3 border border-neutral-500 text-neutral-900 rounded-full hover:bg-neutral-50 transition-colors font-medium">
                  Prev. Patient
                </button>
                <button className="px-5 py-3 border border-neutral-500 text-neutral-900 rounded-full hover:bg-neutral-50 transition-colors font-medium">
                  Next Patient
                </button>
              </div>
            </div>
          </div>

          {/* Next activity card */}
          <div className="bg-white rounded-lg shadow-md p-5 flex items-center justify-between">
            <div className="bg-[#f1f7ff] rounded-lg p-4">
              <p className="text-neutral-600 text-sm mb-2">Next Activity</p>
              <p className="text-neutral-900 font-semibold text-lg">Brain Mapping</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2 py-1 bg-[#f1f7ff] text-[#1b74f9] text-xs font-semibold rounded">Basic 2/7</span>
              </div>
            </div>
            <button className="px-5 py-3 bg-[#f47920] text-white rounded-full hover:bg-[#d96b1a] transition-colors font-medium flex items-center gap-2">
              <Play className="w-4 h-4" /> Start
            </button>
          </div>
        </div>

        {/* Assessment tabs */}
        <div className="mb-6 flex items-center gap-3 bg-white rounded-lg p-4 shadow-sm">
          <button 
            onClick={() => setActiveTab("today")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "today" 
                ? "bg-neutral-900 text-white" 
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
            }`}
          >
            Today's Activity
          </button>
          <div className="w-px h-6 bg-neutral-200"></div>
          <button 
            className="px-4 py-2 rounded-lg font-medium bg-white text-neutral-600 border border-neutral-300 hover:bg-neutral-50"
          >
            Clinical Assessment 1
          </button>
          <div className="w-px h-6 bg-neutral-200"></div>
          <button 
            className="px-4 py-2 rounded-lg font-medium bg-neutral-900 text-white"
          >
            Follow Up Assessment 1
          </button>
          <button className="ml-auto w-10 h-10 border border-neutral-300 rounded-lg flex items-center justify-center hover:bg-neutral-50">
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Main content area */}
        <div className="grid grid-cols-4 gap-6">
          {/* Left sidebar */}
          <div className="bg-white rounded-lg shadow-md overflow-clip">
            <div className="p-4 border-b border-neutral-200">
              <h3 className="font-semibold text-neutral-900">Basic</h3>
            </div>
            <div className="divide-y divide-neutral-200">
              {assessments.map((assessment) => (
                <button
                  key={assessment.id}
                  onClick={() => setSelectedAssessment(assessment.name)}
                  className={`w-full px-4 py-4 flex items-center justify-between text-left transition-colors ${
                    selectedAssessment === assessment.name
                      ? "bg-[#f1f7ff] border-l-3 border-[#1b74f9]"
                      : "hover:bg-neutral-50"
                  }`}
                >
                  <span className="font-medium text-neutral-900">{assessment.name}</span>
                  {assessment.status === "done" && (
                    <span className="px-2 py-1 bg-[#06c270] text-white text-xs font-semibold rounded">Done</span>
                  )}
                  {assessment.status === "start" && (
                    <span className="px-2 py-1 bg-[#f47920] text-white text-xs font-semibold rounded flex items-center gap-1">
                      <Play className="w-3 h-3" /> Start
                    </span>
                  )}
                  {assessment.status === "locked" && (
                    <Lock className="w-4 h-4 text-neutral-400" />
                  )}
                </button>
              ))}
            </div>
            <div className="border-t border-neutral-200 p-4">
              <h4 className="font-semibold text-neutral-900">Treatment Sessions</h4>
            </div>
          </div>

          {/* Right content panel */}
          <div className="col-span-3 bg-white rounded-lg shadow-md p-8">
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-neutral-900 mb-2">{selectedAssessment}</h2>
                  <div className="flex items-center gap-2 text-neutral-600">
                    <span>✓</span>
                    <span>completed on 24 Jan, 2026</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button className="px-5 py-3 border border-neutral-500 text-neutral-900 rounded-full hover:bg-neutral-50 transition-colors font-medium">
                    View Detailed Report
                  </button>
                  <button className="px-5 py-3 border border-neutral-500 text-neutral-900 rounded-full hover:bg-neutral-50 transition-colors font-medium">
                    Edit Report
                  </button>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="bg-[#f1f7ff] rounded-lg p-4">
                  <p className="text-neutral-600 text-sm mb-2">{selectedAssessment} Score</p>
                  <p className="text-neutral-900 font-semibold text-lg">32</p>
                </div>
                <div className="bg-[#f1f7ff] rounded-lg p-4">
                  <p className="text-neutral-600 text-sm mb-2">Improvement</p>
                  <p className="text-neutral-900 font-semibold text-lg">+20%</p>
                </div>
                <div className="bg-[#f1f7ff] rounded-lg p-4">
                  <p className="text-neutral-600 text-sm mb-2">Duration</p>
                  <p className="text-neutral-900 font-semibold text-lg">45 mins</p>
                </div>
                <div className="bg-[#f1f7ff] rounded-lg p-4">
                  <p className="text-neutral-600 text-sm mb-2">Completed by</p>
                  <p className="text-neutral-900 font-semibold text-lg">Dr. James</p>
                </div>
              </div>

              {/* Activities */}
              <div>
                <h3 className="font-semibold text-neutral-900 mb-4">Activities Performed</h3>
                <div className="flex flex-wrap gap-3">
                  {activitiesPerformed.map((activity) => (
                    <span 
                      key={activity}
                      className="px-4 py-2 bg-[#f1f7ff] text-[#1b74f9] font-medium text-sm rounded-lg"
                    >
                      {activity}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
