"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { useAuth } from "@/lib/hooks";
import { loginSchema, type LoginFormData } from "@/lib/validators/auth.schema";

export default function LoginPage() {
  const { login, isLoading, error, clearError } = useAuth();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data: LoginFormData) => {
    clearError();
    login(data);
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-neutral-900">Welcome back</h2>
        <p className="text-sm text-neutral-500 mt-1">Sign in to your NeuroWellness PRS account</p>
      </div>

      {error && (
        <div className="mb-4 bg-danger-50 text-danger-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          id="email"
          label="Email"
          type="email"
          placeholder="you@example.com"
          error={errors.email?.message}
          {...register("email")}
        />
        <Input
          id="password"
          label="Password"
          type="password"
          placeholder="Enter your password"
          error={errors.password?.message}
          {...register("password")}
        />
        <Button type="submit" className="w-full" size="lg" isLoading={isLoading}>
          Sign In
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-neutral-500">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-primary-600 font-medium hover:underline">
          Register
        </Link>
      </p>
    </div>
  );
}
