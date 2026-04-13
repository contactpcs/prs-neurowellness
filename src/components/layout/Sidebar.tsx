"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { useAuth } from "@/lib/hooks";
import {
  LayoutDashboard, Users, ClipboardList, AlertTriangle,
  TrendingUp, UserCircle, LogOut, Brain,
} from "lucide-react";

const NAV_ITEMS: Record<string, Array<{ label: string; href: string; icon: React.ElementType }>> = {
  patient: [
    { label: "Dashboard", href: "/patient/dashboard", icon: LayoutDashboard },
    { label: "My Results", href: "/patient/results", icon: ClipboardList },
    { label: "Profile", href: "/patient/profile", icon: UserCircle },
  ],
  doctor: [
    { label: "Dashboard", href: "/doctor/dashboard", icon: LayoutDashboard }  ],
  clinical_assistant: [
    { label: "Dashboard", href: "/clinical-assistant/dashboard", icon: LayoutDashboard },
    { label: "Patients", href: "/clinical-assistant/patients", icon: Users },
  ],
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const role = user?.roles?.[0] || "patient";
  const items = NAV_ITEMS[role] || NAV_ITEMS.patient;

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-neutral-200 flex flex-col z-40">
      <div className="px-6 py-5 border-b border-neutral-100">
        <Link href="/" className="flex items-center gap-2">
          <Brain className="h-7 w-7 text-accent" />
          <div>
            <span className="text-lg font-bold text-accent-dark">NeuroWellness</span>
            <span className="block text-xs text-primary-500 font-medium -mt-0.5">PRS</span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary-50 text-primary-700"
                  : "text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-neutral-100">
        <div className="px-3 py-2 mb-2">
          <p className="text-sm font-medium text-neutral-900 truncate">
            {user?.first_name} {user?.last_name}
          </p>
          <p className="text-xs text-neutral-500 capitalize">{role.replace("_", " ")}</p>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-600 hover:bg-neutral-50 hover:text-danger-500 w-full transition-colors"
        >
          <LogOut className="h-5 w-5" />
          Logout
        </button>
      </div>
    </aside>
  );
}
