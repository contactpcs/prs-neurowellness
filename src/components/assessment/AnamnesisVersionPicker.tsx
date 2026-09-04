"use client";

import { Loader2 } from "lucide-react";
import type { AnamnesisRecord } from "@/types/domain.types";

function fmtDate(iso: string | null) {
  if (!iso) return "In progress";
  return new Date(iso).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

function fmtTakenBy(takenBy: string) {
  if (takenBy === "doctor_on_behalf") return "Doctor";
  if (takenBy === "patient") return "Patient";
  return takenBy;
}

/** Tab strip over an anamnesis's version history — each edit
 * (AnamnesisForm's handleStartOnBehalf) creates a new version rather than
 * overwriting the one being edited, so every prior version stays on record.
 * Selecting one loads it read-only; the current/latest version is where
 * editing continues from. */
export function AnamnesisVersionPicker({
  versions,
  selectedId,
  onSelect,
  loading,
}: {
  versions: AnamnesisRecord[];
  selectedId: string | null;
  onSelect: (anamnesisId: string) => void;
  loading?: boolean;
}) {
  // Newest first by date, not insertion order — version numbers already
  // increase monotonically with time so this is normally a no-op, but the
  // date is the field the picker actually reads out loud to the doctor, so
  // sort by it directly instead of trusting version to stay in lockstep.
  const sorted = versions.slice().sort((a, b) => {
    const ad = a.completed_at ?? a.created_at ?? "";
    const bd = b.completed_at ?? b.created_at ?? "";
    return bd.localeCompare(ad);
  });

  return (
    <div className="mb-4 flex items-center gap-1.5 overflow-x-auto pb-1">
      {sorted.map((v) => {
        const active = v.anamnesis_id === selectedId;
        return (
          <button
            key={v.anamnesis_id}
            onClick={() => onSelect(v.anamnesis_id)}
            className={`flex-shrink-0 px-3 py-2 rounded-lg text-left transition-colors border ${
              active
                ? "bg-orange-50 border-orange-300 text-orange-800"
                : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300"
            }`}
          >
            <p className="text-xs font-bold leading-tight">
              v{v.version ?? "?"}
              {active && loading && <Loader2 className="inline-block w-3 h-3 ml-1.5 animate-spin" />}
            </p>
            <p className="text-[11px] leading-tight mt-0.5 opacity-80">
              {fmtDate(v.completed_at)} · {fmtTakenBy(v.taken_by)}
            </p>
          </button>
        );
      })}
    </div>
  );
}
