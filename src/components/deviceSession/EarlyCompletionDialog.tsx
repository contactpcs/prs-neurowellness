"use client";

import { useState } from "react";
import { Button, Input, Modal } from "@/components/ui";

/** Shown when a CA completes a session before the 75% elapsed-duration
 * threshold. Server requires early_completion_override_reason in that case
 * (device_sessions/service.py complete()) — this collects it plus a
 * patient-stable confirmation before submitting. */
export function EarlyCompletionDialog({
  isOpen,
  onClose,
  onConfirm,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [patientStable, setPatientStable] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => { setReason(""); setPatientStable(false); };
  const handleClose = () => { reset(); onClose(); };

  const handleConfirm = async () => {
    if (!reason.trim() || !patientStable) return;
    setSaving(true);
    try {
      await onConfirm(reason.trim());
      reset();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Complete Session Early">
      <div className="space-y-4">
        <p className="text-sm text-neutral-500">
          This session is under 75% of its prescribed duration. Completing now requires a reason and
          confirmation that the patient is stable.
        </p>

        <Input
          label="Reason for early completion"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Patient requested to stop, no adverse signs"
        />

        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={patientStable}
            onChange={(e) => setPatientStable(e.target.checked)}
            className="rounded border-neutral-300"
          />
          I confirm the patient is stable
        </label>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button variant="primary" onClick={handleConfirm} isLoading={saving} disabled={!reason.trim() || !patientStable}>
            Complete Session
          </Button>
        </div>
      </div>
    </Modal>
  );
}
