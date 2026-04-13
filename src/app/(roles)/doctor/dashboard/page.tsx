"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, HelpCircle, Search, X } from "lucide-react";
import { useSessions } from "@/lib/hooks";
import { useAuth } from "@/lib/hooks/useAuth";
import { PageLoader } from "@/components/ui";
import type { AssessmentSession } from "@/types/prs.types";

interface PatientInfo {
  id: string;
  name: string;
  age: number;
  condition: string;
  status: "new" | "paid" | "pending" | "assessment";
  assessmentProgress?: string;
  image?: string;
  email?: string;
  phone?: string;
  lastVisit?: string;
}

// Dummy patient metadata database
export const DUMMY_PATIENTS: Record<string, Omit<PatientInfo, "id">> = {
  "P090": {
    name: "Andrea Watson",
    age: 24,
    condition: "Parkinson's",
    status: "new",
    email: "andrea.watson@email.com",
    phone: "+1 (555) 023-4567",
    lastVisit: "2026-04-01",
  },
  "P001": {
    name: "James Clark",
    age: 23,
    condition: "Anxiety, Depression",
    status: "pending",
    email: "james.clark@email.com",
    phone: "+1 (555) 123-4567",
    lastVisit: "2026-03-28",
  },
  "P012": {
    name: "Ricky ponting",
    age: 43,
    condition: "Stroke Recovery",
    status: "assessment",
    assessmentProgress: "2/4",
    email: "ricky.ponting@email.com",
    phone: "+1 (555) 234-5678",
    lastVisit: "2026-03-30",
  },
  "P321": {
    name: "James Rodrigues",
    age: 26,
    condition: "Parkinson's",
    status: "new",
    email: "james.rodrigues@email.com",
    phone: "+1 (555) 345-6789",
    lastVisit: "2026-03-25",
  },
  "P431": {
    name: "Camford Hasley",
    age: 54,
    condition: "Parkinson's",
    status: "paid",
    email: "camford.hasley@email.com",
    phone: "+1 (555) 456-7890",
    lastVisit: "2026-04-02",
  },
  "P121": {
    name: "Jordan Tristan",
    age: 26,
    condition: "Parkinson's",
    status: "new",
    email: "jordan.tristan@email.com",
    phone: "+1 (555) 567-8901",
    lastVisit: "2026-03-29",
  },
};

export default function DoctorDashboard() {
  const { sessions, isLoading, loadMySessions } = useSessions();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredPatients, setFilteredPatients] = useState<PatientInfo[]>([]);

  useEffect(() => { 
    loadMySessions(); 
  }, [loadMySessions]);

  // Transform sessions data to patient info and merge with dummy metadata
  useEffect(() => {
    const patientsMap: Record<string, PatientInfo> = {};
    
    // First, add all dummy patients
    Object.entries(DUMMY_PATIENTS).forEach(([id, patientData]) => {
      patientsMap[id] = {
        id,
        ...patientData,
      };
    });

    // Then merge/override with session data if available
    sessions.forEach((session: AssessmentSession) => {
      const patientId = session.patient_id;
      if (patientsMap[patientId]) {
        // Update status based on session
        if (session.status === "completed") {
          patientsMap[patientId].status = "paid";
        } else if (session.status === "in_progress") {
          patientsMap[patientId].status = "assessment";
          patientsMap[patientId].assessmentProgress = `${session.scales_completed || 0}/${session.scales_total || 4}`;
        } else if (session.status === "assigned") {
          patientsMap[patientId].status = "pending";
        }
      } else {
        // For sessions without dummy data, create a basic entry
        patientsMap[patientId] = {
          id: patientId,
          name: patientId.includes("-") ? patientId.split("-")[0] : "Patient",
          age: Math.floor(Math.random() * 50) + 20,
          condition: session.title || session.condition_id || "General Assessment",
          status: session.status === "completed" ? "paid" : session.status === "in_progress" ? "assessment" : "new",
          assessmentProgress: session.status === "in_progress" ? `${session.scales_completed || 0}/${session.scales_total || 4}` : undefined,
        };
      }
    });

    const patients = Object.values(patientsMap)
      // Sort to prioritize dummy patients in a consistent order (P001, P012, P090, P121, P321, P431)
      .sort((a, b) => {
        const dummyPatientIds = Object.keys(DUMMY_PATIENTS);
        const aIsDummy = dummyPatientIds.includes(a.id);
        const bIsDummy = dummyPatientIds.includes(b.id);
        
        // Dummy patients first
        if (aIsDummy && !bIsDummy) return -1;
        if (!aIsDummy && bIsDummy) return 1;
        
        // Both dummy or both non-dummy: sort by ID
        if (aIsDummy && bIsDummy) {
          return dummyPatientIds.indexOf(a.id) - dummyPatientIds.indexOf(b.id);
        }
        return a.id.localeCompare(b.id);
      })
      .slice(0, 6);
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      setFilteredPatients(
        patients.filter(p => 
          p.name.toLowerCase().includes(query) || 
          p.id.toLowerCase().includes(query) ||
          p.condition.toLowerCase().includes(query)
        )
      );
    } else {
      setFilteredPatients(patients);
    }
  }, [sessions, searchQuery]);

  if (isLoading) return <PageLoader />;

  const doctorName = user?.first_name || "Doctor";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f7f6f2] to-[#f4f0ef]">
      {/* Header */}
      <div className="flex justify-end gap-4 px-8 py-6 mb-8">
        <button className="p-4 hover:bg-white/50 rounded-full transition-colors">
          <HelpCircle className="w-6 h-6 text-neutral-600" />
        </button>
        <div className="relative">
          <button className="p-4 hover:bg-white/50 rounded-full transition-colors">
            <Bell className="w-6 h-6 text-neutral-600" />
            <span className="absolute top-3 right-3 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-semibold">
              3
            </span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-8 pb-12"> {/* Welcome Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-neutral-900 mb-2">
            Welcome, Dr. {doctorName} 👋
          </h1>
          <p className="text-xl text-neutral-600">
            Here's everything you need for today's clinic
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-12 flex justify-center">
          <div className="relative w-full max-w-2xl">
            <div className="flex items-center gap-3 bg-white px-6 py-4 rounded-full shadow-md border border-neutral-200">
              <Search className="w-6 h-6 text-neutral-400" />
              <input
                type="text"
                placeholder="Search patients by name or ID"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 outline-none text-neutral-900 placeholder:text-neutral-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="p-1 hover:bg-neutral-100 rounded-full"
                >
                  <X className="w-4 h-4 text-neutral-400" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Recently Searched Section */}
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">
            Recently Searched
          </h2>

          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            {filteredPatients.length > 0 ? (
              filteredPatients.map((patient) => (
                <Link
                  key={patient.id}
                  href={`/doctor/patients/${patient.id}`}
                  className="block group"
                >
                  <div className="flex items-center justify-between p-4 rounded-xl hover:bg-neutral-50 transition-colors border border-transparent hover:border-neutral-200">
                    {/* Patient Avatar & Info */}
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {patient.name.charAt(0).toUpperCase()}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-semibold text-neutral-900">
                            {patient.name}
                          </h3>
                          <span className="text-sm text-neutral-500">
                            ({patient.id})
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-sm text-neutral-600">
                          <span>{patient.age} Yrs</span>
                          <span className="w-1 h-1 rounded-full bg-neutral-400"></span>
                          <span>{patient.condition}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badges */}
                    <div className="flex items-center gap-3 ml-4">
                      {patient.status === "new" && (
                        <span className="px-3 py-1 bg-[#f7f4fe] text-[#7343ea] text-sm font-semibold rounded-lg">
                          New
                        </span>
                      )}
                      {patient.status === "paid" && (
                        <span className="px-3 py-1 bg-[#f0fbf6] text-[#06c270] text-sm font-semibold rounded-lg flex items-center gap-2">
                          <span className="w-4 h-4 bg-[#06c270] rounded-full"></span>
                          Paid
                        </span>
                      )}
                      {patient.status === "pending" && (
                        <span className="px-3 py-1 bg-[#f4f0ef] text-neutral-500 text-sm font-semibold rounded-lg flex items-center gap-2">
                          <span className="w-4 h-4 bg-neutral-400 rounded-full"></span>
                          Pending
                        </span>
                      )}
                      {patient.status === "assessment" && patient.assessmentProgress && (
                        <span className="px-3 py-1 bg-[#f1f7ff] text-[#1b74f9] text-sm font-semibold rounded-lg flex items-center gap-2">
                          <span className="w-4 h-4 border-2 border-[#1b74f9] rounded-full"></span>
                          Assessment {patient.assessmentProgress}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-neutral-500">
                  {searchQuery 
                    ? "No patients found matching your search."
                    : "No recently searched patients."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
