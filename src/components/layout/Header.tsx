"use client";

import { memo } from "react";
import { Menu, Search, Bell } from "lucide-react";
import { useSidebar } from "@/contexts/SidebarContext";

/** Matches the Anava Clinical UI design system's navigation/Header.jsx
 * exactly: a search pill (radius-full, neutral-50 fill) plus a round
 * notification-bell button, nothing else — no breadcrumb/title (that's
 * PageShell's job, rendered per-page) and no user chip (that lives in the
 * Sidebar's footer, already implemented there). */
function HeaderInner() {
  const { isMobileOpen, setIsMobileOpen, isCollapsed } = useSidebar();

  return (
    <>
      {/* Mobile top bar — unchanged */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white/95 backdrop-blur-sm border-b border-neutral-200/80 flex items-center px-4 gap-3 z-30">
        <button
          className="p-2 rounded-lg hover:bg-neutral-100 transition-colors text-neutral-600"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="text-base font-bold text-neutral-800 tracking-tight">Anava</span>
      </header>

      {/* Desktop header */}
      <header
        className={`hidden md:flex fixed top-0 right-0 h-16 bg-white/95 backdrop-blur-sm border-b border-neutral-200 items-center justify-between gap-4 px-5 z-20 transition-[left] duration-200 ease-out ${
          isCollapsed ? "left-16" : "left-64"
        }`}
      >
        <div className="relative flex-1 max-w-[420px] min-w-[200px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
          <input
            placeholder="Search patients, appointments, invoices…"
            className="w-full h-[38px] pl-9 pr-3.5 rounded-full border border-neutral-200 bg-neutral-50 text-[13px] text-neutral-700 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 transition-colors"
          />
        </div>

        <button
          className="relative w-[38px] h-[38px] rounded-full border border-neutral-200 bg-white flex items-center justify-center text-neutral-600 hover:bg-neutral-50 transition-colors flex-shrink-0"
          aria-label="Notifications"
        >
          <Bell className="h-[17px] w-[17px]" />
        </button>
      </header>
    </>
  );
}

export const Header = memo(HeaderInner);
