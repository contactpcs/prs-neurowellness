"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, X, Users } from "lucide-react";
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
    <div className="max-w-5xl mx-auto animate-fade-in">
      {/* Page header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">
          Good day, Dr. {doctorName}
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          {patients.length} patient{patients.length !== 1 ? "s" : ""} assigned to you
        </p>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-lg">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, MRN or condition…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 text-sm bg-white border border-neutral-300 rounded-lg text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 hover:border-neutral-400 transition-all duration-150"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Patient list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider">
            {searchQuery ? `Results for "${searchQuery}"` : "Your Patients"}
          </h2>
          {filtered.length > 0 && (
            <span className="text-xs text-neutral-400">{filtered.length} shown</span>
          )}
        </div>

        <div className="bg-white rounded-xl border border-neutral-200/80 shadow-card overflow-hidden">
          {filtered.length > 0 ? (
            <ul className="divide-y divide-neutral-100">
              {filtered.map((patient) => (
                <li key={patient.id}>
                  <Link
                    href={`/doctor/patients/${patient.id}`}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-neutral-50 transition-colors group"
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-brand-gradient flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
                      {patient.first_name?.[0]?.toUpperCase()}{patient.last_name?.[0]?.toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-neutral-900 group-hover:text-primary-700 transition-colors">
                          {patient.first_name} {patient.last_name}
                        </span>
                        {patient.mrn && (
                          <span className="text-xs text-neutral-400 font-mono">MRN: {patient.mrn}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-neutral-500">
                        {patient.date_of_birth && (
                          <span>{new Date().getFullYear() - new Date(patient.date_of_birth).getFullYear()} yrs</span>
                        )}
                        {patient.date_of_birth && patient.gender && (
                          <span className="w-1 h-1 rounded-full bg-neutral-300 flex-shrink-0" />
                        )}
                        {patient.gender && <span className="capitalize">{patient.gender}</span>}
                        {(patient.date_of_birth || patient.gender) && patient.email && (
                          <span className="w-1 h-1 rounded-full bg-neutral-300 flex-shrink-0" />
                        )}
                        {patient.email && <span className="truncate max-w-[200px]">{patient.email}</span>}
                      </div>
                    </div>

                    {/* Status */}
                    {patient.status && (
                      <StatusBadge status={patient.status} />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mb-3">
                <Users className="w-5 h-5 text-neutral-400" />
              </div>
              <p className="text-sm font-medium text-neutral-700">
                {searchQuery ? "No patients match your search" : "No patients assigned yet"}
              </p>
              <p className="text-xs text-neutral-400 mt-1">
                {searchQuery ? "Try a different name, MRN or condition" : "Patients will appear here once assigned"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active:   "bg-success-50  text-success-700  border-success-100",
    pending:  "bg-neutral-100 text-neutral-600  border-neutral-200",
    inactive: "bg-warning-50  text-warning-700  border-warning-100",
  };
  const cls = styles[status] ?? "bg-neutral-100 text-neutral-600 border-neutral-200";
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${cls} flex-shrink-0`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}
