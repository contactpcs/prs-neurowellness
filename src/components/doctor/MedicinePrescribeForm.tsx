"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui";
import { useAppDispatch } from "@/store/hooks";
import { prescribeMedicine, type PrescribedMedicineForm } from "@/store/slices/prescribedMedicineSlice";

export const MEDICINE_TIMINGS = ["Morning", "Afternoon", "Evening", "Night", "Twice daily", "Three times daily", "As needed"];
export const MEDICINE_MEALS = ["Before meal", "After meal", "With meal", "Empty stomach", "Not applicable"];

const emptyForm = (): PrescribedMedicineForm => ({ name: "", dose: "", timing: MEDICINE_TIMINGS[0], meal: MEDICINE_MEALS[1], duration: "", note: "" });

const inputCls = "w-full mt-1.5 h-9 border border-neutral-200 rounded-lg px-3 text-sm bg-white outline-none focus:border-blue-400";

/** The prescribe form of the Prescribed Medicine section — also used by the
 * Final Report's edit pop-up. Key it by patient so it resets on a switch. */
export function MedicinePrescribeForm({
  patientId,
  appointmentId,
  onSaved,
}: {
  patientId: string;
  appointmentId: string | null;
  onSaved?: () => void;
}) {
  const dispatch = useAppDispatch();
  const [form, setForm] = useState<PrescribedMedicineForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    const result = await dispatch(prescribeMedicine({ patientId, medicine: form, appointmentId }));
    setSaving(false);
    if (prescribeMedicine.fulfilled.match(result)) {
      setForm(emptyForm());
      onSaved?.();
    } else {
      setError(result.error?.message || "Could not save the prescription. Please try again.");
    }
  };

  return (
    <div className="border border-blue-100 bg-blue-50/50 rounded-lg p-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="text-xs font-semibold text-neutral-700">Medicine name *</label>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Escitalopram 10 mg" className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-semibold text-neutral-700">Dose</label>
          <input value={form.dose} onChange={(e) => setForm((f) => ({ ...f, dose: e.target.value }))} placeholder="e.g. 1 tablet" className={inputCls} />
        </div>
        <div>
          <label className="text-xs font-semibold text-neutral-700">Timing</label>
          <select value={form.timing} onChange={(e) => setForm((f) => ({ ...f, timing: e.target.value }))} className={inputCls}>
            {MEDICINE_TIMINGS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-neutral-700">Meal instruction</label>
          <select value={form.meal} onChange={(e) => setForm((f) => ({ ...f, meal: e.target.value }))} className={inputCls}>
            {MEDICINE_MEALS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-neutral-700">Duration</label>
          <input value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))} placeholder="e.g. 8 weeks" className={inputCls} />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-neutral-700">Note</label>
        <input value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} placeholder="Optional prescribing note" className={inputCls} />
      </div>
      <Button size="sm" variant="primary" disabled={!form.name.trim() || saving} onClick={save}>
        <Save className="h-4 w-4" /> Save Prescription
      </Button>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
