"use client";

import { useEffect, useRef, useState } from "react";
import { Edit2, Check, X, AlertCircle } from "lucide-react";
import { Card, CardContent, PageLoader } from "@/components/ui";
import { usersService } from "@/lib/api/services/users.service";
import { useAppDispatch } from "@/store/hooks";
import { updateUserInStore } from "@/store/slices/authSlice";

// ─── helpers ──────────────────────────────────────────────────────

function computeAge(dob?: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) age--;
  return age;
}

function buildDiff(
  current: Record<string, string>,
  original: Record<string, string>,
): Record<string, string | number> {
  const diff: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(current)) {
    if (v !== (original[k] ?? "")) {
      diff[k] = k === "years_of_experience" ? Number(v) || 0 : v;
    }
  }
  return diff;
}

const EMPTY_FORM = {
  first_name: "", last_name: "",
  date_of_birth: "", gender: "",
  government_id: "", id_type: "", language_pref: "",
  address_line1: "", city: "", state: "", country: "", pincode: "",
  specialisation: "", hospital: "", years_of_experience: "",
};
type FormState = typeof EMPTY_FORM;

const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-neutral-400";
const labelCls = "text-xs text-neutral-500 uppercase font-semibold tracking-wide";

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className={labelCls}>{label}</p>
      <p className="text-sm text-neutral-700 mt-1">{value || "Not provided"}</p>
    </div>
  );
}

// ─── component ────────────────────────────────────────────────────

export default function DoctorProfilePage() {
  const dispatch = useAppDispatch();

  const [profileRaw, setProfileRaw] = useState<Record<string, unknown> | null>(null);
  const [fetchError, setFetchError]   = useState<string | null>(null);
  const [isEditing, setIsEditing]     = useState(false);
  const [isSaving,  setIsSaving]      = useState(false);
  const [saveError, setSaveError]     = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const originalRef = useRef<FormState>(EMPTY_FORM);

  // ── pre-fill on mount ─────────────────────────────────────────────

  useEffect(() => {
    usersService.getProfile()
      .then((data) => {
        setProfileRaw(data as unknown as Record<string, unknown>);
        const filled: FormState = {
          first_name:          (data.first_name        as string) ?? "",
          last_name:           (data.last_name         as string) ?? "",
          date_of_birth:       (data.date_of_birth     as string) ?? "",
          gender:              (data.gender            as string) ?? "",
          government_id:       (data.government_id     as string) ?? "",
          id_type:             (data.id_type           as string) ?? "",
          language_pref:       ((data.language_pref ?? data.primary_language) as string) ?? "",
          address_line1:       (data.address_line1     as string) ?? "",
          city:                (data.city              as string) ?? "",
          state:               (data.state             as string) ?? "",
          country:             (data.country           as string) ?? "",
          pincode:             (data.pincode           as string) ?? "",
          specialisation:      (data.specialisation    as string) ?? "",
          hospital:            (data.hospital          as string) ?? "",
          years_of_experience: String(data.years_of_experience ?? ""),
        };
        setForm(filled);
        originalRef.current = filled;
      })
      .catch(() => setFetchError("Failed to load profile"));
  }, []);

  // ── handlers ─────────────────────────────────────────────────────

  const set = (field: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    const diff = buildDiff(form, originalRef.current);
    if (!Object.keys(diff).length) { setIsEditing(false); return; }

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const updated = await usersService.updateProfile(diff);
      const freshFilled: FormState = {
        first_name:          (updated.first_name        as string) ?? "",
        last_name:           (updated.last_name         as string) ?? "",
        date_of_birth:       (updated.date_of_birth     as string) ?? "",
        gender:              (updated.gender            as string) ?? "",
        government_id:       (updated.government_id     as string) ?? "",
        id_type:             (updated.id_type           as string) ?? "",
        language_pref:       ((updated.language_pref ?? updated.primary_language) as string) ?? "",
        address_line1:       (updated.address_line1     as string) ?? "",
        city:                (updated.city              as string) ?? "",
        state:               (updated.state             as string) ?? "",
        country:             (updated.country           as string) ?? "",
        pincode:             (updated.pincode           as string) ?? "",
        specialisation:      (updated.specialisation    as string) ?? "",
        hospital:            (updated.hospital          as string) ?? "",
        years_of_experience: String(updated.years_of_experience ?? ""),
      };
      setForm(freshFilled);
      originalRef.current = freshFilled;
      setProfileRaw(updated as unknown as Record<string, unknown>);
      dispatch(updateUserInStore({
        first_name:     updated.first_name,
        last_name:      updated.last_name,
        full_name:      updated.full_name,
        specialisation: updated.specialisation,
        city:           updated.city,
        gender:         updated.gender,
        date_of_birth:  updated.date_of_birth,
      }));
      setSaveSuccess(true);
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save profile");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setForm(originalRef.current);
    setSaveError(null);
    setIsEditing(false);
  };

  if (!profileRaw && !fetchError) return <PageLoader />;

  const age = computeAge(form.date_of_birth);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Profile Settings</h1>
        <div className="flex items-center gap-3">
          {saveSuccess && !isEditing && (
            <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
              <Check className="w-4 h-4" /> Saved
            </span>
          )}
          {!isEditing && (
            <button
              onClick={() => { setSaveSuccess(false); setIsEditing(true); }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors text-sm font-medium"
            >
              <Edit2 className="w-4 h-4" /> Edit Profile
            </button>
          )}
        </div>
      </div>

      {fetchError && (
        <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {fetchError}
        </div>
      )}

      {/* ── Basic Information ── */}
      <Card>
        <div className="px-6 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">Basic Information</h2>
        </div>
        <CardContent className="space-y-4 pt-4">
          {isEditing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={`${labelCls} block mb-1.5`}>First Name</label>
                <input className={inputCls} value={form.first_name}
                  onChange={(e) => set("first_name", e.target.value)} />
              </div>
              <div>
                <label className={`${labelCls} block mb-1.5`}>Last Name</label>
                <input className={inputCls} value={form.last_name}
                  onChange={(e) => set("last_name", e.target.value)} />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="First Name" value={form.first_name} />
              <Field label="Last Name"  value={form.last_name}  />
            </div>
          )}
          <Field label="Email" value={profileRaw?.email as string} />
          <div>
            <p className={labelCls}>Phone</p>
            <p className="text-sm text-neutral-700 mt-1">
              {(profileRaw?.phone as string) || "Not provided"}
              <span className="text-xs text-neutral-400 ml-2">Contact support to change</span>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Personal Details ── */}
      <Card>
        <div className="px-6 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">Personal Details</h2>
        </div>
        <CardContent className="space-y-4 pt-4">
          {isEditing ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`${labelCls} block mb-1.5`}>Date of Birth</label>
                  <input type="date" className={inputCls} value={form.date_of_birth}
                    onChange={(e) => set("date_of_birth", e.target.value)} />
                </div>
                <div>
                  <label className={`${labelCls} block mb-1.5`}>Gender</label>
                  <select className={inputCls} value={form.gender}
                    onChange={(e) => set("gender", e.target.value)}>
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`${labelCls} block mb-1.5`}>ID Type</label>
                  <select className={inputCls} value={form.id_type}
                    onChange={(e) => set("id_type", e.target.value)}>
                    <option value="">Select</option>
                    <option value="aadhar">Aadhar</option>
                    <option value="pan">PAN</option>
                    <option value="passport">Passport</option>
                    <option value="voter_id">Voter ID</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className={`${labelCls} block mb-1.5`}>Government ID</label>
                  <input className={inputCls} value={form.government_id}
                    onChange={(e) => set("government_id", e.target.value)} />
                </div>
              </div>
              <div>
                <label className={`${labelCls} block mb-1.5`}>Language Preference</label>
                <select className={inputCls} value={form.language_pref}
                  onChange={(e) => set("language_pref", e.target.value)}>
                  <option value="">Select</option>
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="te">Telugu</option>
                  <option value="ta">Tamil</option>
                  <option value="mr">Marathi</option>
                  <option value="kn">Kannada</option>
                  <option value="ml">Malayalam</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className={labelCls}>Date of Birth</p>
                  <p className="text-sm text-neutral-700 mt-1">
                    {form.date_of_birth || "Not provided"}
                    {age !== null && <span className="text-neutral-400 ml-2">({age} yrs)</span>}
                  </p>
                </div>
                <Field label="Gender" value={form.gender} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="ID Type"       value={form.id_type} />
                <Field label="Government ID" value={form.government_id} />
              </div>
              <Field label="Language Preference" value={form.language_pref} />
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Contact & Location ── */}
      <Card>
        <div className="px-6 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">Contact & Location</h2>
        </div>
        <CardContent className="space-y-4 pt-4">
          {isEditing ? (
            <>
              <div>
                <label className={`${labelCls} block mb-1.5`}>Address Line 1</label>
                <input className={inputCls} value={form.address_line1}
                  onChange={(e) => set("address_line1", e.target.value)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`${labelCls} block mb-1.5`}>City</label>
                  <input className={inputCls} value={form.city}
                    onChange={(e) => set("city", e.target.value)} />
                </div>
                <div>
                  <label className={`${labelCls} block mb-1.5`}>State</label>
                  <input className={inputCls} value={form.state}
                    onChange={(e) => set("state", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`${labelCls} block mb-1.5`}>Country</label>
                  <input className={inputCls} value={form.country}
                    onChange={(e) => set("country", e.target.value)} />
                </div>
                <div>
                  <label className={`${labelCls} block mb-1.5`}>Pincode</label>
                  <input className={inputCls} value={form.pincode}
                    onChange={(e) => set("pincode", e.target.value)} />
                </div>
              </div>
            </>
          ) : (
            <>
              <Field label="Address" value={form.address_line1} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="City"    value={form.city}    />
                <Field label="State"   value={form.state}   />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Country" value={form.country} />
                <Field label="Pincode" value={form.pincode} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Professional (doctor-only) ── */}
      <Card>
        <div className="px-6 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">Professional Information</h2>
        </div>
        <CardContent className="space-y-4 pt-4">
          {isEditing ? (
            <>
              <div>
                <label className={`${labelCls} block mb-1.5`}>Specialisation</label>
                <input className={inputCls} value={form.specialisation}
                  placeholder="e.g. Psychiatry, Neurology…"
                  onChange={(e) => set("specialisation", e.target.value)} />
              </div>
              <div>
                <label className={`${labelCls} block mb-1.5`}>Hospital / Clinic</label>
                <input className={inputCls} value={form.hospital}
                  onChange={(e) => set("hospital", e.target.value)} />
              </div>
              <div>
                <label className={`${labelCls} block mb-1.5`}>Years of Experience</label>
                <input type="number" min="0" max="60" className={inputCls}
                  value={form.years_of_experience}
                  onChange={(e) => set("years_of_experience", e.target.value)} />
              </div>
            </>
          ) : (
            <>
              <Field label="Specialisation"      value={form.specialisation} />
              <Field label="Hospital / Clinic"   value={form.hospital} />
              <Field label="Years of Experience" value={form.years_of_experience} />
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Save / Cancel ── */}
      {isEditing && (
        <div className="sticky bottom-0 bg-white pt-4 space-y-3">
          {saveError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {saveError}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
              <Check className="w-4 h-4" />
              {isSaving ? "Saving…" : "Save Changes"}
            </button>
            <button onClick={handleCancel} disabled={isSaving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-neutral-100 text-neutral-700 font-medium text-sm hover:bg-neutral-200 disabled:opacity-50 transition-colors">
              <X className="w-4 h-4" /> Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
