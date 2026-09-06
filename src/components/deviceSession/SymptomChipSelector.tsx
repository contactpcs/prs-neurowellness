"use client";

import { useState } from "react";
import {
  Sparkles, Zap, Flame, HeartPulse, BatteryLow, Moon, Waves, Flower2, CircleAlert, MoreHorizontal,
} from "lucide-react";
import { Button, Input } from "@/components/ui";
import type { Symptom, Severity } from "@/types/deviceSession.types";

const SYMPTOMS: { value: Symptom; label: string; icon: typeof Sparkles }[] = [
  { value: "tingling", label: "Tingling", icon: Sparkles },
  { value: "itching", label: "Itching", icon: Waves },
  { value: "burning", label: "Burning", icon: Flame },
  { value: "headache", label: "Headache", icon: HeartPulse },
  { value: "fatigue", label: "Fatigue", icon: BatteryLow },
  { value: "sleepiness", label: "Sleepiness", icon: Moon },
  { value: "dizziness", label: "Dizziness", icon: Zap },
  { value: "skin_redness", label: "Skin redness", icon: Flower2 },
  { value: "nausea", label: "Nausea", icon: CircleAlert },
  { value: "other", label: "Other", icon: MoreHorizontal },
];

const SEVERITIES: { value: Severity; label: string; dot: string; active: string }[] = [
  { value: "mild", label: "Mild", dot: "bg-neutral-400", active: "bg-neutral-700 border-neutral-700 text-white" },
  { value: "moderate", label: "Moderate", dot: "bg-amber-400", active: "bg-amber-500 border-amber-500 text-white" },
  { value: "severe", label: "Severe", dot: "bg-danger-400", active: "bg-danger-500 border-danger-500 text-white" },
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

  const selectedMeta = SYMPTOMS.find((s) => s.value === selected);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2.5">What is the patient experiencing?</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SYMPTOMS.map((s) => {
            const Icon = s.icon;
            const isActive = selected === s.value;
            return (
              <button
                key={s.value}
                onClick={() => setSelected(s.value)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary-50 border-primary-400 text-primary-800 ring-1 ring-primary-400"
                    : "bg-white border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-primary-600" : "text-neutral-400"}`} />
                <span className="truncate">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {selected && (
        <div className="space-y-3 pt-3 border-t border-neutral-100">
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
              How severe — {selectedMeta?.label.toLowerCase()}
            </p>
            <div className="flex gap-2">
              {SEVERITIES.map((sv) => {
                const isActive = severity === sv.value;
                return (
                  <button
                    key={sv.value}
                    onClick={() => setSeverity(sv.value)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      isActive ? sv.active : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-white" : sv.dot}`} />
                    {sv.label}
                  </button>
                );
              })}
            </div>
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
