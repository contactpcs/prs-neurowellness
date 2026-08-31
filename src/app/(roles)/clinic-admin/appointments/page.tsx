"use client";

import { Users } from "lucide-react";
import { useAuth } from "@/lib/hooks";
import { Card, CardContent } from "@/components/ui";
import { AppointmentsSection } from "@/components/admin/AppointmentsSection";

export default function ClinicAdminAppointmentsPage() {
  const { user } = useAuth();
  if (!user?.clinic_id) {
    return (
      <Card><CardContent className="py-16 text-center"><Users className="h-10 w-10 text-neutral-300 mx-auto mb-3" /><p className="text-sm text-neutral-500">No clinic assigned to your account.</p></CardContent></Card>
    );
  }
  return <AppointmentsSection clinicId={user.clinic_id} />;
}
