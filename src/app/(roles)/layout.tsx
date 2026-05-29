"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import { PageLoader } from "@/components/ui";
import { useAuth } from "@/lib/hooks";
import { ROUTES } from "@/lib/constants";

function RolesLayoutInner({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();
  const { isAuthenticated, isLoading, isRestoring } = useAuth();
  const router = useRouter();

  const waiting = isRestoring;

  useEffect(() => {
    if (waiting) return;
    if (!isAuthenticated) {
      router.replace(ROUTES.LOGIN);
    }
  }, [waiting, isAuthenticated, router]);

  // Hold the entire roles shell until session restoration is done
  if (waiting) return <PageLoader />;
  if (!isAuthenticated) return <PageLoader />;

  return (
    <div className="min-h-screen bg-neutral-50">
      <Sidebar />
      <main className={`${isCollapsed ? "ml-16" : "ml-64"} pt-16 p-6 transition-all duration-200`}>
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
