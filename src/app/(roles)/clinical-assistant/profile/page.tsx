"use client";

import { useEffect, useRef, useState } from "react";
import { User, Check, X, AlertCircle, Edit2 } from "lucide-react";
import { PageLoader } from "@/components/ui";
import { clinicalAssistantService } from "@/lib/api/services/clinicalAssistant.service";

// ─── helpers ──────────────────────────────────────────────────────

function buildDiff(
  current: Record<string, string>,
  original: Record<string, string>,
): Record<string, string> {
  const diff: Record<string, string> = {};
  for (const [k, v] of Object.entries(current)) {
    if (v !== (original[k] ?? "")) diff[k] = v;
  }
  return diff;
}

const EMPTY_FORM = {
  first_name: "", last_name: "", phone: "",
  date_of_birth: "", gender: "", language_pref: "",
  address_line1: "", city: "", state: "", country: "", pincode: "",
};
type FormState = typeof EMPTY_FORM;

// ─── styles — same brand as doctor/patient profile pages ───────────

const BRAND = "linear-gradient(135deg, #00A1E4 0%, #09172E 100%)";
const BRAND_PX = "#00A1E4";
const inputCls =
  "w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-all focus:outline-none focus:ring-2 focus:border-sky-400 hover:border-neutral-300";
const labelCls = "text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1.5 block";

function FieldInput({
  label, value, onChange, type = "text", placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        type={type}
        className={inputCls}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// read-only display row (label → value table style)
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-center justify-between py-2.5 gap-4">
      <span className="text-sm text-neutral-400 flex-shrink-0 w-36">{label}:</span>
      <span className="text-sm font-semibold text-neutral-900 text-right truncate">{value || "—"}</span>
    </div>
  );
}

// ─── component ────────────────────────────────────────────────────

export default function ClinicalAssistantProfilePage() {
  const [profileRaw, setProfileRaw] = useState<Record<string, unknown> | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [isEditing,  setIsEditing]  = useState(false);
  const [isSaving,   setIsSaving]   = useState(false);
  const [saveError,  setSaveError]  = useState<string | null>(null);
  const [saveSuccess,setSaveSuccess]= useState(false);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const originalRef     = useRef<FormState>(EMPTY_FORM);

  useEffect(() => {
    clinicalAssistantService.getMyProfile()
      .then((data) => {
        setProfileRaw(data);
        const [first, ...rest] = String(data.full_name ?? "").trim().split(/\s+/);
        const filled: FormState = {
          first_name:    (data.first_name    as string) ?? first ?? "",
          last_name:     (data.last_name     as string) ?? rest.join(" ") ?? "",
          phone:         (data.phone         as string) ?? "",
          date_of_birth: (data.dob           as string) ?? "",
          gender:        (data.gender        as string) ?? "",
          language_pref: (data.language_pref as string) ?? "",
          address_line1: (data.address       as string) ?? "",
          city:          (data.city          as string) ?? "",
          state:         (data.state         as string) ?? "",
          country:       (data.country       as string) ?? "",
          pincode:       (data.pincode       as string) ?? "",
        };
        setForm(filled);
        originalRef.current = filled;
      })
      .catch(() => setFetchError("Failed to load profile"));
  }, []);

  const set = (field: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    const diff = buildDiff(form, originalRef.current);
    if (!Object.keys(diff).length) { setIsEditing(false); return; }
    setIsSaving(true); setSaveError(null); setSaveSuccess(false);
    try {
      // Backend field names differ from this form's (dob, address) —
      // mapped here rather than in the service, same reasoning as
      // doctors.service.ts's updateMyProfile.
      const payload: Record<string, unknown> = { ...diff };
      if ("date_of_birth" in diff) { payload.dob = diff.date_of_birth; delete payload.date_of_birth; }
      if ("address_line1" in diff) { payload.address = diff.address_line1; delete payload.address_line1; }

      const updated = await clinicalAssistantService.updateMyProfile(payload);
      const [first, ...rest] = String(updated.full_name ?? "").trim().split(/\s+/);
      const freshFilled: FormState = {
        first_name:    (updated.first_name    as string) ?? first ?? "",
        last_name:     (updated.last_name     as string) ?? rest.join(" ") ?? "",
        phone:         (updated.phone         as string) ?? "",
        date_of_birth: (updated.dob           as string) ?? "",
        gender:        (updated.gender        as string) ?? "",
        language_pref: (updated.language_pref as string) ?? "",
        address_line1: (updated.address       as string) ?? "",
        city:          (updated.city          as string) ?? "",
        state:         (updated.state         as string) ?? "",
        country:       (updated.country       as string) ?? "",
        pincode:       (updated.pincode       as string) ?? "",
      };
      setForm(freshFilled); originalRef.current = freshFilled;
      setProfileRaw(updated);
      setSaveSuccess(true); setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save profile");
    } finally { setIsSaving(false); }
  };

  const handleCancel = () => { setForm(originalRef.current); setSaveError(null); setIsEditing(false); };

  if (!profileRaw && !fetchError) return <PageLoader />;

  const fullName = `${form.first_name} ${form.last_name}`.trim() || "—";
  const email    = (profileRaw?.email as string) ?? "—";
  const clinic   = (profileRaw?.clinic as string) ?? null;
  const isActive = (profileRaw?.is_active as boolean) ?? true;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header card — same gradient/layout as doctor & patient profile pages */}
      <div className="rounded-2xl border border-neutral-200 bg-gradient-to-br from-sky-50 via-blue-50/40 to-sky-50 p-6 border-l-4" style={{ borderLeftColor: BRAND_PX }}>
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: BRAND }}>
            <User className="w-8 h-8 text-white" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold text-neutral-900 leading-tight">{fullName}</h1>
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${isActive ? "bg-success-50 text-success-700" : "bg-neutral-100 text-neutral-500"}`}>
                {isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="text-sm text-neutral-500 mt-0.5">Clinical Assistant{clinic ? ` · ${clinic}` : ""}</p>
          </div>
        </div>
      </div>

      {/* Personal & Contact Details */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-6">
          <h2 className="text-base font-bold text-neutral-900">Personal &amp; Contact Details</h2>
          {!isEditing && (
            <button onClick={() => { setSaveSuccess(false); setIsEditing(true); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              style={{ background: BRAND }}>
              <Edit2 className="w-3.5 h-3.5" /> Edit Profile
            </button>
          )}
        </div>

        <div className="p-6">
          {fetchError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm mb-5">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {fetchError}
            </div>
          )}

          {isEditing ? (
            <div className="space-y-3 max-w-xl">
              <div className="grid grid-cols-2 gap-3">
                <FieldInput label="First Name" value={form.first_name} onChange={(v) => set("first_name", v)} />
                <FieldInput label="Last Name"  value={form.last_name}  onChange={(v) => set("last_name", v)} />
              </div>
              <FieldInput label="Phone" value={form.phone} onChange={(v) => set("phone", v)} />
              <FieldInput label="Date of Birth" value={form.date_of_birth} onChange={(v) => set("date_of_birth", v)} type="date" />
              <div>
                <label className={labelCls}>Gender</label>
                <select className={inputCls} value={form.gender} onChange={(e) => set("gender", e.target.value)}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <FieldInput label="Address" value={form.address_line1} onChange={(v) => set("address_line1", v)} placeholder="Street address" />
              <div className="grid grid-cols-2 gap-3">
                <FieldInput label="City"  value={form.city}  onChange={(v) => set("city", v)} />
                <FieldInput label="State" value={form.state} onChange={(v) => set("state", v)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FieldInput label="Country" value={form.country} onChange={(v) => set("country", v)} />
                <FieldInput label="Pincode" value={form.pincode} onChange={(v) => set("pincode", v)} />
              </div>
              <FieldInput label="Language Preference" value={form.language_pref} onChange={(v) => set("language_pref", v)} placeholder="e.g. en, hi" />

              {saveError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {saveError}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={handleSave} disabled={isSaving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
                  style={{ background: BRAND }}>
                  <Check className="w-3.5 h-3.5" /> {isSaving ? "Saving…" : "Save"}
                </button>
                <button onClick={handleCancel} disabled={isSaving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-neutral-100 text-neutral-700 text-sm font-semibold hover:bg-neutral-200 disabled:opacity-50 transition-colors">
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-0 divide-y divide-neutral-100 max-w-xl">
                <InfoRow label="Email"    value={email} />
                <InfoRow label="Phone"    value={form.phone} />
                <InfoRow label="Date of Birth" value={form.date_of_birth} />
                <InfoRow label="Gender"   value={form.gender} />
                <InfoRow label="Address"  value={form.address_line1} />
                <InfoRow label="City"     value={form.city} />
                <InfoRow label="State"    value={form.state} />
                <InfoRow label="Country"  value={form.country} />
                <InfoRow label="Pincode"  value={form.pincode} />
                <InfoRow label="Language" value={form.language_pref?.toUpperCase()} />
              </div>
              {saveSuccess && (
                <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium mt-4">
                  <Check className="w-4 h-4" /> Saved
                </span>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
