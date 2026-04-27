"use client";

import { useAuth } from "@/lib/hooks";
import { useSidebar } from "@/contexts/SidebarContext";
import { Bell, Menu } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export function Header() {
  const { user } = useAuth();
  const { isCollapsed, setIsCollapsed } = useSidebar();

  const initials = [user?.first_name?.[0], user?.last_name?.[0]].filter(Boolean).join("").toUpperCase();
  const role = String(user?.roles?.[0] || (user as any)?.role || "").replace("_", " ");

  return (
    <header
      className={cn(
        "fixed top-0 right-0 h-16 bg-white/95 backdrop-blur-sm border-b border-neutral-200/80 flex items-center justify-between px-4 z-30 transition-all duration-250 ease-in-out",
        isCollapsed ? "left-0" : "left-64"
      )}
    >
      {/* Left: toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="p-2 rounded-lg text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Right: actions + user */}
      <div className="flex items-center gap-1">
        <button className="relative p-2 rounded-lg text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-primary-500/30">
          <Bell className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2.5 ml-2 pl-3 border-l border-neutral-200">
          <div className="w-8 h-8 rounded-full bg-brand-gradient flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 ring-2 ring-white shadow-sm">
            {initials}
          </div>
          <div className="hidden md:block leading-tight">
            <p className="text-sm font-semibold text-neutral-900">
              {user?.first_name} {user?.last_name}
            </p>
            {role && (
              <p className="text-xs text-neutral-500 capitalize">{role}</p>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
