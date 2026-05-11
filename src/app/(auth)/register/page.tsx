"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { CheckCircle, Loader2, Building2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui";
import { useAuth, useClinics } from "@/lib/hooks";
import { register as registerThunk } from "@/store/slices/authSlice";

// ─── Schema ───────────────────────────────────────────────────────────────────

const registerSchema = z.object({
  first_name:    z.string().min(1, "First name is required"),
  last_name:     z.string().min(1, "Last name is required"),
  email:         z.string().email("Please enter a valid email"),
  password:      z.string().min(8, "Password must be at least 8 characters"),
  phone:         z.string().min(1, "Phone is required"),
  date_of_birth: z.string().min(1, "Date of birth is required"),
  gender:        z.string().min(1, "Gender is required"),
  city:          z.string().min(1, "City is required"),
  state:         z.string().min(1, "State is required"),
  clinic_id:     z.string().min(1, "Please select your clinic"),
});

type RegisterFormData = z.infer<typeof registerSchema>;

const GENDER_OPTIONS = [
  { value: "",                  label: "Select…" },
  { value: "male",              label: "Male" },
  { value: "female",            label: "Female" },
  { value: "other",             label: "Other" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

// ─── Shared label helper ──────────────────────────────────────────────────────

function FieldLabel({
  htmlFor,
  text,
  required,
  optional,
}: {
  htmlFor: string;
  text: string;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-neutral-700 mb-1.5">
      {text}
      {required && <span className="text-red-500 ml-0.5">*</span>}
      {optional && (
        <span className="ml-1 text-xs font-normal text-neutral-400">(optional)</span>
      )}
    </label>
  );
}

// ─── Shared input class ───────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 hover:border-neutral-400";

const inputErrCls =
  "w-full rounded-lg border border-danger-400 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-danger-500/20 focus:border-danger-500";

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="mt-1.5 text-xs text-danger-600">{msg}</p>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// ─── Smart clinic filter helper ───────────────────────────────────────────────
function getFilteredClinics(allClinics: any[], userCity?: string, userState?: string) {
  if (!allClinics.length) return allClinics;

  const userCityLower = userCity?.toLowerCase().trim() || "";
  const userStateLower = userState?.toLowerCase().trim() || "";

  if (!userCityLower && !userStateLower) {
    return allClinics;
  }

  // 1. Try to match by city (if user city is provided)
  if (userCityLower) {
    const cityClinics = allClinics.filter(
      (c) => c.city?.toLowerCase().trim() === userCityLower
    );
    if (cityClinics.length > 0) {
      return cityClinics;
    }
  }

  // 2. Try to match by state (if user state is provided and no city match)
  if (userStateLower) {
    const stateClinics = allClinics.filter(
      (c) => c.state?.toLowerCase().trim() === userStateLower
    );
    if (stateClinics.length > 0) {
      return stateClinics;
    }
  }

  // 3. Return all clinics if no matches
  return allClinics;
}

export default function RegisterPage() {
  const { isLoading, error, clearError, register } = useAuth();
  // Clinics come from the shared catalog cache — first visit fetches once,
  // subsequent renders (e.g. after a client-side navigation back) are instant.
  const { clinics, isLoading: clinicsLoading } = useClinics();
  const [successClinic, setSuccessClinic]   = useState<string | null>(null);

  const {
    register: field,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { gender: "" },
  });

  const selectedClinicId = watch("clinic_id");
  const userCity = watch("city");
  const userState = watch("state");
  const selectedClinic = clinics.find((c) => c.clinic_id === selectedClinicId);

  // Smart clinic filtering based on user location
  const filteredClinics = getFilteredClinics(clinics, userCity, userState);

  const onSubmit = async (data: RegisterFormData) => {
    clearError();
    const result = await register(data);
    if (registerThunk.fulfilled.match(result)) {
      setSuccessClinic(
        selectedClinic?.clinic_name ?? (result.payload as string) ?? "your clinic"
      );
    }
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (successClinic) {
    return (
      <div className="text-center space-y-5 py-4">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="w-9 h-9 text-green-600" />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">
            Registration submitted!
          </h2>
          <p className="text-sm text-neutral-500 mt-2 leading-relaxed">
            Your account has been submitted to{" "}
            <span className="font-semibold text-neutral-700">{successClinic}</span> for
            review. A receptionist will approve your account shortly.
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          You will be able to log in once your account is approved.
        </div>
        <Link
          href="/login"
          className="inline-block w-full text-center py-3 px-4 rounded-lg bg-neutral-900 text-white font-medium text-sm hover:bg-neutral-800 transition-colors"
        >
          Back to Login
        </Link>
      </div>
    );
  }

  // ── Registration form ─────────────────────────────────────────────────────
  return (
    <div className="w-full">
      {/* Heading */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">Create account</h2>
        <p className="text-sm text-neutral-500 mt-1">
          Patient self-registration — NeuroWellness PRS
        </p>
      </div>

      {/* API error */}
      {error && (
        <div className="mb-4 bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">

        {/* ── Name ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="first_name" text="First name" required />
            <input
              id="first_name"
              placeholder="Jane"
              autoComplete="given-name"
              {...field("first_name")}
              className={errors.first_name ? inputErrCls : inputCls}
            />
            <FieldError msg={errors.first_name?.message} />
          </div>
          <div>
            <FieldLabel htmlFor="last_name" text="Last name" required />
            <input
              id="last_name"
              placeholder="Smith"
              autoComplete="family-name"
              {...field("last_name")}
              className={errors.last_name ? inputErrCls : inputCls}
            />
            <FieldError msg={errors.last_name?.message} />
          </div>
        </div>

        {/* ── Email ──────────────────────────────────────────────────────── */}
        <div>
          <FieldLabel htmlFor="email" text="Email address" required />
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            {...field("email")}
            className={errors.email ? inputErrCls : inputCls}
          />
          <FieldError msg={errors.email?.message} />
        </div>

        {/* ── Password ───────────────────────────────────────────────────── */}
        <div>
          <FieldLabel htmlFor="password" text="Password" required />
          <input
            id="password"
            type="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            {...field("password")}
            className={errors.password ? inputErrCls : inputCls}
          />
          <FieldError msg={errors.password?.message} />
        </div>

        {/* ── Phone ──────────────────────────────────────────────────────── */}
        <div>
          <FieldLabel htmlFor="phone" text="Phone" required />
          <input
            id="phone"
            type="tel"
            placeholder="+91 98765 43210"
            autoComplete="tel"
            {...field("phone")}
            className={errors.phone ? inputErrCls : inputCls}
          />
          <FieldError msg={errors.phone?.message} />
        </div>

        {/* ── Date of birth + Gender ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="date_of_birth" text="Date of birth" required />
            <input
              id="date_of_birth"
              type="date"
              {...field("date_of_birth")}
              className={errors.date_of_birth ? inputErrCls : inputCls}
            />
            <FieldError msg={errors.date_of_birth?.message} />
          </div>
          <div>
            <FieldLabel htmlFor="gender" text="Gender" required />
            <div className="relative">
              <select
                id="gender"
                {...field("gender")}
                className={`${errors.gender ? inputErrCls : inputCls} appearance-none pr-9`}
              >
                {GENDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
            </div>
            <FieldError msg={errors.gender?.message} />
          </div>
        </div>

        {/* ── City + State ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel htmlFor="city" text="City" required />
            <input
              id="city"
              placeholder="Mumbai"
              {...field("city")}
              className={errors.city ? inputErrCls : inputCls}
            />
            <FieldError msg={errors.city?.message} />
          </div>
          <div>
            <FieldLabel htmlFor="state" text="State" required />
            <input
              id="state"
              placeholder="Maharashtra"
              {...field("state")}
              className={errors.state ? inputErrCls : inputCls}
            />
            <FieldError msg={errors.state?.message} />
          </div>
        </div>

        {/* ── Clinic (after city/state for smart filtering) ─────────────── */}
        <div>
          <FieldLabel htmlFor="clinic_id" text="Clinic" required />
          {clinicsLoading ? (
            <div className="flex items-center gap-2 h-10 px-3.5 border border-neutral-300 rounded-lg text-sm text-neutral-400">
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
              Loading clinics…
            </div>
          ) : (
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
              <select
                id="clinic_id"
                {...field("clinic_id")}
                className={`w-full pl-9 pr-9 py-2.5 border rounded-lg text-sm bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 hover:border-neutral-400 transition-all ${errors.clinic_id ? "border-danger-400" : "border-neutral-300"} text-neutral-900`}
              >
                <option value="">Select your clinic…</option>
                {filteredClinics.map((c) => (
                  <option key={c.clinic_id} value={c.clinic_id}>
                    {c.clinic_name}{c.city ? ` — ${c.city}` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
            </div>
          )}
          <FieldError msg={errors.clinic_id?.message} />
          {selectedClinic?.address && (
            <p className="mt-1 text-xs text-neutral-400">
              {selectedClinic.address}{selectedClinic.state ? `, ${selectedClinic.state}` : ""}
            </p>
          )}
        </div>

        {/* ── Submit ─────────────────────────────────────────────────────── */}
        <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
           Registration
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-500">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-primary-600 font-medium hover:text-primary-700 hover:underline transition-colors"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
