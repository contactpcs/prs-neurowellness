"use client";

import { useEffect, useState } from "react";
import { clinicalActivityService, type ClinicalActivityEntry } from "@/lib/api/services/clinicalActivity.service";

const ACTION_LABELS: Record<string, string> = {
  protocol_created: "Treatment protocol issued",
  protocol_amended: "Treatment protocol modified",
  protocol_updated: "Draft protocol edited",
  protocol_activated: "Treatment protocol activated",
  protocol_cancelled: "Treatment protocol cancelled",
  protocol_completed: "Treatment protocol marked complete",
  prs_taken: "PRS taken",
  anamnesis_taken: "Anamnesis taken",
  device_session_run: "Device session run",
  consultation_checked_in: "Patient checked in",
  consultation_started: "Consultation started",
  consultation_completed: "Consultation completed",
};

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function title(entry: ClinicalActivityEntry): string {
  const label = ACTION_LABELS[entry.action] ?? humanize(entry.action);
  const d = entry.details;
  if (d.version) return `${label} (v${d.version})`;
  if (d.session_number) return `${label} (session ${d.session_number})`;
  return label;
}

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

/** Who did what for this patient, newest first — who took the PRS /
 * anamnesis, who ran each device session, who issued or changed each
 * protocol. The backend decides the view from the caller's role: a doctor
 * also gets protocol lifecycle steps and what each change altered; a
 * clinical assistant does not. */
export function ClinicalActivityPanel({ patientId }: { patientId: string }) {
  const [entries, setEntries] = useState<ClinicalActivityEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEntries(null);
    setError(null);
    clinicalActivityService
      .getForPatient(patientId)
      .then(setEntries)
      .catch(() => setError("Couldn't load the activity log."));
  }, [patientId]);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-neutral-900 mb-1">Activity Log</h2>
        <p className="text-neutral-600 text-sm">Who did what for this patient, and when.</p>
      </div>

      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !entries ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-neutral-200 rounded-lg">
          <p className="text-neutral-600 font-medium">No clinical activity recorded yet</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {entries.map((entry) => {
            const changes = entry.details.changes as Record<string, { from: unknown; to: unknown }> | undefined;
            return (
              <div key={`${entry.action}-${entry.entity_id}-${entry.occurred_at}`} className="border border-neutral-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{title(entry)}</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {entry.actor_name ?? "Unknown"}
                      {entry.actor_role && (
                        <span className="ml-1.5 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">{humanize(entry.actor_role)}</span>
                      )}
                    </p>
                  </div>
                  <span className="text-xs text-neutral-400 flex-shrink-0">{formatDateTime(entry.occurred_at)}</span>
                </div>
                {changes && Object.keys(changes).length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-neutral-100 pt-3">
                    {Object.entries(changes).map(([field, change]) => (
                      <li key={field} className="text-xs text-neutral-700">
                        <span className="font-medium">{humanize(field)}:</span> {show(change.from)} → {show(change.to)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
