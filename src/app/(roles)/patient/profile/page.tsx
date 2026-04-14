"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/hooks";
import { patientsService } from "@/lib/api/services/patients.service";
import { Card, CardContent, PageLoader } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/constants";

export default function PatientProfilePage() {
  const { user } = useAuth();
  const [doctor, setDoctor] = useState<{
    id: string;
    first_name: string;
    last_name: string;
    specialization?: string;
    phone?: string;
  } | null>(null);
  const [isDoctorLoading, setIsDoctorLoading] = useState(true);

  useEffect(() => {
    patientsService.getMyDoctor()
      .then(setDoctor)
      .catch(() => {})
      .finally(() => setIsDoctorLoading(false));
  }, []);

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-neutral-900">Profile</h1>

      <Card>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs text-neutral-500 uppercase">Name</p>
            <p className="text-sm font-medium text-neutral-900">{user?.first_name} {user?.last_name}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 uppercase">Email</p>
            <p className="text-sm text-neutral-700">{user?.email}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500 uppercase">Role</p>
            <p className="text-sm text-neutral-700 capitalize">{ROLE_LABELS[user?.roles?.[0] || "patient"]}</p>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Assigned Doctor</h2>
        {isDoctorLoading ? (
          <PageLoader />
        ) : doctor ? (
          <Card>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-neutral-500 uppercase">Name</p>
                <p className="text-sm font-medium text-neutral-900">
                  Dr. {doctor.first_name} {doctor.last_name}
                </p>
              </div>
              {doctor.specialization && (
                <div>
                  <p className="text-xs text-neutral-500 uppercase">Specialization</p>
                  <p className="text-sm text-neutral-700">{doctor.specialization}</p>
                </div>
              )}
              {doctor.phone && (
                <div>
                  <p className="text-xs text-neutral-500 uppercase">Phone</p>
                  <p className="text-sm text-neutral-700">{doctor.phone}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent>
              <p className="text-sm text-neutral-500">No doctor assigned yet.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
