"use client";

import { Fragment, useEffect, useState } from "react";
import { X, Check, Smartphone, Mail, ShieldCheck, Loader2, MapPin, Send } from "lucide-react";
import { receptionService, type GuardianReason } from "@/lib/api/services/reception.service";
import { useClinics, usePincodeLookup, useGeolocationAddress } from "@/lib/hooks";
import { Input } from "@/components/ui";
import { GUARDIAN_RELATION_OPTIONS, ageFromDob, isMinor } from "@/lib/utils/guardian";
import { MOBILE_ERROR, isValidMobile, toMobileDigits } from "@/lib/utils/phone";
import type { PatientListItem } from "@/types/domain.types";

// No password and no consent here (Documents/design_consent_v2.md): Cognito
// sends the patient a temporary password on their own phone/email, and the
// patient (or guardian) signs consent in their own session.
const STEP_LABELS = ["Method", "Details", "Review", "Sent"] as const;
type Step = 1 | 2 | 3 | 4;

const COUNTRY_CODES = [
  { code: "+91", label: "India (+91)" },
  { code: "+1", label: "USA (+1)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+971", label: "UAE (+971)" },
];

const GUARDIAN_REASON_OPTIONS: { value: GuardianReason; label: string }[] = [
  { value: "lacks_capacity", label: "Patient cannot consent for themselves" },
  { value: "lawful_guardian", label: "Court-appointed / lawful guardian" },
  { value: "nominated_representative", label: "Nominated representative (Mental Healthcare Act)" },
];

function Stepper({ current }: { current: Step }) {
  return (
    <div className="flex items-start px-6 pt-4 pb-3 border-b border-neutral-100 flex-shrink-0">
      {STEP_LABELS.map((label, i) => {
        const idx = (i + 1) as Step;
        const done = idx < current;
        const active = idx === current;
        return (
          <Fragment key={label}>
            <div className="flex flex-col items-center flex-shrink-0 w-16">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold transition-colors ${
                  done ? "bg-green-500 text-white" : active ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-400"
                }`}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : idx}
              </span>
              <span className={`text-[11px] mt-1.5 text-center leading-tight ${active ? "text-neutral-900 font-semibold" : done ? "text-neutral-600" : "text-neutral-400"}`}>
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <span className={`h-0.5 flex-1 mt-3.5 min-w-[0.5rem] transition-colors ${done ? "bg-green-500" : "bg-neutral-200"}`} />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

interface FormState {
  channel: "phone" | "email" | null;
  firstName: string;
  lastName: string;
  gender: string;
  dob: string;
  countryCode: string;
  mobile: string;
  email: string;
  street: string;
  city: string;
  state: string;
  country: string;
  pincode: string;
  guardianApplicable: boolean;
  guardianName: string;
  guardianRelation: string;
  guardianContact: string;
  guardianReason: GuardianReason | "";
}

const EMPTY_FORM: FormState = {
  channel: null,
  firstName: "",
  lastName: "",
  gender: "",
  dob: "",
  countryCode: "+91",
  mobile: "",
  email: "",
  street: "",
  city: "",
  state: "",
  country: "India",
  pincode: "",
  guardianApplicable: false,
  guardianName: "",
  guardianRelation: "",
  guardianContact: "",
  guardianReason: "",
};

const selectClass =
  "w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-neutral-700";

export default function RegisterPatientModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (p: PatientListItem) => void;
}) {
  const { clinics } = useClinics();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [err, setErr] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);
  const [clinicId, setClinicId] = useState("");
  const [created, setCreated] = useState<(PatientListItem & { login_id: string }) | null>(null);

  const [genderOptions, setGenderOptions] = useState([
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
    { value: "other", label: "Other" },
  ]);
  const [relationOptions, setRelationOptions] = useState(GUARDIAN_RELATION_OPTIONS);

  useEffect(() => {
    receptionService.getEnums()
      .then(({ gender, relationship }) => {
        if (gender.length) setGenderOptions(gender);
        if (relationship.length) setRelationOptions(relationship);
      })
      .catch(() => {});
    receptionService.resolveOwnClinicId().then(setClinicId).catch(() => {});
  }, []);

  const set = <K extends keyof FormState>(field: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [field]: val }));

  const { location: pincodeLocation, loading: pincodeLoading } = usePincodeLookup(form.pincode);
  useEffect(() => {
    if (!pincodeLocation) return;
    setForm((f) => ({ ...f, city: pincodeLocation.city, state: pincodeLocation.state, country: pincodeLocation.country }));
  }, [pincodeLocation]);

  const { locate, address: geoAddress, status: geoStatus } = useGeolocationAddress();
  useEffect(() => {
    if (!geoAddress) return;
    setForm((f) => ({
      ...f,
      pincode: geoAddress.pincode || f.pincode,
      city: geoAddress.city,
      state: geoAddress.state,
      country: geoAddress.country,
    }));
  }, [geoAddress]);

  // Under 18: guardian section opens automatically and can't be switched off.
  // A guardian holds the patient's login (receives the temporary password and
  // gives consent), so with a mobile login the guardian's number IS the login.
  const minor = isMinor(form.dob);
  const guardianRequired = minor || form.guardianApplicable;
  const guardianOwnsLogin = guardianRequired && form.channel === "phone";
  const guardianContact = guardianOwnsLogin ? form.mobile : form.guardianContact;

  const contact = form.channel === "phone" ? `${form.countryCode}${form.mobile.replace(/\D/g, "")}` : form.email.trim();
  const clinicName = clinics.find((c) => c.clinic_id === clinicId)?.clinic_name
    || clinics.find((c) => c.clinic_id === clinicId)?.city
    || null;

  const goBack = () => setStep((s) => (Math.max(1, s - 1) as Step));

  const detailsValid =
    form.firstName.trim() && form.lastName.trim() && form.gender && form.dob &&
    (form.channel === "phone" ? isValidMobile(form.mobile) : /\S+@\S+\.\S+/.test(form.email)) &&
    form.city.trim() && form.state.trim() && form.country.trim() &&
    (!guardianRequired || (
      form.guardianName.trim() && form.guardianRelation && isValidMobile(guardianContact) && (minor || form.guardianReason)
    ));

  const handleRegister = async () => {
    setErr(null);
    setRegistering(true);
    try {
      const resolvedClinicId = clinicId || (await receptionService.resolveOwnClinicId());
      const patient = await receptionService.registerPatient(resolvedClinicId, {
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        gender: form.gender,
        date_of_birth: form.dob,
        channel: form.channel!,
        contact,
        street: form.street.trim() || undefined,
        city: form.city.trim(),
        state: form.state.trim(),
        country: form.country.trim(),
        pincode: form.pincode.trim() || undefined,
        guardian: guardianRequired
          ? {
              name: form.guardianName.trim(),
              relation: form.guardianRelation,
              contact_number: guardianContact.trim(),
              reason: minor ? undefined : (form.guardianReason || undefined),
            }
          : undefined,
      });
      setCreated(patient);
      setStep(4);
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message || e?.response?.data?.detail || "Registration failed. Please try again.");
    } finally {
      setRegistering(false);
    }
  };

  const loginLabel = form.channel === "phone" ? (guardianRequired ? "Guardian's mobile number" : "Mobile number") : "Email address";

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 flex-shrink-0">
          <h2 className="text-lg font-semibold text-neutral-900">Register New Patient</h2>
          <button onClick={step === 4 && created ? () => onSuccess(created) : onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <Stepper current={step} />

        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
          {err && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>
          )}

          {/* ─── Step 1: Method ─── */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-neutral-500">
                Choose the patient&apos;s login. Their login details (a temporary password) are sent there — make sure the patient
                {" "}(or, for a minor, the guardian) has this phone or email with them.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(["phone", "email"] as const).map((c) => {
                  const selected = form.channel === c;
                  const Icon = c === "phone" ? Smartphone : Mail;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set("channel", c)}
                      className={`text-left px-4 py-4 rounded-xl border-2 transition-colors ${
                        selected ? "border-blue-500 bg-blue-50" : "border-neutral-200 hover:border-neutral-300"
                      }`}
                    >
                      <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center mb-3">
                        <Icon className="h-4.5 w-4.5 text-neutral-600" />
                      </div>
                      <p className="text-sm font-semibold text-neutral-900">
                        Register with {c === "phone" ? "Mobile Number" : "Email"}
                      </p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Login details sent by {c === "phone" ? "SMS" : "email"}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ─── Step 2: Details ─── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">First name <span className="text-red-500">*</span></label>
                  <Input placeholder="Jane" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Last name <span className="text-red-500">*</span></label>
                  <Input placeholder="Smith" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Gender <span className="text-red-500">*</span></label>
                  <select value={form.gender} onChange={(e) => set("gender", e.target.value)} className={selectClass}>
                    <option value="">Select…</option>
                    {genderOptions.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Date of birth <span className="text-red-500">*</span></label>
                  <Input type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} />
                </div>

                {form.channel === "phone" ? (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1.5">Country Code <span className="text-red-500">*</span></label>
                      <select value={form.countryCode} onChange={(e) => set("countryCode", e.target.value)} className={selectClass}>
                        {COUNTRY_CODES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1.5">{loginLabel} <span className="text-red-500">*</span></label>
                      <Input type="tel" inputMode="numeric" maxLength={10} placeholder="9820011223" value={form.mobile} onChange={(e) => set("mobile", toMobileDigits(e.target.value))} />
                      {form.mobile && !isValidMobile(form.mobile) && <p className="text-xs text-red-600 mt-1">{MOBILE_ERROR}</p>}
                    </div>
                  </>
                ) : (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-neutral-700 mb-1.5">{loginLabel} <span className="text-red-500">*</span></label>
                    <Input type="email" placeholder="jane.smith@example.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">Address (optional)</label>
                <Input placeholder="Street address" value={form.street} onChange={(e) => set("street", e.target.value)} />
              </div>

              <button
                type="button"
                onClick={locate}
                disabled={geoStatus === "requesting" || geoStatus === "loading"}
                className="flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                {geoStatus === "requesting" || geoStatus === "loading" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <MapPin className="w-3.5 h-3.5" />
                )}
                Use my location
              </button>
              {geoStatus === "denied" && <p className="text-xs text-red-600">Location permission denied — enter address manually.</p>}
              {geoStatus === "error" && <p className="text-xs text-red-600">Couldn&apos;t determine address — enter it manually.</p>}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">City <span className="text-red-500">*</span></label>
                  <Input placeholder="Mumbai" value={form.city} onChange={(e) => set("city", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">State <span className="text-red-500">*</span></label>
                  <Input placeholder="Maharashtra" value={form.state} onChange={(e) => set("state", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Country <span className="text-red-500">*</span></label>
                  <Input placeholder="India" value={form.country} onChange={(e) => set("country", e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Pincode (optional)</label>
                  <Input placeholder="400001" maxLength={6} value={form.pincode} onChange={(e) => set("pincode", e.target.value)} />
                  {pincodeLoading && <p className="text-xs text-neutral-400 mt-1">Looking up city/state…</p>}
                </div>
              </div>

              <label className="flex items-center gap-2 pt-2 border-t border-neutral-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={guardianRequired}
                  disabled={minor}
                  onChange={(e) => set("guardianApplicable", e.target.checked)}
                  className="w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500 disabled:opacity-60"
                />
                <span className="text-sm font-medium text-neutral-800">Guardian gives consent</span>
                <span className="text-xs text-neutral-400">
                  {minor ? `— required: patient is ${ageFromDob(form.dob)} (under 18)` : "— only if the patient cannot consent for themselves"}
                </span>
              </label>

              {guardianRequired && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1.5">Guardian name <span className="text-red-500">*</span></label>
                      <Input placeholder="Arun Nair" value={form.guardianName} onChange={(e) => set("guardianName", e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1.5">Relation type <span className="text-red-500">*</span></label>
                      <select value={form.guardianRelation} onChange={(e) => set("guardianRelation", e.target.value)} className={selectClass}>
                        <option value="">Select…</option>
                        {relationOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1.5">Guardian mobile <span className="text-red-500">*</span></label>
                      <Input
                        type="tel"
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="9820033445"
                        value={guardianContact}
                        disabled={guardianOwnsLogin}
                        onChange={(e) => set("guardianContact", toMobileDigits(e.target.value))}
                      />
                      {guardianOwnsLogin && <p className="text-xs text-neutral-400 mt-1">Same as the login number above.</p>}
                      {!guardianOwnsLogin && guardianContact && !isValidMobile(guardianContact) && <p className="text-xs text-red-600 mt-1">{MOBILE_ERROR}</p>}
                    </div>
                  </div>
                  {!minor && (
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1.5">Why does a guardian consent for this adult? <span className="text-red-500">*</span></label>
                      <select value={form.guardianReason} onChange={(e) => set("guardianReason", e.target.value as GuardianReason)} className={selectClass}>
                        <option value="">Select…</option>
                        {GUARDIAN_REASON_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ─── Step 3: Review ─── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="border border-neutral-200 rounded-xl p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  ["Name", `${form.firstName} ${form.lastName}`.trim()],
                  ["DOB", form.dob],
                  ["Gender", genderOptions.find((g) => g.value === form.gender)?.label || form.gender],
                  ["Login", form.channel === "phone" ? `${form.countryCode} ${form.mobile}` : form.email],
                  ["Address", form.street || "—"],
                  ["City / State", `${form.city}, ${form.state}`],
                  ["Pincode", form.pincode || "—"],
                  ...(guardianRequired
                    ? [
                        ["Guardian", form.guardianName],
                        ["Guardian relation", relationOptions.find((r) => r.value === form.guardianRelation)?.label || form.guardianRelation],
                        ["Guardian mobile", guardianContact],
                      ]
                    : []),
                  ["Country", form.country],
                  ["Clinic", clinicName || "—"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-neutral-400">{label}</p>
                    <p className="text-sm font-medium text-neutral-800 mt-0.5">{value || "—"}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3.5 py-2.5">
                <ShieldCheck className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  Check the {form.channel === "phone" ? "mobile number" : "email"} with the patient — the login details go there.
                  The {guardianRequired ? "guardian" : "patient"} then signs in on their own device, sets a password and reviews the consent form.
                  Consent is never recorded at the front desk.
                </span>
              </div>
            </div>
          )}

          {/* ─── Step 4: Sent ─── */}
          {step === 4 && created && (
            <div className="flex flex-col items-center text-center py-6 space-y-3">
              <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                <Send className="h-6 w-6 text-green-600" />
              </div>
              <p className="text-sm font-semibold text-neutral-900">{created.full_name} is registered</p>
              <p className="text-sm text-neutral-600 max-w-md">
                A temporary password was sent to <strong>{created.login_id}</strong>. Ask the {guardianRequired ? "guardian" : "patient"} to
                sign in on their phone, set their own password and confirm the consent form.
              </p>
              <p className="text-xs text-neutral-400">Didn&apos;t arrive? Use “Resend login” on the patient&apos;s page.</p>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-neutral-100 flex-shrink-0">
          {step < 4 && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              Cancel
            </button>
          )}
          {step > 1 && step < 4 && (
            <button
              type="button"
              onClick={goBack}
              className="px-4 py-2 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              Back
            </button>
          )}
          <div className="flex-1" />

          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              disabled={!form.channel}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:bg-neutral-200 disabled:text-neutral-400 transition-colors"
            >
              Continue
            </button>
          )}

          {step === 2 && (
            <button
              onClick={() => setStep(3)}
              disabled={!detailsValid}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:bg-neutral-200 disabled:text-neutral-400 transition-colors"
            >
              Continue
            </button>
          )}

          {step === 3 && (
            <button
              onClick={handleRegister}
              disabled={registering}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {registering && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {registering ? "Registering…" : "Register & send login"}
            </button>
          )}

          {step === 4 && created && (
            <button
              onClick={() => onSuccess(created)}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
