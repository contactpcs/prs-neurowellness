"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Syringe } from "lucide-react";
import { PageLoader, PageShell } from "@/components/ui";
import { doctorsService } from "@/lib/api/services/doctors.service";
import { treatmentProtocolService } from "@/lib/api/services/treatmentProtocol.service";
import type { PatientListItem } from "@/types/domain.types";
import type { ProtocolRead } from "@/types/treatmentProtocol.types";

type Row = { patient: PatientListItem; active: ProtocolRead | null; latest: ProtocolRead | null };

function statusTone(status: string): string {
  switch (status) {
    case "active": return "bg-green-50 text-green-700";
    case "draft": return "bg-amber-50 text-amber-700";
    case "cancelled": return "bg-red-50 text-red-600";
    case "completed": return "bg-neutral-100 text-neutral-600";
    default: return "bg-neutral-100 text-neutral-500";
  }
}

function placementLabel(p: ProtocolRead): string {
  const settings = p.device_settings || {};
  const anode = (settings as Record<string, unknown>).anode_site as string | undefined;
  const cathode = (settings as Record<string, unknown>).cathode_site as string | undefined;
  if (anode || cathode) return `${anode || "—"} → ${cathode || "—"}`;
  return "—";
}

export default function DoctorTreatmentPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { patients } = await doctorsService.getPatients();
        // Resolve each patient's own protocols directly — the same lookup
        // TreatmentProtocolPanel does — so the "Modify" vs "New" label here
        // always matches what the destination page will actually show.
        const withProtocols = await Promise.all(
          patients.map(async (patient) => {
            const protocols = await treatmentProtocolService.listProtocols({ patientId: patient.id }).catch(() => []);
            const sorted = protocols.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
            const active = sorted.find((p) => p.status === "active") ?? null;
            const latest = active ?? sorted[sorted.length - 1] ?? null;
            return { patient, active, latest };
          })
        );
        if (!cancelled) setRows(withProtocols);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (isLoading) return <PageLoader />;

  return (
    <PageShell title="Treatment Protocols" root="Doctor">
      <div className="flex flex-col gap-5">
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        {rows.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Syringe className="h-8 w-8 text-neutral-200 mx-auto mb-2" />
            <p className="text-sm text-neutral-400">No patients found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead>
                <tr className="border-b border-neutral-100 bg-neutral-50">
                  {["Patient", "Protocol", "Status", "Device", "Placement", "Current", "Sessions", ""].map((h) => (
                    <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map(({ patient, active, latest }) => {
                  const p = latest;
                  const label = active ? "Modify" : "New";
                  const go = () => router.push(`/doctor/patients/${patient.id}?section=treatment-protocol`);
                  return (
                    <tr key={patient.id} onClick={go} className="hover:bg-neutral-50 cursor-pointer transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-brand-gradient flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                            {(patient.full_name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2)}
                          </div>
                          <span className="font-semibold text-neutral-900">{patient.full_name || "—"}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-neutral-700">{p?.device_name || p?.modality || "—"}</td>
                      <td className="px-5 py-4">
                        {p ? (
                          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${statusTone(p.status)}`}>
                            {p.status}
                          </span>
                        ) : (
                          <span className="text-neutral-300 text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-neutral-600">{p?.modality || "—"}</td>
                      <td className="px-5 py-4 text-neutral-600">{p ? placementLabel(p) : "—"}</td>
                      <td className="px-5 py-4 text-neutral-600">
                        {p?.prescribed_current_ma != null ? `${p.prescribed_current_ma} mA` : "—"}
                      </td>
                      <td className="px-5 py-4 text-neutral-600">{p?.session_count ?? "—"}</td>
                      <td className="px-5 py-2 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); go(); }}
                          className="px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-action-orange hover:bg-action-orange-dark transition-colors"
                        >
                          {label}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </PageShell>
  );
}
