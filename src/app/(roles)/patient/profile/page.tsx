"use client";

import { useAuth } from "@/lib/hooks";
import { Card, CardContent } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/constants";

export default function PatientProfilePage() {
  const { user } = useAuth();

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
    </div>
  );
}
