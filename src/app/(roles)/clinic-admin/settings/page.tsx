"use client";

import Link from "next/link";
import { Cpu, Clock, ChevronRight } from "lucide-react";
import { Card, PageShell } from "@/components/ui";

// Clinic-admin settings hub, laid out as a list of links so more sections
// (billing, staff policy, ...) slot in the same way later without
// restructuring the page.
const SETTINGS_SECTIONS = [
  {
    href: "/clinic-admin/settings/devices",
    icon: Cpu,
    label: "Clinic Devices",
    description: "Which neuromodulation devices this clinic owns, and how many",
  },
  {
    href: "/clinic-admin/settings/device-schedules",
    icon: Clock,
    label: "Device Schedule",
    description: "When device sessions can run each week, and how many at once",
  },
];

export default function ClinicAdminSettingsPage() {
  return (
    <PageShell title="Settings" root="Clinic Admin">
      <div className="max-w-2xl space-y-6">
      <Card>
        <div className="divide-y divide-neutral-100">
          {SETTINGS_SECTIONS.map(({ href, icon: Icon, label, description }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between px-6 py-4 hover:bg-neutral-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4.5 w-4.5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-800">{label}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{description}</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-neutral-400 flex-shrink-0" />
            </Link>
          ))}
        </div>
      </Card>
      </div>
    </PageShell>
  );
}
