"use client";

import { Fragment, useEffect, useState } from "react";
import {
  X, Check, Smartphone, Mail, ShieldCheck, Lock, Loader2,
} from "lucide-react";
import { receptionService } from "@/lib/api/services/reception.service";
import { consentService } from "@/lib/api/services/consent.service";
import { useClinics } from "@/lib/hooks";
import { Input } from "@/components/ui";
import type { PatientListItem } from "@/types/domain.types";

const STEP_LABELS = ["Method", "Details", "Verify", "Password", "Consent", "Review"] as const;
type Step = 1 | 2 | 3 | 4 | 5 | 6;

const COUNTRY_CODES = [
  { code: "+91", label: "India (+91)" },
  { code: "+1", label: "USA (+1)" },
  { code: "+44", label: "UK (+44)" },
  { code: "+971", label: "UAE (+971)" },
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
  password: string;
  confirmPassword: string;
  consentAccepted: boolean;
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
  password: "",
  confirmPassword: "",
  consentAccepted: false,
};

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

  const [genderOptions, setGenderOptions] = useState([
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
    { value: "other", label: "Other" },
  ]);
  const [relationOptions, setRelationOptions] = useState([
    { value: "parent", label: "Parent" },
    { value: "spouse", label: "Spouse" },
    { value: "sibling", label: "Sibling" },
    { value: "child", label: "Child" },
    { value: "legal_guardian", label: "Legal Guardian" },
    { value: "other", label: "Other" },
  ]);

  useEffect(() => {
    receptionService.getEnums()
      .then(({ gender, relationship }) => {
        if (gender.length) setGenderOptions(gender);
        if (relationship.length) setRelationOptions(relationship);
      })
      .catch(() => {});
  }, []);

  // Verification round-trip state — real backend sends an actual Cognito
  // OTP, there is no way to skip this step.
  const [verificationId, setVerificationId] = useState("");
  const [registrationToken, setRegistrationToken] = useState("");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [verified, setVerified] = useState(false);
  const [clinicId, setClinicId] = useState("");

  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [resending, setResending] = useState(false);
  const [registering, setRegistering] = useState(false);

  const set = <K extends keyof FormState>(field: K, val: FormState[K]) =>
    setForm((f) => ({ ...f, [field]: val }));

  const contact = form.channel === "phone" ? `${form.countryCode}${form.mobile.replace(/\D/g, "")}` : form.email.trim();
  const clinicName = clinics.find((c) => c.clinic_id === clinicId)?.clinic_name
    || clinics.find((c) => c.clinic_id === clinicId)?.city
    || null;

  const goBack = () => setStep((s) => (Math.max(1, s - 1) as Step));

  // ─── Step 1: Method ───
  const canContinueMethod = !!form.channel;

  // ─── Step 2: Details ───
  const detailsValid =
    form.firstName.trim() && form.lastName.trim() && form.gender && form.dob &&
    (form.channel === "phone" ? form.mobile.trim().length >= 6 : /\S+@\S+\.\S+/.test(form.email)) &&
    form.city.trim() && form.state.trim() && form.country.trim() &&
    (!form.guardianApplicable || (form.guardianName.trim() && form.guardianRelation && form.guardianContact.trim()));

  const handleSendCode = async () => {
    if (!detailsValid) return;
    setErr(null);
    setSendingCode(true);
    try {
      const resolvedClinicId = await receptionService.resolveOwnClinicId();
      const { verification_id } = await receptionService.sendVerificationCode({
        channel: form.channel!,
        contact,
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        dob: form.dob,
        gender: form.gender,
      });
      setClinicId(resolvedClinicId);
      setVerificationId(verification_id);
      setVerified(false);
      setOtpDigits(["", "", "", "", "", ""]);
      setStep(3);
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message || e?.message || "Failed to send verification code. Please try again.");
    } finally {
      setSendingCode(false);
    }
  };

  // ─── Step 3: Verify ───
  const otpCode = otpDigits.join("");

  const handleOtpChange = (i: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    setOtpDigits((prev) => {
      const next = [...prev];
      next[i] = digit;
      return next;
    });
    if (digit && i < 5) {
      document.getElementById(`otp-box-${i + 1}`)?.focus();
    }
  };

  const handleVerifyCode = async () => {
    if (otpCode.length !== 6) return;
    setErr(null);
    setVerifyingCode(true);
    try {
      const { registration_token } = await receptionService.verifyCode(verificationId, otpCode);
      setRegistrationToken(registration_token);
      setVerified(true);
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message || "Invalid or expired code. Please try again.");
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleResendCode = async () => {
    setErr(null);
    setResending(true);
    try {
      const { verification_id } = await receptionService.sendVerificationCode({
        channel: form.channel!,
        contact,
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(),
        dob: form.dob,
        gender: form.gender,
      });
      setVerificationId(verification_id);
      setVerified(false);
      setOtpDigits(["", "", "", "", "", ""]);
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message || "Failed to resend code. Please try again.");
    } finally {
      setResending(false);
    }
  };

  // ─── Step 4: Password ───
  const passwordValid = form.password.length >= 8 && form.password === form.confirmPassword;

  // ─── Step 6: Register ───
  const handleRegister = async () => {
    setErr(null);
    setRegistering(true);
    try {
      const patient = await receptionService.registerPatient(registrationToken, clinicId, {
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
        guardian: form.guardianApplicable
          ? { name: form.guardianName.trim(), relation: form.guardianRelation, contact_number: form.guardianContact.trim() }
          : undefined,
        password: form.password,
      });
      // POST /reception/patients auto-creates a pending patient_onboarding
      // consent record — sign it now that consent was captured at the
      // front desk (no witness required).
      if (patient.profile_id) {
        const pending = await consentService.getMyPending(patient.profile_id, "patient");
        if (pending) {
          await consentService.sign(pending.consent_id, {
            signature_data: `${form.firstName.trim()} ${form.lastName.trim()} — consent captured at clinic front desk`,
          });
        }
      }
      onSuccess(patient);
    } catch (e: any) {
      setErr(e?.response?.data?.error?.message || e?.response?.data?.detail || "Failed to register patient. Please try again.");
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 flex-shrink-0">
          <h2 className="text-lg font-semibold text-neutral-900">Register New Patient</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors">
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
                Choose how the patient will register. Their mobile number or email becomes their login ID, and the verification code is sent there.
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
                        Register with {c === "phone" ? "Number" : "Email"}
                      </p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Verification code sent by {c === "phone" ? "SMS" : "email"}
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
                  <select
                    value={form.gender}
                    onChange={(e) => set("gender", e.target.value)}
                    className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-neutral-700"
                  >
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
                      <select
                        value={form.countryCode}
                        onChange={(e) => set("countryCode", e.target.value)}
                        className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-neutral-700"
                      >
                        {COUNTRY_CODES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-neutral-700 mb-1.5">Mobile Number <span className="text-red-500">*</span></label>
                      <Input type="tel" placeholder="98200 11223" value={form.mobile} onChange={(e) => set("mobile", e.target.value)} />
                    </div>
                  </>
                ) : (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-neutral-700 mb-1.5">Email Address <span className="text-red-500">*</span></label>
                    <Input type="email" placeholder="jane.smith@example.com" value={form.email} onChange={(e) => set("email", e.target.value)} />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1.5">Address (optional)</label>
                <Input placeholder="Street address" value={form.street} onChange={(e) => set("street", e.target.value)} />
              </div>

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
                  <Input placeholder="400001" value={form.pincode} onChange={(e) => set("pincode", e.target.value)} />
                </div>
              </div>

              <label className="flex items-center gap-2 pt-2 border-t border-neutral-100 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.guardianApplicable}
                  onChange={(e) => set("guardianApplicable", e.target.checked)}
                  className="w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-neutral-800">Guardian applicable</span>
                <span className="text-xs text-neutral-400">— for minors or patients under assisted care</span>
              </label>

              {form.guardianApplicable && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1.5">Guardian name <span className="text-red-500">*</span></label>
                    <Input placeholder="Arun Nair" value={form.guardianName} onChange={(e) => set("guardianName", e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1.5">Relation type <span className="text-red-500">*</span></label>
                    <select
                      value={form.guardianRelation}
                      onChange={(e) => set("guardianRelation", e.target.value)}
                      className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-neutral-700"
                    >
                      <option value="">Select…</option>
                      {relationOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1.5">Contact number <span className="text-red-500">*</span></label>
                    <Input placeholder="98200 33445" value={form.guardianContact} onChange={(e) => set("guardianContact", e.target.value)} />
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded-lg px-3.5 py-2.5">
                <ShieldCheck className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                <span>
                  Pressing <strong>Verify</strong> sends a 6-digit code to the {form.channel === "phone" ? "mobile number" : "email address"} above.
                  This becomes the patient&apos;s login ID.
                </span>
              </div>
            </div>
          )}

          {/* ─── Step 3: Verify ─── */}
          {step === 3 && (
            <div className="flex flex-col items-center text-center py-6 space-y-4">
              {!verified ? (
                <>
                  <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
                    {form.channel === "phone" ? <Smartphone className="h-6 w-6 text-blue-600" /> : <Mail className="h-6 w-6 text-blue-600" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">Enter the code sent to {contact}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">The 6-digit code expires in 10 minutes.</p>
                  </div>
                  <div className="flex gap-2">
                    {otpDigits.map((d, i) => (
                      <input
                        key={i}
                        id={`otp-box-${i}`}
                        value={d}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        inputMode="numeric"
                        maxLength={1}
                        className="w-11 h-12 text-center text-lg font-semibold border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleVerifyCode}
                      disabled={verifyingCode || otpCode.length !== 6}
                      className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-colors"
                      style={{ background: "linear-gradient(135deg, #0284c7 0%, #1e40af 100%)" }}
                    >
                      {verifyingCode && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      Verify Code
                    </button>
                    <button
                      onClick={handleResendCode}
                      disabled={resending}
                      className="text-sm text-blue-600 hover:underline disabled:opacity-50"
                    >
                      {resending ? "Resending…" : "Resend code"}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
                    <ShieldCheck className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">Contact verified</p>
                    <p className="text-xs text-neutral-500 mt-0.5">{contact} is confirmed and will be used as the patient&apos;s login ID.</p>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                    {form.channel === "phone" ? "Mobile" : "Email"} verified
                  </span>
                </>
              )}
            </div>
          )}

          {/* ─── Step 4: Password ─── */}
          {step === 4 && (
            <div className="flex flex-col items-center text-center py-6 space-y-4 w-full">
              <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
                <Lock className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900">Create portal password</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {form.firstName} {form.lastName} will sign in with <strong>{contact}</strong> and this password.
                </p>
              </div>
              <div className="w-full max-w-sm space-y-3 text-left">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Create Password <span className="text-red-500">*</span></label>
                  <Input type="password" placeholder="Minimum 8 characters" value={form.password} onChange={(e) => set("password", e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">Confirm Password <span className="text-red-500">*</span></label>
                  <Input type="password" placeholder="Re-enter password" value={form.confirmPassword} onChange={(e) => set("confirmPassword", e.target.value)} />
                </div>
                {form.confirmPassword && form.password !== form.confirmPassword && (
                  <p className="text-xs text-red-600">Passwords do not match.</p>
                )}
              </div>
            </div>
          )}

          {/* ─── Step 5: Consent ─── */}
          {step === 5 && (
            <div className="space-y-4">
              <p className="text-xs text-neutral-500 leading-relaxed bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3">
                By creating an account on Anava NeuroWellness, the patient acknowledges and agrees to the data privacy terms
                governing the storage and clinical use of their health records. Please read this to the patient before submitting.
              </p>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.consentAccepted}
                  onChange={(e) => set("consentAccepted", e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-neutral-800">
                  Patient has read and accepted the Data Privacy Consent Form{" "}
                  <span className="text-xs font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded ml-1">Required</span>
                </span>
              </label>
            </div>
          )}

          {/* ─── Step 6: Review ─── */}
          {step === 6 && (
            <div className="space-y-4">
              <div className="border border-neutral-200 rounded-xl p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  ["Name", `${form.firstName} ${form.lastName}`.trim()],
                  ["DOB", form.dob],
                  ["Gender", genderOptions.find((g) => g.value === form.gender)?.label || form.gender],
                  [form.channel === "phone" ? "Mobile" : "Email", form.channel === "phone" ? `${form.countryCode} ${form.mobile}` : form.email],
                  ["Verification", verified ? "Verified" : "—"],
                  ["Password", form.password ? "Set" : "—"],
                  ["Address", form.street || "—"],
                  ["City / State", `${form.city}, ${form.state}`],
                  ["Pincode", form.pincode || "—"],
                  ["Country", form.country],
                  ["Clinic", clinicName || "—"],
                  ["Consent", form.consentAccepted ? "Signed" : "—"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-neutral-400">{label}</p>
                    <p className="text-sm font-medium text-neutral-800 mt-0.5">{value || "—"}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-4 py-2.5">
                <Check className="h-4 w-4 flex-shrink-0" strokeWidth={3} />
                Ready to submit
              </div>

              <p className="text-xs text-neutral-400">
                A patient ID will be issued. Emergency contact, ID proof and photo are completed by the patient in their portal.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 px-6 py-4 border-t border-neutral-100 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            Cancel
          </button>
          {step > 1 && (
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
              disabled={!canContinueMethod}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:bg-neutral-200 disabled:text-neutral-400 transition-colors"
            >
              Continue
            </button>
          )}

          {step === 2 && (
            <button
              onClick={handleSendCode}
              disabled={!detailsValid || sendingCode}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:bg-neutral-200 disabled:text-neutral-400 transition-colors"
            >
              {sendingCode && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Verify
            </button>
          )}

          {step === 3 && (
            <button
              onClick={() => setStep(4)}
              disabled={!verified}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:bg-neutral-200 disabled:text-neutral-400 transition-colors"
            >
              Continue
            </button>
          )}

          {step === 4 && (
            <button
              onClick={() => setStep(5)}
              disabled={!passwordValid}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:bg-neutral-200 disabled:text-neutral-400 transition-colors"
            >
              Continue
            </button>
          )}

          {step === 5 && (
            <button
              onClick={() => setStep(6)}
              disabled={!form.consentAccepted}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:bg-neutral-200 disabled:text-neutral-400 transition-colors"
            >
              Continue
            </button>
          )}

          {step === 6 && (
            <button
              onClick={handleRegister}
              disabled={registering}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {registering && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {registering ? "Registering…" : "Register Patient"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
