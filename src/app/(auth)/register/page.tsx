"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Loader2, Building2, ChevronDown, Shield } from "lucide-react";
import { Button } from "@/components/ui";
import { useAuth, useClinics } from "@/lib/hooks";
import { register as registerThunk } from "@/store/slices/authSlice";
import { authService } from "@/lib/api/services/auth.service";
import { COUNTRY_OPTIONS } from "@/lib/countries";
import { ROUTES } from "@/lib/constants";

// ─── Shared field helpers (used by both the local-dev form and the OTP wizard) ─

const GENDER_OPTIONS = [
  { value: "",                  label: "Select…" },
  { value: "male",              label: "Male" },
  { value: "female",            label: "Female" },
  { value: "other",             label: "Other" },
];

function FieldLabel({ htmlFor, text, required, optional }: { htmlFor: string; text: string; required?: boolean; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-neutral-700 mb-1.5">
      {text}
      {required && <span className="text-red-500 ml-0.5">*</span>}
      {optional && <span className="ml-1 text-xs font-normal text-neutral-400">(optional)</span>}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 hover:border-neutral-400";
const inputErrCls =
  "w-full rounded-lg border border-danger-400 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-danger-500/20 focus:border-danger-500";

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1.5 text-xs text-danger-600">{msg}</p>;
}

function getFilteredClinics(allClinics: any[], userCity?: string, userState?: string) {
  if (!allClinics.length) return allClinics;
  const cityL = userCity?.toLowerCase().trim() || "";
  const stateL = userState?.toLowerCase().trim() || "";
  if (!cityL && !stateL) return allClinics;
  if (cityL) {
    const m = allClinics.filter((c) => c.city?.toLowerCase().trim() === cityL);
    if (m.length > 0) return m;
  }
  if (stateL) {
    const m = allClinics.filter((c) => c.state?.toLowerCase().trim() === stateL);
    if (m.length > 0) return m;
  }
  return allClinics;
}

// ─── Page — picks local-dev single-step form vs the real OTP wizard ──────────

export default function RegisterPage() {
  const [authMode, setAuthMode] = useState<"local" | "cognito" | null>(null);

  useEffect(() => {
    authService.isRealSignupEnabled().then(setAuthMode).catch(() => setAuthMode("local"));
  }, []);

  if (authMode === null) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-neutral-400" /></div>;
  }
  return authMode === "cognito" ? (
    <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-neutral-400" /></div>}>
      <OtpSignupWizard />
    </Suspense>
  ) : <LocalRegisterForm />;
}

// ─── Local dev — single-step, no OTP (unchanged behavior) ────────────────────

const registerSchema = z.object({
  first_name:    z.string().min(1, "First name is required"),
  last_name:     z.string().min(1, "Last name is required"),
  email:         z.string().email("Please enter a valid email"),
  password:      z.string().min(8, "Password must be at least 8 characters"),
  phone:         z.string().min(1, "Phone is required"),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  gender:        z.string().min(1, "Gender is required"),
  address:       z.string().optional(),
  city:          z.string().min(1, "City is required"),
  state:         z.string().min(1, "State is required"),
  country:       z.string().optional(),
  pincode:       z.string().optional(),
  clinic_id:     z.string().min(1, "Please select your clinic"),
});
type RegisterFormData = z.infer<typeof registerSchema>;

function LocalRegisterForm() {
  const { isLoading, error, clearError, register } = useAuth();
  const { clinics, isLoading: clinicsLoading } = useClinics();
  const router = useRouter();

  const { register: field, handleSubmit, watch, formState: { errors } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { gender: "" },
  });

  const selectedClinicId = watch("clinic_id");
  const userCity = watch("city");
  const userState = watch("state");
  const selectedClinic = clinics.find((c) => c.clinic_id === selectedClinicId);
  const filteredClinics = getFilteredClinics(clinics, userCity, userState);

  const onSubmit = async (data: RegisterFormData) => {
    clearError();
    const result = await register(data);
    if (registerThunk.fulfilled.match(result)) {
      router.push(ROUTES.CONSENT);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">Create account</h2>
        <p className="text-sm text-neutral-500 mt-1">Patient self-registration — Anava PRS (local dev)</p>
      </div>

      {error && <div className="mb-4 bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="first_name" text="First name" required />
            <input id="first_name" placeholder="Jane" autoComplete="given-name" {...field("first_name")} className={errors.first_name ? inputErrCls : inputCls} />
            <FieldError msg={errors.first_name?.message} />
          </div>
          <div>
            <FieldLabel htmlFor="last_name" text="Last name" required />
            <input id="last_name" placeholder="Smith" autoComplete="family-name" {...field("last_name")} className={errors.last_name ? inputErrCls : inputCls} />
            <FieldError msg={errors.last_name?.message} />
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="email" text="Email address" required />
          <input id="email" type="email" placeholder="you@example.com" autoComplete="email" {...field("email")} className={errors.email ? inputErrCls : inputCls} />
          <FieldError msg={errors.email?.message} />
        </div>

        <div>
          <FieldLabel htmlFor="password" text="Password" required />
          <input id="password" type="password" placeholder="At least 8 characters" autoComplete="new-password" {...field("password")} className={errors.password ? inputErrCls : inputCls} />
          <FieldError msg={errors.password?.message} />
        </div>

        <div>
          <FieldLabel htmlFor="phone" text="Phone" required />
          <input id="phone" type="tel" placeholder="+91 98765 43210" autoComplete="tel" {...field("phone")} className={errors.phone ? inputErrCls : inputCls} />
          <FieldError msg={errors.phone?.message} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="date_of_birth" text="Date of birth" required />
            <input id="date_of_birth" type="date" {...field("date_of_birth")} className={errors.date_of_birth ? inputErrCls : inputCls} />
            <FieldError msg={errors.date_of_birth?.message} />
          </div>
          <div>
            <FieldLabel htmlFor="gender" text="Gender" required />
            <div className="relative">
              <select id="gender" {...field("gender")} className={`${errors.gender ? inputErrCls : inputCls} appearance-none pr-9`}>
                {GENDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
            </div>
            <FieldError msg={errors.gender?.message} />
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="address" text="Address" optional />
          <input id="address" placeholder="Street address" {...field("address")} className={inputCls} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="city" text="City" required />
            <input id="city" placeholder="Mumbai" {...field("city")} className={errors.city ? inputErrCls : inputCls} />
            <FieldError msg={errors.city?.message} />
          </div>
          <div>
            <FieldLabel htmlFor="state" text="State" required />
            <input id="state" placeholder="Maharashtra" {...field("state")} className={errors.state ? inputErrCls : inputCls} />
            <FieldError msg={errors.state?.message} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="country" text="Country" optional />
            <input id="country" placeholder="India" {...field("country")} className={inputCls} />
          </div>
          <div>
            <FieldLabel htmlFor="pincode" text="Pincode" optional />
            <input id="pincode" placeholder="400001" {...field("pincode")} className={inputCls} />
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="clinic_id" text="Clinic" required />
          {clinicsLoading ? (
            <div className="flex items-center gap-2 h-10 px-3.5 border border-neutral-300 rounded-lg text-sm text-neutral-400">
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />Loading clinics…
            </div>
          ) : (
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
              <select id="clinic_id" {...field("clinic_id")} className={`w-full pl-9 pr-9 py-2.5 border rounded-lg text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 hover:border-neutral-400 transition-all ${errors.clinic_id ? "border-danger-400" : "border-neutral-300"} text-neutral-900`}>
                <option value="">Select your clinic…</option>
                {filteredClinics.map((c) => <option key={c.clinic_id} value={c.clinic_id}>{c.clinic_name}{c.city ? ` — ${c.city}` : ""}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
            </div>
          )}
          <FieldError msg={errors.clinic_id?.message} />
          {selectedClinic?.address && <p className="mt-1 text-xs text-neutral-400">{selectedClinic.address}{selectedClinic.state ? `, ${selectedClinic.state}` : ""}</p>}
        </div>

        <div className="flex items-start gap-2 text-xs text-neutral-400 bg-neutral-50 border border-neutral-200 rounded-lg px-3.5 py-2.5">
          <Shield className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-neutral-400" />
          <span>After this, you'll pick your condition and sign your onboarding consent — the next steps in your registration.</span>
        </div>

        <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>Continue</Button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-500">
        Already have an account?{" "}
        <Link href="/login" className="text-primary-600 font-medium hover:text-primary-700 hover:underline transition-colors">Sign in</Link>
      </p>
    </div>
  );
}

// ─── Real signup — email-or-mobile, OTP-verified, then password ─────────────

const demographicsSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name:  z.string().min(1, "Last name is required"),
  gender:     z.string().min(1, "Gender is required"),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  address:    z.string().optional(),
  city:       z.string().min(1, "City is required"),
  state:      z.string().min(1, "State is required"),
  country:    z.string().min(1, "Country is required"),
  pincode:    z.string().optional(),
  clinic_id:  z.string().min(1, "Please select your clinic"),
});
type DemographicsData = z.infer<typeof demographicsSchema>;

function OtpSignupWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clinics, isLoading: clinicsLoading } = useClinics();
  const { completePatientSignup } = useAuth();

  const [step, setStep] = useState<"demographics" | "otp" | "password">("demographics");
  // Fixed by which button the patient clicked on /login — no in-page switcher.
  const [method] = useState<"email" | "mobile">(searchParams.get("method") === "mobile" ? "mobile" : "email");
  const [contact, setContact] = useState("");
  const [demographics, setDemographics] = useState<DemographicsData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register: field, handleSubmit, watch, formState: { errors } } = useForm<DemographicsData>({
    resolver: zodResolver(demographicsSchema),
    defaultValues: { gender: "", country: "India" },
  });
  const userCity = watch("city");
  const userState = watch("state");
  const selectedClinicId = watch("clinic_id");
  const selectedClinic = clinics.find((c) => c.clinic_id === selectedClinicId);
  const filteredClinics = getFilteredClinics(clinics, userCity, userState);
  const dialCode = COUNTRY_OPTIONS.find((c) => c.name === watch("country"))?.dialCode ?? "+91";
  // Full E.164 number for mobile (country code + digits only); the raw
  // email string as typed for email — this is what Cognito/our backend
  // actually needs, while `contact` state holds just what's in the input.
  const fullContact = method === "mobile" ? `${dialCode}${contact.replace(/\D/g, "")}` : contact.trim();

  // ── Step 1: demographics + clinic + contact -> send OTP ──────────────────
  const onStartSignup = async (data: DemographicsData) => {
    if (!contact.trim()) {
      setError(method === "email" ? "Enter your email address" : "Enter your mobile number");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await authService.patientSignupStart({
        first_name: data.first_name, last_name: data.last_name, dob: data.date_of_birth,
        gender: data.gender, address: data.address, city: data.city, state: data.state,
        country: data.country, pincode: data.pincode,
        primary_clinic_id: data.clinic_id, method, contact: fullContact,
      });
      setDemographics(data);
      setStep("otp");
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Could not send verification code");
    } finally {
      setBusy(false);
    }
  };

  // ── Step 2: OTP — auto-submits once 6 digits are entered ──────────────────
  const [otp, setOtp] = useState("");
  const [resending, setResending] = useState(false);

  const onVerifyOtp = async (code: string) => {
    if (!code.trim()) { setError("Enter the code we sent you"); return; }
    setError(null);
    setBusy(true);
    try {
      await authService.patientSignupVerify(fullContact, code.trim());
      setStep("password");
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Incorrect or expired code");
      setOtp("");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (step === "otp" && otp.length === 6 && !busy) {
      onVerifyOtp(otp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otp, step]);

  const onResend = async () => {
    setResending(true);
    setError(null);
    try {
      await authService.patientSignupResend(fullContact);
    } catch {
      setError("Could not resend code — try again shortly");
    } finally {
      setResending(false);
    }
  };

  // ── Step 3: password + confirm -> create account ──────────────────────────
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const onCompleteSignup = async () => {
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }
    if (!demographics) { setError("Something went wrong — please start over"); setStep("demographics"); return; }
    setError(null);
    setBusy(true);
    try {
      const result = await completePatientSignup({
        first_name: demographics.first_name, last_name: demographics.last_name,
        dob: demographics.date_of_birth, gender: demographics.gender, address: demographics.address,
        city: demographics.city, state: demographics.state, country: demographics.country,
        pincode: demographics.pincode,
        primary_clinic_id: demographics.clinic_id, method, contact: fullContact,
        password, confirm_password: confirmPassword,
      });
      if ((result as any)?.meta?.requestStatus === "fulfilled") {
        router.push(ROUTES.CONSENT);
      } else {
        setError(((result as any)?.payload as string) || "Could not create your account");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">Create account</h2>
        <p className="text-sm text-neutral-500 mt-1">Patient self-registration — Anava PRS</p>
      </div>

      {error && <div className="mb-4 bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {step === "demographics" && (
        <form onSubmit={handleSubmit(onStartSignup)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel htmlFor="first_name" text="First name" required />
              <input id="first_name" placeholder="Jane" autoComplete="given-name" {...field("first_name")} className={errors.first_name ? inputErrCls : inputCls} />
              <FieldError msg={errors.first_name?.message} />
            </div>
            <div>
              <FieldLabel htmlFor="last_name" text="Last name" required />
              <input id="last_name" placeholder="Smith" autoComplete="family-name" {...field("last_name")} className={errors.last_name ? inputErrCls : inputCls} />
              <FieldError msg={errors.last_name?.message} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel htmlFor="gender" text="Gender" required />
              <div className="relative">
                <select id="gender" {...field("gender")} className={`${errors.gender ? inputErrCls : inputCls} appearance-none pr-9`}>
                  {GENDER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
              </div>
              <FieldError msg={errors.gender?.message} />
            </div>
            <div>
              <FieldLabel htmlFor="date_of_birth" text="Date of birth" required />
              <input id="date_of_birth" type="date" {...field("date_of_birth")} className={errors.date_of_birth ? inputErrCls : inputCls} />
              <FieldError msg={errors.date_of_birth?.message} />
            </div>
          </div>

          <div>
            <FieldLabel htmlFor="address" text="Address" optional />
            <input id="address" placeholder="Street address" {...field("address")} className={inputCls} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <FieldLabel htmlFor="city" text="City" required />
              <input id="city" placeholder="Mumbai" {...field("city")} className={errors.city ? inputErrCls : inputCls} />
              <FieldError msg={errors.city?.message} />
            </div>
            <div>
              <FieldLabel htmlFor="state" text="State" required />
              <input id="state" placeholder="Maharashtra" {...field("state")} className={errors.state ? inputErrCls : inputCls} />
              <FieldError msg={errors.state?.message} />
            </div>
          </div>

          <div>
            <FieldLabel htmlFor="pincode" text="Pincode" optional />
            <input id="pincode" placeholder="400001" {...field("pincode")} className={inputCls} />
          </div>

          <div>
            <FieldLabel htmlFor="country" text="Country" required />
            <div className="relative">
              <select id="country" {...field("country")} className={`${errors.country ? inputErrCls : inputCls} appearance-none pr-9`}>
                {/* Dial code only matters for mobile signup — no need to show it alongside the country name for email. */}
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.name} value={c.name}>{method === "mobile" ? `${c.name} (${c.dialCode})` : c.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
            </div>
            <FieldError msg={errors.country?.message} />
          </div>

          <div>
            <FieldLabel htmlFor="clinic_id" text="Clinic" required />
            {clinicsLoading ? (
              <div className="flex items-center gap-2 h-10 px-3.5 border border-neutral-300 rounded-lg text-sm text-neutral-400">
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />Loading clinics…
              </div>
            ) : (
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
                <select id="clinic_id" {...field("clinic_id")} className={`w-full pl-9 pr-9 py-2.5 border rounded-lg text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 hover:border-neutral-400 transition-all ${errors.clinic_id ? "border-danger-400" : "border-neutral-300"} text-neutral-900`}>
                  <option value="">Select your clinic…</option>
                  {filteredClinics.map((c) => <option key={c.clinic_id} value={c.clinic_id}>{c.clinic_name}{c.city ? ` — ${c.city}` : ""}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
              </div>
            )}
            <FieldError msg={errors.clinic_id?.message} />
            {selectedClinic?.address && <p className="mt-1 text-xs text-neutral-400">{selectedClinic.address}{selectedClinic.state ? `, ${selectedClinic.state}` : ""}</p>}
          </div>

          {/* ── Contact (method fixed by which button was clicked on /login) ── */}
          <div>
            <FieldLabel htmlFor="contact" text={method === "email" ? "Email address" : "Mobile number"} required />
            <div className="flex gap-2">
              {method === "email" ? (
                <input id="contact" type="email" placeholder="you@example.com" value={contact} onChange={(e) => setContact(e.target.value)} className={inputCls} />
              ) : (
                <div className="flex flex-1 gap-2">
                  <span className="flex items-center justify-center px-3 rounded-lg border border-neutral-300 bg-neutral-50 text-sm text-neutral-600 flex-shrink-0">
                    {dialCode}
                  </span>
                  <input id="contact" type="tel" placeholder="XXXXXXXXXX" value={contact} onChange={(e) => setContact(e.target.value)} className={inputCls} />
                </div>
              )}
              <Button type="submit" isLoading={busy} className="flex-shrink-0">Verify</Button>
            </div>
          </div>
        </form>
      )}

      {step === "otp" && (
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            We sent a verification code to <span className="font-medium text-neutral-900">{fullContact}</span>.
          </p>
          <div>
            <FieldLabel htmlFor="otp" text="Verification code" required />
            <input
              id="otp" inputMode="numeric" maxLength={6} placeholder="123456" value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className={inputCls} autoFocus
            />
            <p className="mt-1.5 text-xs text-neutral-400">Verifies automatically once you enter all 6 digits.</p>
          </div>
          {busy && <p className="text-sm text-neutral-500 text-center">Verifying…</p>}
          <button type="button" onClick={onResend} disabled={resending} className="w-full text-center text-sm text-primary-600 hover:underline disabled:opacity-50">
            {resending ? "Resending…" : "Resend code"}
          </button>
        </div>
      )}

      {step === "password" && (
        <div className="space-y-4">
          <p className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-lg px-3.5 py-2.5">
            {method === "email" ? "Email" : "Mobile number"} verified. Choose a password to finish creating your account.
          </p>
          <div>
            <FieldLabel htmlFor="password" text="Password" required />
            <input id="password" type="password" placeholder="At least 8 characters" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
          </div>
          <div>
            <FieldLabel htmlFor="confirm_password" text="Confirm password" required />
            <input id="confirm_password" type="password" placeholder="Re-enter your password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputCls} />
          </div>
          <Button onClick={onCompleteSignup} className="w-full" size="lg" isLoading={busy}>Create Account</Button>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-neutral-500">
        Already have an account?{" "}
        <Link href="/login" className="text-primary-600 font-medium hover:text-primary-700 hover:underline transition-colors">Sign in</Link>
      </p>
    </div>
  );
}
