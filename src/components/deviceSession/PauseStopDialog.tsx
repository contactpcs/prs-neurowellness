"use client";

import { useState } from "react";
import { Button, Input, Modal } from "@/components/ui";
import type { PauseStopReason } from "@/types/deviceSession.types";

const REASONS: { value: PauseStopReason; label: string }[] = [
  { value: "patient_discomfort", label: "Patient experiencing discomfort" },
  { value: "adverse_event", label: "Adverse event recorded" },
  { value: "device_setup_issue", label: "Device set-up issue" },
  { value: "device_glitch", label: "Device-related glitch" },
  { value: "power_outage", label: "Power outage at clinic" },
  { value: "other", label: "Other" },
];

/** Shared modal for Pause and Stop — same reason vocabulary, different
 * copy/CTA per mode. Pause holds the timer and can be resumed; Stop ramps
 * down immediately and ends the session early (terminal). */
export function PauseStopDialog({
  mode,
  isOpen,
  onClose,
  onConfirm,
}: {
  mode: "pause" | "stop";
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: PauseStopReason, detail?: string) => Promise<void>;
}) {
  const [reason, setReason] = useState<PauseStopReason | null>(null);
  const [detail, setDetail] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => { setReason(null); setDetail(""); };
  const handleClose = () => { reset(); onClose(); };

  const handleConfirm = async () => {
    if (!reason) return;
    setSaving(true);
    try {
      await onConfirm(reason, detail || undefined);
      reset();
    } finally {
      setSaving(false);
    }
  };

  const needsDetail = reason === "patient_discomfort" || reason === "other";

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={mode === "pause" ? "Pause Session" : "Stop Session"}>
      <div className="space-y-4">
        <p className="text-sm text-neutral-500">
          {mode === "pause"
            ? "Stimulation is held and the timer freezes. You can resume later."
            : "Stimulation ramps down immediately and the session ends early."}
        </p>

        <div className="space-y-1.5">
          {REASONS.map((r) => (
            <button
              key={r.value}
              onClick={() => setReason(r.value)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                reason === r.value ? "bg-primary-50 border-primary-400 text-primary-800" : "border-neutral-200 hover:bg-neutral-50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {needsDetail && (
          <Input
            label={reason === "patient_discomfort" ? "What discomfort is the patient experiencing?" : "Describe the reason"}
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
          />
        )}

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button variant={mode === "stop" ? "danger" : "primary"} onClick={handleConfirm} isLoading={saving} disabled={!reason}>
            {mode === "pause" ? "Pause Session" : "Stop Session"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
