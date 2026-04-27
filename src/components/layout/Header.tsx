"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/hooks";
import { doctorsService } from "@/lib/api/services/doctors.service";
import { staffService } from "@/lib/api/services/staff.service";

function useCurrentPatient(role: string) {
  const pathname = usePathname();
  const [patientName, setPatientName] = useState<string | null>(null);

  useEffect(() => {
    const match = pathname.match(/\/patients\/([^/]+)/);
    const patientId = match?.[1];

    if (!patientId) {
      setPatientName(null);
      return;
    }

    let cancelled = false;

    const fetch =
      role === "doctor"
        ? doctorsService.getPatient(patientId)
        : role === "clinical_assistant"
          ? staffService.getPatient(patientId)
          : null;

    if (!fetch) return;

    fetch
      .then((p) => { if (!cancelled) setPatientName(p.full_name ?? null); })
      .catch(() => { if (!cancelled) setPatientName(null); });

    return () => { cancelled = true; };
  }, [pathname, role]);

  return patientName;
}

export function Header() {
  const { user } = useAuth();

  const role = String(user?.roles?.[0] || (user as any)?.role || "").toLowerCase();
  const patientName = useCurrentPatient(role);

  const displayName = patientName ?? `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim();
  const displayInitial = patientName
    ? patientName[0]?.toUpperCase()
    : [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join("").toUpperCase();
  const displayRole = patientName ? "Patient" : role.replace("_", " ");

  return (
    <header className="fixed top-0 left-16 right-0 h-16 bg-white/95 backdrop-blur-sm border-b border-neutral-200/80 flex items-center justify-end px-4 z-30">
      <div className="flex items-center gap-2.5 pl-3">
        <div className="w-8 h-8 rounded-full bg-brand-gradient flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ring-2 ring-white shadow-sm">
          {displayInitial}
        </div>
        <div className="hidden md:block leading-tight">
          <p className="text-sm font-semibold text-neutral-900">{displayName}</p>
          {displayRole && (
            <p className="text-xs text-neutral-500 capitalize">{displayRole}</p>
          )}
        </div>
      </div>
    </header>
  );
}
