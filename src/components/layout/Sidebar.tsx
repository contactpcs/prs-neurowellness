"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/lib/hooks";
import { useSidebar } from "@/contexts/SidebarContext";
import {
  LayoutDashboard, Users, ClipboardList,
  UserCircle, LogOut, Brain, ChevronLeft, ChevronRight,
} from "lucide-react";

const NAV_ITEMS: Record<string, Array<{ label: string; href: string; icon: React.ElementType }>> = {
  patient: [
    { label: "Dashboard",  href: "/patient/dashboard", icon: LayoutDashboard },
    { label: "My Results", href: "/patient/results",   icon: ClipboardList },
    { label: "Profile",    href: "/patient/profile",   icon: UserCircle },
  ],
  doctor: [
    { label: "Dashboard", href: "/doctor/dashboard", icon: LayoutDashboard },
  ],
  clinical_assistant: [
    { label: "Dashboard", href: "/clinical-assistant/dashboard", icon: LayoutDashboard },
    { label: "Patients",  href: "/clinical-assistant/patients",  icon: Users },
  ],
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { isCollapsed, setIsCollapsed } = useSidebar();

  const role     = String(user?.roles?.[0] || (user as any)?.role || "patient").toLowerCase();
  const items    = NAV_ITEMS[role] || NAV_ITEMS.patient;
  const initials = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join("").toUpperCase();
  const roleName = role.replace("_", " ");

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-full bg-blue-800 flex flex-col z-40 transition-all duration-200",
      isCollapsed ? "w-16" : "w-64",
    )}>
      {/* Logo + toggle */}
      <div className="h-16 flex items-center border-b border-blue-700 flex-shrink-0 relative px-4">
        {!isCollapsed && (
          <Link href="/" className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <Brain className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white leading-tight">NeuroWellness</p>
              <p className="text-[10px] font-semibold text-blue-300 uppercase tracking-widest leading-tight">PRS</p>
            </div>
          </Link>
        )}
        {isCollapsed && (
          <Link href="/" className="flex items-center justify-center w-full">
            <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center flex-shrink-0">
              <Brain className="h-4 w-4 text-white" />
            </div>
          </Link>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-blue-600 border border-blue-500 flex items-center justify-center hover:bg-blue-500 transition-colors z-50",
          )}
        >
          {isCollapsed
            ? <ChevronRight className="h-3 w-3 text-white" />
            : <ChevronLeft className="h-3 w-3 text-white" />
          }
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.label : undefined}
              className={cn(
                "flex items-center rounded-lg text-sm font-medium transition-colors border-l-2",
                isCollapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
                isActive
                  ? "bg-white/15 text-white border-white"
                  : "text-blue-100 hover:bg-white/10 hover:text-white border-transparent",
              )}
            >
              <item.icon className={cn("h-4.5 w-4.5 flex-shrink-0", isActive ? "text-white" : "text-blue-300")} />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-blue-700 px-2 py-3 flex-shrink-0">
        {!isCollapsed ? (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg mb-1">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white leading-tight truncate">
                {user?.first_name} {user?.last_name}
              </p>
              <p className="text-xs text-blue-300 capitalize leading-tight mt-0.5">{roleName}</p>
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-semibold" title={`${user?.first_name} ${user?.last_name}`}>
              {initials}
            </div>
          </div>
        )}
        <button
          onClick={logout}
          title={isCollapsed ? "Sign out" : undefined}
          className={cn(
            "flex items-center rounded-lg text-sm font-medium text-blue-200 hover:bg-white/10 hover:text-white w-full transition-colors",
            isCollapsed ? "justify-center px-2 py-2" : "gap-3 px-3 py-2",
          )}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          {!isCollapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}
