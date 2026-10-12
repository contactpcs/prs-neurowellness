"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import { PageLoader } from "@/components/ui";
import { useAuth } from "@/lib/hooks";
import { ROUTES } from "@/lib/constants";

function dashboardRouteForRoles(roles: string[] = []): string {
  const roleList = roles.map((r: string) => String(r).toLowerCase());
  if (roleList.includes("super_admin")) return ROUTES.ADMIN_DASHBOARD;
  if (roleList.includes("regional_admin")) return ROUTES.REGIONAL_ADMIN_DASHBOARD;
  if (roleList.includes("clinic_admin")) return ROUTES.CLINIC_ADMIN_DASHBOARD;
  if (roleList.includes("patient")) return ROUTES.PATIENT_DASHBOARD;
  if (roleList.includes("doctor")) return ROUTES.DOCTOR_DASHBOARD;
  if (roleList.includes("receptionist")) return ROUTES.RECEPTIONIST_DASHBOARD;
  if (roleList.includes("clinical_assistant")) return ROUTES.CA_DASHBOARD;
  return ROUTES.LOGIN;
}

function isAuthorizedForPath(pathname: string, rawRoles: string[] = []): boolean {
  const roles = rawRoles.map((r) => String(r).toLowerCase());
  const isSuperAdmin = roles.includes("super_admin");

  if (pathname.startsWith("/admin")) {
    return isSuperAdmin;
  }
  if (pathname.startsWith("/regional-admin")) {
    return isSuperAdmin || roles.includes("regional_admin");
  }
  if (pathname.startsWith("/clinic-admin")) {
    return isSuperAdmin || roles.includes("clinic_admin");
  }
  if (pathname.startsWith("/doctor")) {
    return roles.includes("doctor");
  }
  if (pathname.startsWith("/clinical-assistant")) {
    return roles.includes("clinical_assistant");
  }
  if (pathname.startsWith("/receptionist")) {
    return roles.includes("receptionist");
  }
  if (pathname.startsWith("/patient")) {
    return roles.includes("patient");
  }
  return true;
}

function RolesLayoutInner({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();
  const { user, isAuthenticated, isRestoring } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const waiting = isRestoring;
  const userRoles = Array.isArray(user?.roles) ? user.roles : [];
  const isAuthorized = isAuthenticated && user ? isAuthorizedForPath(pathname, userRoles) : false;

  useEffect(() => {
    if (waiting) return;
    if (!isAuthenticated) {
      router.replace(ROUTES.LOGIN);
      return;
    }
    if (!isAuthorized) {
      const target = dashboardRouteForRoles(userRoles);
      router.replace(target);
    }
  }, [waiting, isAuthenticated, isAuthorized, userRoles, router]);

  // Hold the entire roles shell until session restoration is done or if not authenticated or not authorized
  if (waiting || !isAuthenticated || !isAuthorized) return <PageLoader />;

  return (
    <div className="min-h-screen bg-neutral-50">
      <Sidebar />
      <Header />
      <main
        className={`pt-14 md:pt-6 p-4 sm:p-6 transition-[margin] duration-150 ease-in-out ${
          isCollapsed ? "md:ml-16" : "md:ml-64"
        }`}
      >
        {children}
      </main>
    </div>
  );
}

export default function RolesLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <RolesLayoutInner>{children}</RolesLayoutInner>
    </SidebarProvider>
  );
}
