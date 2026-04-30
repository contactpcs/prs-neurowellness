"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, X, Users, HelpCircle, Bell } from "lucide-react";
import { useAuth } from "@/lib/hooks/useAuth";
import { PageLoader } from "@/components/ui";
import { doctorsService } from "@/lib/api/services";
import type { PatientListItem } from "@/types/domain.types";

const AVATAR_URLS = [
  "https://i.pravatar.cc/400?img=44",
  "https://i.pravatar.cc/400?img=59",
  "https://i.pravatar.cc/400?img=12",
  "https://i.pravatar.cc/400?img=17",
  "https://i.pravatar.cc/400?img=8",
  "https://i.pravatar.cc/400?img=60",
  "https://i.pravatar.cc/400?img=13",
  "https://i.pravatar.cc/400?img=4",
  "https://i.pravatar.cc/400?img=65",
  "https://i.pravatar.cc/400?img=63",
];

const getAvatarUrl = (index: number) => {
  return AVATAR_URLS[index % AVATAR_URLS.length];
};

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
  // Show up to 6 most recent patients (from the API response)
  const recentPatients = filtered.slice(0, 6);

  return (
    <div className="h-screen bg-gradient-to-b from-neutral-100 to-neutral-50 flex flex-col">
      <div className="max-w-7xl mx-auto px-12 py-12 w-full flex flex-col flex-1 overflow-hidden">
        {/* Top Navigation */}
        

        {/* Welcome Section */}
        <div className="text-center mb-12 flex-shrink-0">
          <h1 className="text-5xl font-bold text-neutral-900 mb-2">
            Welcome, Dr. {doctorName} 👋
          </h1>
          <p className="text-xl text-neutral-600">
            Here's everything you need for today's clinic
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-12 flex justify-center flex-shrink-0">
          <div className="relative w-full max-w-2xl">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search patients by name or ID"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-14 pr-6 py-4 text-base bg-white border border-neutral-200 rounded-full text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 hover:border-neutral-300 transition-all duration-150 shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-6 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Recently Searched */}
        {recentPatients.length > 0 && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex-shrink-0">
              Recently Searched
            </h2>

            <div className="bg-white rounded-2xl border border-neutral-200 shadow-md p-6 flex-1 overflow-y-auto">
              <div className="space-y-5">
              {recentPatients.map((patient, index) => {
                const lastPrs = patient.last_prs;
                const lastPrsDate = lastPrs?.completed_at
                  ? new Date(lastPrs.completed_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : null;
                return (
                  <Link
                    key={patient.id}
                    href={`/doctor/patients/${patient.id}`}
                    className="flex items-center gap-4 hover:bg-neutral-50 -mx-6 px-6 py-4 rounded-xl transition-colors group"
                  >
                    {/* Avatar — one of the provided images, rotated by patient index */}
                    <img
                      src={getAvatarUrl(index)}
                      alt={`${patient.first_name} ${patient.last_name}`}
                      className="w-16 h-16 rounded-full object-cover flex-shrink-0 shadow-md bg-neutral-200"
                    />

                    {/* Patient Info */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-base font-semibold text-neutral-900">
                          {patient.first_name} {patient.last_name}
                        </span>
                        {patient.mrn && (
                          <span className="text-sm text-neutral-500 font-medium">
                            ({patient.mrn})
                          </span>
                        )}
                      </div>
                      {lastPrs?.disease_name ? (
                        <p className="text-sm text-neutral-600 mt-0.5">
                          Last PRS: <span className="font-medium text-neutral-800">{lastPrs.disease_name}</span>
                          {lastPrsDate && <span className="text-neutral-500"> · {lastPrsDate}</span>}
                        </p>
                      ) : (
                        <p className="text-sm text-neutral-400 italic mt-0.5">No PRS completed yet</p>
                      )}
                      {patient.condition && (
                        <p className="text-sm text-neutral-500 mt-0.5">{patient.condition}</p>
                      )}
                    </div>

                    {/* Status Badges */}
                    <StatusBadges patient={patient} />
                  </Link>
                );
              })}
              </div>
            </div>
            </div>
        )}

        {/* Empty State */}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1">
            <div className="w-16 h-16 rounded-full bg-neutral-200 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-neutral-400" />
            </div>
            <p className="text-lg font-medium text-neutral-700 mb-1">
              {searchQuery ? "No patients match your search" : "No patients assigned yet"}
            </p>
            <p className="text-neutral-500">
              {searchQuery ? "Try a different name or ID" : "Patients will appear here once assigned"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadges({ patient }: { patient: PatientListItem }) {
  // Create badges based on available status data
  const badges = [];

  // You can customize this based on your actual patient status fields
  if (patient.status === "new") {
    badges.push(
      <span
        key="new"
        className="px-3 py-1 text-sm font-medium text-primary-700 bg-blue-50 rounded-lg"
      >
        New
      </span>
    );
  }

  if (patient.status === "active") {
    badges.push(
      <span
        key="paid"
        className="inline-flex items-center gap-1 px-3 py-1 text-sm font-medium text-success-700 bg-success-50 rounded-lg"
      >
        ✓ Paid
      </span>
    );
  }

  if (patient.status === "pending") {
    badges.push(
      <span
        key="pending"
        className="px-3 py-1 text-sm font-medium text-neutral-600 bg-neutral-100 rounded-lg"
      >
        Pending
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      {badges.length > 0 ? badges : null}
    </div>
  );
}
