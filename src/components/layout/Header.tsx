"use client";

import { memo, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useAuth } from "@/lib/hooks";
import { useSidebar } from "@/contexts/SidebarContext";
import { doctorsService } from "@/lib/api/services/doctors.service";
import { staffService } from "@/lib/api/services/staff.service";
import { authService } from "@/lib/api/services";

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
        : (role === "clinical_assistant" || role === "receptionist")
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

function HeaderInner() {
  const { user } = useAuth();
  const { isCollapsed, isMobileOpen, setIsMobileOpen } = useSidebar();
  const [clinicName, setClinicName] = useState<string | null>(null);

  const role = String(user?.roles?.[0] || (user as any)?.role || "").toLowerCase();
  const patientName = useCurrentPatient(role);

  useEffect(() => {
    if (!user) return;
    const fromUser = (user as any)?.clinic_name || (user as any)?.clinic_city;
    if (fromUser) { setClinicName(fromUser); return; }
    const clinicId = (user as any)?.clinic_id;
    if (!clinicId) return;
    authService.getClinics().then((clinics) => {
      const match = clinics.find((c) => c.clinic_id === clinicId);
      setClinicName(match?.clinic_name || match?.city || null);
    }).catch(() => {});
  }, [user]);

  const displayName = patientName ?? `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim();
  const displayInitial = patientName
    ? patientName[0]?.toUpperCase()
    : [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join("").toUpperCase();

  const baseRole = patientName ? "Patient" : role.replace("_", " ");
  const displayRole = (!patientName && clinicName)
    ? `${baseRole} · ${clinicName}`
    : baseRole;

  const leftClass = isCollapsed ? "md:left-16" : "md:left-64";

  return (
    <header className={`fixed top-0 left-0 ${leftClass} right-0 h-14 bg-white/95 backdrop-blur-sm border-b border-neutral-200/80 flex items-center justify-between px-4 z-30 transition-all duration-200`}>
      {/* Mobile: hamburger + brand title */}
      <div className="flex items-center gap-2 md:hidden">
        <button
          className="p-2 rounded-lg hover:bg-neutral-100 transition-colors text-neutral-600"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-base font-bold text-neutral-800 tracking-tight">Anava</span>
      </div>
      <div className="hidden md:block" />

      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-full bg-brand-gradient flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ring-2 ring-white shadow-sm">
          {displayInitial}
        </div>
        <div className="hidden sm:block leading-tight">
          <p className="text-sm font-semibold text-neutral-900">{displayName}</p>
          {displayRole && (
            <p className="text-xs text-neutral-500 capitalize">{displayRole}</p>
          )}
        </div>
      </div>
    </header>
  );
}

export const Header = memo(HeaderInner);
