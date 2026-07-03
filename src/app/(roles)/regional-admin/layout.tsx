"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks";
import { PageLoader } from "@/components/ui";
import { ROUTES } from "@/lib/constants";

// The parent (roles)/layout.tsx already renders <Sidebar>, <Header>, and <main>.
// This layout only adds the regional_admin-role guard on top of that.

export default function RegionalAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading, isRestoring } = useAuth();
  const router = useRouter();

  const waiting = isRestoring || isLoading;
  const isRegionalAdmin = (user?.roles ?? []).some((r) => String(r).toLowerCase() === "regional_admin");

  useEffect(() => {
    if (waiting) return;
    if (!isAuthenticated) {
      router.replace(ROUTES.LOGIN);
      return;
    }
    if (!isRegionalAdmin) {
      router.replace(ROUTES.LOGIN);
    }
  }, [waiting, isAuthenticated, isRegionalAdmin, router]);

  if (waiting) return <PageLoader />;
  if (!isAuthenticated || !isRegionalAdmin) return <PageLoader />;

  return <>{children}</>;
}
