"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, HelpCircle, Search, X } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { PageLoader } from "@/components/ui";
import { doctorsService } from "@/lib/api/services";
import type { PatientListItem } from "@/types/domain.types";

export default function DoctorDashboard() {
  const { user } = useAuth();
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    doctorsService.getPatients().then(({ patients: p }) => {
      setPatients(p);
    }).catch(() => {}).finally(() => setIsLoading(false));
  }, []);

  const filtered = patients.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
      (p.mrn || "").toLowerCase().includes(q) ||
      (p.condition || "").toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q)
    );
  });

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
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-8 pb-12">
        {/* Welcome Section */}
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
                placeholder="Search patients by name, ID or condition"
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

        {/* Patient List */}
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">
            {searchQuery ? "Search Results" : "Your Patients"}
          </h2>

          <div className="bg-white rounded-2xl shadow-lg p-6 space-y-4">
            {filtered.length > 0 ? (
              filtered.map((patient) => (
                <Link
                  key={patient.id}
                  href={`/doctor/patients/${patient.id}`}
                  className="block group"
                >
                  <div className="flex items-center justify-between p-4 rounded-xl hover:bg-neutral-50 transition-colors border border-transparent hover:border-neutral-200">
                    {/* Patient Avatar & Info */}
                    <div className="flex items-center gap-4 flex-1">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {patient.first_name?.[0]?.toUpperCase()}{patient.last_name?.[0]?.toUpperCase()}
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-semibold text-neutral-900">
                            {patient.first_name} {patient.last_name}
                          </h3>
                          {patient.mrn && (
                            <span className="text-sm text-neutral-500">
                              (MRN: {patient.mrn})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-neutral-600">
                          {patient.date_of_birth && (
                            <>
                              <span>
                                {new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()} Yrs
                              </span>
                              <span className="w-1 h-1 rounded-full bg-neutral-400" />
                            </>
                          )}
                          {patient.gender && (
                            <>
                              <span className="capitalize">{patient.gender}</span>
                              <span className="w-1 h-1 rounded-full bg-neutral-400" />
                            </>
                          )}
                          <span>{patient.email}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="flex items-center gap-3 ml-4">
                      {patient.status && (
                        <span className={`px-3 py-1 text-sm font-semibold rounded-lg ${
                          patient.status === "active"
                            ? "bg-[#f0fbf6] text-[#06c270]"
                            : patient.status === "pending"
                            ? "bg-[#f4f0ef] text-neutral-500"
                            : "bg-[#f7f4fe] text-[#7343ea]"
                        }`}>
                          {patient.status.charAt(0).toUpperCase() + patient.status.slice(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-neutral-500">
                  {searchQuery ? "No patients found matching your search." : "No patients assigned yet."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
