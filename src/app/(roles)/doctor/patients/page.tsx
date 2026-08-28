"use client";

import { Fragment, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PatientListSkeleton, PageShell } from "@/components/ui";
import { useDoctorPatients, usePatientPermissions } from "@/lib/hooks";

function calcAge(dob?: string): number | null {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function fmtGender(g?: string): string {
  if (!g) return "";
  return g.charAt(0).toUpperCase() + g.slice(1).toLowerCase();
}

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Expanded accordion body for one patient row — progress timeline,
 * registration status, and session counts, lazily fetched only once the
 * row is opened (usePatientPermissions fetches on mount of this component). */
function PatientRowDetail({ patientId, registrationStatus }: { patientId: string; registrationStatus?: string }) {
  const assessments = usePatientPermissions(patientId);
  const total = assessments.length;
  const completed = assessments.filter((a) => a.status === "completed").length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  const timeline = [...assessments].sort((a, b) =>
    (b.completed_at ?? b.granted_at ?? "").localeCompare(a.completed_at ?? a.granted_at ?? "")
  );

  return (
    <tr>
      <td colSpan={7} className="px-6 py-5 bg-neutral-50 border-t border-neutral-100">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="bg-white rounded-lg p-3 border border-neutral-200">
            <p className="text-xs text-neutral-500 mb-0.5">Registration Status</p>
            <p className="text-sm font-semibold text-neutral-900">
              {registrationStatus ? statusLabel(registrationStatus) : "Active"}
            </p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-neutral-200">
            <p className="text-xs text-neutral-500 mb-0.5">Sessions Completed</p>
            <p className="text-sm font-semibold text-neutral-900">
              {total === 0 ? "No sessions assigned yet" : `${completed} out of ${total} sessions`}
            </p>
          </div>
          <div className="bg-white rounded-lg p-3 border border-neutral-200">
            <p className="text-xs text-neutral-500 mb-0.5">Overall Progress</p>
            <div className="flex items-center gap-2 mt-1.5">
              <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden">
                <div className="h-full rounded-full bg-action-orange transition-all" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-xs font-semibold text-neutral-700 flex-shrink-0">{pct}%</span>
            </div>
          </div>
        </div>

        {total === 0 ? (
          <p className="text-sm text-neutral-400">No assessment activity recorded yet.</p>
        ) : (
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Progress Timeline</p>
            <div className="space-y-2">
              {timeline.map((a) => (
                <div
                  key={a.permission_id}
                  className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-neutral-200 text-sm gap-3"
                >
                  <span className="text-neutral-700 truncate">{a.disease_name || a.disease_id || "Assessment"}</span>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-xs text-neutral-400 whitespace-nowrap">
                      {a.status === "completed" ? `Completed ${fmtDate(a.completed_at)}` : `Granted ${fmtDate(a.granted_at)}`}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded whitespace-nowrap ${
                        a.status === "completed" ? "bg-green-50 text-green-700" : "bg-blue-50 text-blue-700"
                      }`}
                    >
                      {statusLabel(a.status)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

export default function DoctorPatientsPage() {
  const { patients, isLoading } = useDoctorPatients();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const router = useRouter();

  const filtered = patients.filter((p) =>
    `${p.first_name} ${p.last_name} ${p.email} ${p.mrn || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <PatientListSkeleton />;

  return (
    <PageShell title="My Patients" root="Doctor" search={search} onSearch={setSearch}>
      <div className="space-y-5">
      {/* Table */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-base min-w-[600px]">
          <thead>
            <tr className="border-b border-neutral-100 bg-neutral-50">
              <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-500 uppercase tracking-wide">Patient Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-500 uppercase tracking-wide">Diagnosis</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-500 uppercase tracking-wide">Clinic Name</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-500 uppercase tracking-wide">Last Visit</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-500 uppercase tracking-wide">Status</th>
              <th className="pl-6 pr-2 py-3 text-left text-sm font-semibold text-neutral-500 uppercase tracking-wide">Action</th>
              <th className="w-8 pl-0 pr-3 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.map((p) => {
              const age = calcAge(p.date_of_birth);
              const lastVisit = p.last_prs?.completed_at ?? p.assigned_at ?? null;
              const clinicLabel = p.clinic_name ?? p.clinic_city ?? "Kharadi, Pune";
              const isExpanded = expandedId === p.id;
              return (
                <Fragment key={p.id}>
                  <tr className="hover:bg-neutral-50 transition-colors">
                    {/* Patient Name */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-brand-gradient flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                          {p.first_name?.[0]}{p.last_name?.[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-neutral-900">{p.full_name || `${p.first_name} ${p.last_name}`}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {age !== null && <span className="text-xs text-neutral-400">{age} yrs</span>}
                            {age !== null && p.gender && <span className="text-neutral-300 text-xs">·</span>}
                            {p.gender && <span className="text-xs text-neutral-400">{fmtGender(p.gender)}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    {/* Diagnosis */}
                    <td className="px-6 py-4 text-neutral-600">{p.condition || "—"}</td>
                    {/* Clinic Name */}
                    <td className="px-6 py-4 text-neutral-600">{clinicLabel}</td>
                    {/* Last Visit */}
                    <td className="px-6 py-4 text-neutral-600">{fmtDate(lastVisit)}</td>
                    {/* Status */}
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2.5 py-1 rounded-full text-sm font-medium ${
                        p.status === "active" || !p.status
                          ? "bg-green-50 text-green-700"
                          : "bg-neutral-100 text-neutral-500"
                      }`}>
                        {p.status ? (p.status.charAt(0).toUpperCase() + p.status.slice(1)) : "Active"}
                      </span>
                    </td>
                    {/* Action */}
                    <td className="pl-6 pr-2 py-4">
                      <button
                        onClick={() => router.push(`/doctor/patients/${p.id}`)}
                        className="px-4 py-1.5 rounded-lg text-sm font-semibold text-white bg-action-orange hover:bg-action-orange-dark transition-colors"
                      >
                        View
                      </button>
                    </td>
                    {/* Expand toggle */}
                    <td className="pl-0 pr-3 py-4">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : p.id)}
                        className="w-6 h-6 flex items-center justify-center rounded hover:bg-neutral-200 transition-colors"
                        aria-label={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded
                          ? <ChevronDown className="w-4 h-4 text-neutral-500" />
                          : <ChevronRight className="w-4 h-4 text-neutral-500" />}
                      </button>
                    </td>
                  </tr>
                  {isExpanded && (
                    <PatientRowDetail patientId={p.id} registrationStatus={p.status} />
                  )}
                </Fragment>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-6 py-10 text-center text-neutral-400 text-sm">No patients found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      </div>
    </PageShell>
  );
}
