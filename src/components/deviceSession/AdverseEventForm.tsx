"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button, Input } from "@/components/ui";
import type { AdverseEventType, Severity } from "@/types/deviceSession.types";

const EVENT_TYPES: { value: AdverseEventType; label: string }[] = [
  { value: "sharp_burning_pain", label: "Sharp / burning pain" },
  { value: "skin_burn_lesion", label: "Skin burn / lesion" },
  { value: "dizziness", label: "Dizziness" },
  { value: "severe_headache", label: "Severe headache" },
  { value: "nausea_vomiting", label: "Nausea / vomiting" },
  { value: "other", label: "Other" },
];

const SEVERITIES: { value: Severity; label: string }[] = [
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
];

/** Records one adverse event. A non-mild severity is the cue (surfaced by
 * the caller, not this form) to consider pausing/stopping and notifying the
 * doctor — see the live-session screen's banner logic. */
export function AdverseEventForm({
  onRecord,
  onCancel,
}: {
  onRecord: (body: { event_type: AdverseEventType; severity: Severity; description: string; action_taken?: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [eventType, setEventType] = useState<AdverseEventType | null>(null);
  const [severity, setSeverity] = useState<Severity | null>(null);
  const [description, setDescription] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave = eventType && severity && description.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || !eventType || !severity) return;
    setSaving(true);
    try {
      await onRecord({ event_type: eventType, severity, description: description.trim(), action_taken: actionTaken || undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-danger-200 bg-danger-50/40 p-4 space-y-3">
      <div className="flex items-center gap-2 text-danger-700 text-sm font-semibold">
        <AlertTriangle className="h-4 w-4" /> Record Adverse Event
      </div>

      <div className="flex flex-wrap gap-2">
        {EVENT_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => setEventType(t.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              eventType === t.value ? "bg-danger-500 border-danger-500 text-white" : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

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

      <Input label="Description" placeholder="What happened" value={description} onChange={(e) => setDescription(e.target.value)} />
      <Input label="Action taken (optional)" value={actionTaken} onChange={(e) => setActionTaken(e.target.value)} />

      <div className="flex gap-2">
        <Button size="sm" variant="danger" onClick={handleSave} isLoading={saving} disabled={!canSave}>Save adverse event</Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}
