"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Button, Input, Select } from "@/components/ui";
import { useAuth } from "@/lib/hooks";
import { registerSchema, type RegisterFormData } from "@/lib/validators/auth.schema";
import { ROLE_LABELS } from "@/lib/constants";

const roleOptions = [
  { value: "patient",            label: ROLE_LABELS.patient },
  { value: "doctor",             label: ROLE_LABELS.doctor },
  { value: "clinical_assistant", label: ROLE_LABELS.clinical_assistant },
];

export default function RegisterPage() {
  const { register: registerUser, isLoading, error, clearError } = useAuth();
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: "patient" },
  });

  const onSubmit = (data: RegisterFormData) => {
    clearError();
    registerUser(data);
  };

  return (
    <div>
      <div className="mb-7">
        <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">Create account</h2>
        <p className="text-sm text-neutral-500 mt-1.5">Register for NeuroWellness PRS</p>
      </div>

      {error && (
        <div className="mb-5 bg-danger-50 border border-danger-100 text-danger-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="first_name"
            label="First name"
            placeholder="Jane"
            error={errors.first_name?.message}
            autoComplete="given-name"
            {...register("first_name")}
          />
          <Input
            id="last_name"
            label="Last name"
            placeholder="Smith"
            error={errors.last_name?.message}
            autoComplete="family-name"
            {...register("last_name")}
          />
        </div>
        <Input
          id="email"
          label="Email address"
          type="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          autoComplete="email"
          {...register("email")}
        />
        <Input
          id="phone"
          label="Phone"
          type="tel"
          placeholder="+1 (555) 000-0000"
          hint="Optional"
          autoComplete="tel"
          {...register("phone")}
        />
        <Input
          id="password"
          label="Password"
          type="password"
          placeholder="Create a password"
          error={errors.password?.message}
          autoComplete="new-password"
          {...register("password")}
        />
        <Select
          id="role"
          label="Role"
          options={roleOptions}
          error={errors.role?.message}
          {...register("role")}
        />
        <Button type="submit" className="w-full mt-1" size="lg" isLoading={isLoading}>
          Create Account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-500">
        Already have an account?{" "}
        <Link href="/login" className="text-primary-600 font-medium hover:text-primary-700 hover:underline transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  );
}
