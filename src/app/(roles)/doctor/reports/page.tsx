"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Users, CalendarCheck, AlertTriangle, Activity } from "lucide-react";
import { PageLoader, PageShell } from "@/components/ui";
import { doctorsService } from "@/lib/api/services/doctors.service";
import { treatmentProtocolService } from "@/lib/api/services/treatmentProtocol.service";
import type { ProtocolRead } from "@/types/treatmentProtocol.types";

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function DoctorReportsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [totalPatients, setTotalPatients] = useState(0);
  const [protocols, setProtocols] = useState<ProtocolRead[]>([]);
  const [sessionsThisMonth, setSessionsThisMonth] = useState(0);
  const [missedThisMonth, setMissedThisMonth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ patients }, activeProtocols] = await Promise.all([
          doctorsService.getPatients(),
          treatmentProtocolService.listProtocols({ status: "active" }),
        ]);
        if (cancelled) return;
        setTotalPatients(patients.length);
        setProtocols(activeProtocols);

        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const allSessions = await Promise.all(
          activeProtocols.map((p) => treatmentProtocolService.listProtocolSessions(p.protocol_id).catch(() => []))
        );
        if (cancelled) return;
        const flat = allSessions.flat();
        const inMonth = flat.filter((s) => (s.appointment_date || "").startsWith(monthKey));
        setSessionsThisMonth(inMonth.filter((s) => s.status === "completed").length);
        setMissedThisMonth(inMonth.filter((s) => s.status === "missed").length);
      } catch {
        // keep zeros on failure — no fabricated numbers
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (isLoading) return <PageLoader />;

  const kpis = [
    { label: "Active Patients", value: totalPatients, Icon: Users },
    { label: "Sessions This Month", value: sessionsThisMonth, Icon: CalendarCheck },
    { label: "Active Protocols", value: protocols.length, Icon: Activity },
    { label: "Missed Sessions", value: missedThisMonth, Icon: AlertTriangle },
  ];

  return (
    <PageShell title="Reports" root="Doctor">
      <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {kpis.map(({ label, value, Icon }) => (
          <div key={label} className="bg-white rounded-xl border border-neutral-200 shadow-sm p-4">
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold text-neutral-900">{value}</p>
              <Icon className="w-4 h-4 text-neutral-300" />
            </div>
            <p className="text-xs text-neutral-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-neutral-100">
          <h3 className="text-sm font-semibold text-neutral-900">Active Treatment Protocols</h3>
        </div>
        {protocols.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-neutral-400">No active protocols.</p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {protocols.map((p) => (
              <div
                key={p.protocol_id}
                onClick={() => p.patient_id && router.push(`/doctor/patients/${p.patient_public_id ?? p.patient_id}/treatment-protocol`)}
                className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-neutral-50 cursor-pointer transition-colors"
              >
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{p.patient_name || "—"}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{p.device_name || p.modality || "—"} · started {fmtDate(p.activated_at || p.created_at)}</p>
                </div>
                <span className="text-xs text-neutral-500">{p.session_count} sessions planned</span>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </PageShell>
  );
}
