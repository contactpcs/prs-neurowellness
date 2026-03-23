"use client";

import { useAuth } from "@/lib/hooks";
import { Bell } from "lucide-react";

export function Header() {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-neutral-200 flex items-center justify-between px-6 ml-64">
      <div />
      <div className="flex items-center gap-4">
        <button className="relative text-neutral-500 hover:text-neutral-700">
          <Bell className="h-5 w-5" />
        </button>
        <div className="h-8 w-8 rounded-full bg-brand-gradient flex items-center justify-center text-white text-sm font-medium">
          {user?.first_name?.[0]}{user?.last_name?.[0]}
        </div>
      </div>
    </header>
  );
}
