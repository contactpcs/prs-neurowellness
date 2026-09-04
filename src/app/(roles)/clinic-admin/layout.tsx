"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks";
import { PageLoader } from "@/components/ui";
import { ROUTES } from "@/lib/constants";

// The parent (roles)/layout.tsx already renders <Sidebar>, <Header>, and <main>.
// This layout only adds the clinic_admin-role guard on top of that.

export default function ClinicAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, isRestoring } = useAuth();
  const router = useRouter();

  const waiting = isRestoring || isLoading;
  const isClinicAdmin = (user?.roles ?? []).some((r) => String(r).toLowerCase() === "clinic_admin");

  useEffect(() => {
    if (waiting) return;
    if (!isAuthenticated) {
      router.replace(ROUTES.LOGIN);
      return;
    }
    if (!isClinicAdmin) {
      router.replace(ROUTES.LOGIN);
    }
  }, [waiting, isAuthenticated, isClinicAdmin, router]);

  if (waiting) return <PageLoader />;
  if (!isAuthenticated || !isClinicAdmin) return <PageLoader />;

  return <>{children}</>;
}
