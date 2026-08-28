"use client";

import { useState } from "react";
import { Check, KeyRound, Shield, Monitor } from "lucide-react";
import { PageShell } from "@/components/ui";

const BRAND = "linear-gradient(135deg, #00A1E4 0%, #09172E 100%)";
const BRAND_PX = "#00A1E4";

type NotifKey = "newAppts" | "riskAlerts" | "revenueUpdates" | "platformUpdates";

export default function DoctorSettingsPage() {
  const [notifPrefs, setNotifPrefs] = useState<Record<NotifKey, boolean>>({
    newAppts: true,
    riskAlerts: true,
    revenueUpdates: false,
    platformUpdates: true,
  });
  const [clinic, setClinic] = useState("Mumbai Wellness Clinic");
  const [timeZone] = useState("Asia/Kolkata (IST)");
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  return (
    <PageShell title="Settings" root="Doctor">
      <div className="max-w-3xl mx-auto flex flex-col gap-5">
      {/* Notifications */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-5 py-3.5 bg-neutral-50 border-b border-neutral-100">
          <p className="text-sm font-semibold text-neutral-700">Notifications</p>
        </div>
        <div className="divide-y divide-neutral-100">
          {(
            [
              { key: "newAppts", label: "New Patient Appointments", desc: "Email notification for new bookings" },
              { key: "riskAlerts", label: "Risk Alerts", desc: "Immediate alert for flagged PRS responses" },
              { key: "revenueUpdates", label: "Revenue Updates", desc: "Weekly revenue summaries" },
              { key: "platformUpdates", label: "Platform Updates", desc: "New features and announcements" },
            ] as { key: NotifKey; label: string; desc: string }[]
          ).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-neutral-900">{label}</p>
                <p className="text-xs text-neutral-400 mt-0.5">{desc}</p>
              </div>
              <button
                onClick={() => setNotifPrefs((p) => ({ ...p, [key]: !p[key] }))}
                className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors"
                style={notifPrefs[key] ? { background: BRAND_PX, borderColor: BRAND_PX } : { background: "#fff", borderColor: "#d1d5db" }}
              >
                {notifPrefs[key] && <Check className="w-3 h-3 text-white" />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Clinic & Availability */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-5 py-3.5 bg-neutral-50 border-b border-neutral-100">
          <p className="text-sm font-semibold text-neutral-700">Clinic &amp; Availability</p>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-neutral-600 block mb-1.5">Default Clinic</label>
            <select
              value={clinic}
              onChange={(e) => setClinic(e.target.value)}
              className="w-full h-9 rounded-lg border border-neutral-200 px-3 text-sm bg-white"
            >
              <option>Mumbai Wellness Clinic</option>
              <option>Andheri Branch</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-neutral-600 block mb-1.5">Time Zone</label>
            <select disabled value={timeZone} className="w-full h-9 rounded-lg border border-neutral-200 px-3 text-sm bg-neutral-50 text-neutral-500">
              <option>{timeZone}</option>
            </select>
          </div>
          <p className="text-xs text-neutral-400">
            Working hours, overrides, and leave are managed on the <a href="/doctor/schedule" className="text-primary-600 font-medium">Schedule</a> page.
          </p>
        </div>
      </div>

      {/* Security */}
      <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden">
        <div className="px-5 py-3.5 bg-neutral-50 border-b border-neutral-100">
          <p className="text-sm font-semibold text-neutral-700">Security</p>
        </div>
        <div className="divide-y divide-neutral-100">
          {[
            { Icon: KeyRound, label: "Change Password", sub: "Last changed: —" },
            { Icon: Shield, label: "Two-Factor Authentication", sub: "Manage 2FA settings" },
            { Icon: Monitor, label: "Active Sessions", sub: "Manage logged-in devices" },
          ].map(({ Icon, label, sub }) => (
            <button key={label} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-neutral-50 transition-colors text-left">
              <Icon className="w-4 h-4 text-neutral-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-neutral-900">{label}</p>
                <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          className="h-10 px-5 rounded-lg text-white text-sm font-semibold hover:opacity-90 transition-opacity"
          style={{ background: BRAND }}
        >
          Save Changes
        </button>
        {saved && (
          <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
            <Check className="w-4 h-4" /> Settings saved
          </span>
        )}
      </div>
      </div>
    </PageShell>
  );
}
