"use client";

import { useEffect, useState } from "react";
import { Building2, CalendarDays } from "lucide-react";
import { useAuth } from "@/lib/hooks";
import { Card, CardContent, Skeleton, PageShell } from "@/components/ui";
import { adminService } from "@/lib/api/services/admin.service";
import type { AdminClinic } from "@/types/admin.types";
import { AppointmentsSection } from "@/components/admin/AppointmentsSection";

export default function RegionalAdminAppointmentsPage() {
  const { user } = useAuth();
  const [clinics, setClinics] = useState<AdminClinic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.region_id) return;
    setIsLoading(true);
    adminService.getClinics({ region_id: user.region_id })
      .then(setClinics)
      .catch((e: any) => setError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Failed to load clinics"))
      .finally(() => setIsLoading(false));
  }, [user?.region_id]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-64" />
      </div>
    );
  }

  if (!selectedClinicId) {
    return (
      <PageShell title="Appointments" root="Regional Admin">
        <p className="text-sm text-neutral-500 -mt-4">Select a clinic to view its appointments and doctors' schedules.</p>

        {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}

        {clinics.length === 0 ? (
          <Card><CardContent className="py-16 text-center"><Building2 className="h-10 w-10 text-neutral-300 mx-auto mb-3" /><p className="text-sm text-neutral-500">No clinics in your region yet.</p></CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {clinics.map((clinic) => (
              <button key={clinic.clinic_id} onClick={() => setSelectedClinicId(clinic.clinic_id)} className="text-left">
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="p-5">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center mb-3">
                      <CalendarDays className="h-5 w-5 text-indigo-600" />
                    </div>
                    <h3 className="text-sm font-semibold text-neutral-900">{clinic.clinic_name}</h3>
                    <p className="text-xs text-neutral-400">{clinic.clinic_code}</p>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>
        )}
      </PageShell>
    );
  }

  const selectedClinic = clinics.find((c) => c.clinic_id === selectedClinicId);

  return (
    <div className="space-y-4">
      <button onClick={() => setSelectedClinicId(null)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
        ← Back to clinic list
      </button>
      {selectedClinic && (
        <p className="text-sm text-neutral-500">Viewing appointments for <span className="font-medium text-neutral-700">{selectedClinic.clinic_name}</span></p>
      )}
      <AppointmentsSection clinicId={selectedClinicId} />
    </div>
  );
}
