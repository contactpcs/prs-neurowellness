"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, PlayCircle, Plus, Save } from "lucide-react";
import { DoctorPrsAssessment } from "@/components/assessment/DoctorPrsAssessment";
import { TreatmentProtocolWizard } from "@/components/doctor/TreatmentProtocolWizard";
import { versionLabel } from "@/components/doctor/TreatmentProtocolPanel";
import { usePatientNotes, usePatientPermissions } from "@/lib/hooks";
import { treatmentProtocolService } from "@/lib/api/services/treatmentProtocol.service";
import type { Permission } from "@/types/domain.types";
import type { ProtocolRead } from "@/types/treatmentProtocol.types";

// The editors the Final Report's pencil pop-up opens under "Add or edit", so
// the doctor can fill a section in place during the consultation instead of
// leaving the report for that section's own page. Each calls onDone once its
// record is saved; the report then reloads and ticks the new record.

const NOTE_CATEGORIES = ["Consultation", "Assessment Review", "Treatment Review", "Session Review", "Follow-up", "General"];

function BackLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 hover:text-neutral-800 mb-3">
      <ChevronLeft className="w-3.5 h-3.5" /> {children}
    </button>
  );
}

/** Pending PRS assignments; picking one runs the PRS wizard in place. */
export function PrsEditor({ patientId, sessionId, onDone }: { patientId: string; sessionId: string | null; onDone: () => void }) {
  const permissions = usePatientPermissions(patientId) as Permission[];
  const [running, setRunning] = useState<string | null>(null);
  const pending = permissions.filter((p) => p.status === "granted");

  if (running) {
    return (
      // AssessmentUI fills its parent — give it the dialog's height.
      <div className="h-[72vh] -mx-5 -my-4">
        <DoctorPrsAssessment
          patientId={patientId}
          permissionId={running}
          sessionId={sessionId}
          embedded
          onFinished={onDone}
          onExit={() => setRunning(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {pending.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <p className="text-sm text-neutral-500">No PRS assigned and waiting for this patient.</p>
          <Link href={`/doctor/patients/${patientId}/assign`} className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-700">
            <Plus className="w-3.5 h-3.5" /> Assign a new assessment
          </Link>
        </div>
      ) : (
        pending.map((p) => (
          <div key={p.permission_id} className="flex items-center justify-between gap-3 border border-neutral-200 rounded-lg px-3.5 py-2.5">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-neutral-800">{p.disease_name}</p>
              <p className="text-xs text-neutral-500">{p.instance_id ? "In progress" : "Not started"}</p>
            </div>
            <button
              onClick={() => setRunning(p.permission_id)}
              className="flex items-center gap-1.5 h-8 px-3 rounded-lg bg-brand-gradient text-white text-xs font-semibold flex-shrink-0"
            >
              <PlayCircle className="w-3.5 h-3.5" /> {p.instance_id ? "Continue" : "Start"}
            </button>
          </div>
        ))
      )}
    </div>
  );
}

/** A new doctor's note, same categories as the Doctor's Notes section. */
export function NoteEditor({ patientId, appointmentId, onDone }: { patientId: string; appointmentId: string | null; onDone: () => void }) {
  const { addNote } = usePatientNotes(patientId);
  const [category, setCategory] = useState(NOTE_CATEGORIES[0]);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    const text = body.trim();
    if (!text || saving) return;
    setSaving(true);
    addNote(category, text, appointmentId)
      .then(() => onDone())
      .catch(() => setError("Could not save the note. Please try again."))
      .finally(() => setSaving(false));
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-semibold text-neutral-700">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full mt-1.5 h-9 border border-neutral-200 rounded-lg px-3 text-sm bg-white outline-none focus:border-blue-400"
        >
          {NOTE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-neutral-700">Note</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder="Clinical observations, plan, and next steps…"
          className="w-full mt-1.5 border border-neutral-200 rounded-lg p-3 text-sm text-neutral-900 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 resize-y"
        />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={!body.trim() || saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-brand-gradient disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Note"}
        </button>
      </div>
    </div>
  );
}

/** Modify an active protocol or start a new one, in the protocol wizard. */
export function ProtocolEditor({ patientId, onDone }: { patientId: string; onDone: () => void }) {
  const [protocols, setProtocols] = useState<ProtocolRead[] | null>(null);
  const [wizard, setWizard] = useState<{ mode: "new" | "modify"; protocolId: string | null } | null>(null);
  const [pushed, setPushed] = useState(false);

  useEffect(() => {
    treatmentProtocolService
      .listProtocols({ patientId })
      .then(setProtocols)
      .catch(() => setProtocols([]));
  }, [patientId]);

  if (wizard) {
    return (
      <>
        {!pushed && <BackLink onClick={() => setWizard(null)}>All protocols</BackLink>}
        <TreatmentProtocolWizard
          patientId={patientId}
          mode={wizard.mode}
          priorProtocolId={wizard.protocolId}
          embedded
          onPushed={() => setPushed(true)}
          // Leaving after a push is "done"; leaving before it just goes back.
          onExit={() => (pushed ? onDone() : setWizard(null))}
        />
      </>
    );
  }

  if (!protocols) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  const active = protocols.filter((p) => p.status === "active");
  return (
    <div className="space-y-2">
      {active.map((p) => (
        <div key={p.protocol_id} className="flex items-center justify-between gap-3 border border-neutral-200 rounded-lg px-3.5 py-2.5">
          <p className="text-[13px] font-semibold text-neutral-800 min-w-0">
            {p.instance_number != null && <span className="text-neutral-500">Instance {p.instance_number} · </span>}
            {p.device_name?.trim() ?? "Protocol"} <span className="text-neutral-400 font-normal">{versionLabel(p)}</span>
          </p>
          <button
            onClick={() => setWizard({ mode: "modify", protocolId: p.protocol_id })}
            className="h-8 px-3 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-700 flex-shrink-0"
          >
            Modify
          </button>
        </div>
      ))}
      {active.length === 0 && <p className="text-sm text-neutral-500 text-center py-4">No active treatment protocol.</p>}
      <button
        onClick={() => setWizard({ mode: "new", protocolId: null })}
        className="w-full flex items-center justify-center gap-1.5 h-9 rounded-lg border border-dashed border-neutral-300 text-xs font-semibold text-primary-600 hover:bg-neutral-50"
      >
        <Plus className="w-3.5 h-3.5" /> New treatment protocol
      </button>
    </div>
  );
}
