"use client";

import { useState } from "react";
import { Button, Input } from "@/components/ui";
import type { Symptom, Severity } from "@/types/deviceSession.types";

const SYMPTOMS: { value: Symptom; label: string }[] = [
  { value: "tingling", label: "Tingling" },
  { value: "itching", label: "Itching" },
  { value: "burning", label: "Burning" },
  { value: "headache", label: "Headache" },
  { value: "fatigue", label: "Fatigue" },
  { value: "sleepiness", label: "Sleepiness" },
  { value: "dizziness", label: "Dizziness" },
  { value: "skin_redness", label: "Skin redness" },
  { value: "nausea", label: "Nausea" },
  { value: "other", label: "Other" },
];

const SEVERITIES: { value: Severity; label: string }[] = [
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
];

/** Tap a symptom, pick a severity, optionally add a note, log it. Each
 * confirmed entry is its own POST (device_session_symptoms is append-only)
 * so this component doesn't hold a running list itself — the caller re-reads
 * session.symptoms after each record for the log view. */
export function SymptomChipSelector({
  onRecord,
}: {
  onRecord: (symptom: Symptom, severity: Severity, note?: string) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Symptom | null>(null);
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setSelected(null); setSeverity(null); setNote(""); };

  const handleSave = async () => {
    if (!selected || !severity) return;
    setSaving(true);
    try {
      await onRecord(selected, severity, note || undefined);
      reset();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {SYMPTOMS.map((s) => (
          <button
            key={s.value}
            onClick={() => setSelected(s.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              selected === s.value
                ? "bg-primary-100 border-primary-400 text-primary-800"
                : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {selected && (
        <div className="space-y-2 pl-1">
          <div className="flex gap-2">
            {SEVERITIES.map((sv) => (
              <button
                key={sv.value}
                onClick={() => setSeverity(sv.value)}
                className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                  severity === sv.value
                    ? sv.value === "severe" ? "bg-danger-500 border-danger-500 text-white"
                      : sv.value === "moderate" ? "bg-amber-500 border-amber-500 text-white"
                      : "bg-neutral-600 border-neutral-600 text-white"
                    : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300"
                }`}
              >
                {sv.label}
              </button>
            ))}
          </div>
          <Input placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} isLoading={saving} disabled={!severity}>Log symptom</Button>
            <Button size="sm" variant="ghost" onClick={reset}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
