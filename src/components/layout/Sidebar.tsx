"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/lib/hooks";
import {
  LayoutDashboard, Users, ClipboardList,
  UserCircle, LogOut, Brain,
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

  const role  = String(user?.roles?.[0] || (user as any)?.role || "patient").toLowerCase();
  const items = NAV_ITEMS[role] || NAV_ITEMS.patient;

  const initials = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join("").toUpperCase();
  const roleName = role.replace("_", " ");

  return (
    <aside className="group fixed left-0 top-0 h-full w-16 hover:w-64 bg-white border-r border-neutral-200/80 flex flex-col z-40 transition-[width] duration-300 ease-in-out overflow-hidden">
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-neutral-100 flex-shrink-0">
        <Link href="/" className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-brand-gradient flex items-center justify-center flex-shrink-0">
            <Brain className="h-4.5 w-4.5 text-white" />
          </div>
          <div className="min-w-0 overflow-hidden max-w-0 group-hover:max-w-[160px] transition-[max-width] duration-300 ease-in-out opacity-0 group-hover:opacity-100">
            <p className="text-sm font-bold text-accent-dark leading-tight whitespace-nowrap">NeuroWellness</p>
            <p className="text-[10px] font-semibold text-primary-500 uppercase tracking-widest leading-tight whitespace-nowrap">PRS</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-0.5">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-primary-50 text-primary-700 shadow-[inset_3px_0_0_0_#0ea5e9]"
                  : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
              )}
            >
              <item.icon className={cn("h-4.5 w-4.5 flex-shrink-0", isActive ? "text-primary-600" : "text-neutral-400")} />
              <span className="overflow-hidden max-w-0 group-hover:max-w-[160px] transition-[max-width] duration-300 ease-in-out opacity-0 group-hover:opacity-100 whitespace-nowrap ml-3">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-neutral-100 px-2 py-3 flex-shrink-0">
        <div className="flex items-center px-3 py-2 rounded-lg mb-1">
          <div className="w-8 h-8 rounded-full bg-brand-gradient flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
            {initials}
          </div>
          <div className="overflow-hidden max-w-0 group-hover:max-w-[160px] transition-[max-width] duration-300 ease-in-out opacity-0 group-hover:opacity-100 ml-3">
            <p className="text-sm font-semibold text-neutral-900 whitespace-nowrap leading-tight">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs text-neutral-500 capitalize leading-tight mt-0.5 whitespace-nowrap">{roleName}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center px-3 py-2 rounded-lg text-sm font-medium text-neutral-500 hover:bg-danger-50 hover:text-danger-600 w-full transition-all duration-150"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          <span className="overflow-hidden max-w-0 group-hover:max-w-[160px] transition-[max-width] duration-300 ease-in-out opacity-0 group-hover:opacity-100 whitespace-nowrap ml-3">
            Sign out
          </span>
        </button>
      </div>
    </aside>
  );
}
