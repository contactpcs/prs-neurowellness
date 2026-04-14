"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";

function RolesLayoutContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-neutral-50">
      <Sidebar />
      <Header />
      <main className={`${isCollapsed ? "ml-0" : "ml-64"} pt-16 p-6 transition-all`}>
        {children}
      </main>
    </div>
  );
}

export default function RolesLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <RolesLayoutContent>{children}</RolesLayoutContent>
    </SidebarProvider>
  );
}
