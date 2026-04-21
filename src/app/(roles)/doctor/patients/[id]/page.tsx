"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Plus, ClipboardList, PlayCircle, BarChart2 } from "lucide-react";
import { PatientDetailSkeleton, Button } from "@/components/ui";
import { doctorsService } from "@/lib/api/services/doctors.service";
import { permissionsService } from "@/lib/api/services/permissions.service";
import type { PatientDetail, Permission } from "@/types/domain.types";

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

export default function DoctorPatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [assessments, setAssessments] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [patientData, permissionsData] = await Promise.all([
          doctorsService.getPatient(id),
          permissionsService.getPatientPermissions(id),
        ]);

        if (cancelled) return;
        setPatient(patientData);
        setAssessments(permissionsData.permissions ?? []);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f7f6f2] to-[#f4f0ef]">
      {/* Sub-header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-full px-8 py-4 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            <ChevronRight className="w-6 h-6 rotate-180" />
            <span>Back</span>
          </button>
          <Link href={`/doctor/patients/${id}/assign`}>
            <Button size="sm">
              <Plus className="h-4 w-4" /> Assign Assessment
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-full px-8 py-8 space-y-6">
        {/* Patient info */}
        <div className="grid grid-cols-3 gap-5">
          <div className="col-span-2 bg-white rounded-lg shadow-md p-7">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-400 to-purple-600 flex items-center justify-center text-white font-bold text-2xl border-2 border-[#f47920]">
                {fullName?.[0]?.toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-neutral-900">{fullName}</h1>
                  {patient?.mrn && <span className="text-neutral-500 text-sm">MRN: {patient.mrn}</span>}
                </div>
                <div className="flex items-center gap-3 mt-2 text-neutral-600 text-sm">
                  {age && <span>{age} Yrs</span>}
                  {patient?.gender && <span className="capitalize">{patient.gender}</span>}
                  {patient?.email && <span>{patient.email}</span>}
                  {patient?.phone && <span>{patient.phone}</span>}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-5 space-y-4">
            {patient?.condition && (
              <div>
                <p className="text-neutral-500 text-sm">Condition</p>
                <p className="text-neutral-900 font-semibold">{patient.condition}</p>
              </div>
            )}
            {patient?.status && (
              <div>
                <p className="text-neutral-500 text-sm">Status</p>
                <p className="text-neutral-900 font-semibold capitalize">{patient.status}</p>
              </div>
            )}
          </div>
        </div>

        {/* Assigned Assessments */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-neutral-900">Assigned Assessments</h2>
              <p className="text-neutral-500 text-sm mt-0.5">Assessments assigned to this patient</p>
            </div>
            <Link href={`/doctor/patients/${id}/assign`}>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4" /> Assign New
              </Button>
            </Link>
          </div>

          {assessments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ClipboardList className="h-10 w-10 text-neutral-300 mb-3" />
              <p className="text-neutral-500 text-sm font-medium">No assessments assigned yet</p>
              <p className="text-neutral-400 text-xs mt-1">Click "Assign Assessment" to get started</p>
            </div>
          ) : (
            <div className="divide-y divide-neutral-100">
              {assessments.map((a) => (
                <div key={a.permission_id} className="flex items-center justify-between py-4 gap-4">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <p className="text-sm font-semibold text-neutral-900 truncate">
                      {a.disease_name ?? a.disease_id}
                    </p>
                    <p className="text-xs text-neutral-400">
                      Assigned {formatDate(a.granted_at)}
                      {a.expires_at && ` · Expires ${formatDate(a.expires_at)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusClass(a.status)}`}>
                      {a.status}
                    </span>
                    {a.status === "granted" && (
                      <Link href={`/doctor/patients/${id}/assessment/${a.permission_id}`}>
                        <Button size="sm" variant="secondary">
                          <PlayCircle className="h-4 w-4" /> Take on Behalf
                        </Button>
                      </Link>
                    )}
                    {a.status === "completed" && a.instance_id && (
                      <Link href={`/doctor/patients/${id}/results/${a.instance_id}`}>
                        <Button size="sm" variant="outline">
                          <BarChart2 className="h-4 w-4" /> View Results
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
