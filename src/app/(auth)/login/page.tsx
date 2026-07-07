"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { useAuth } from "@/lib/hooks";
import { loginSchema, type LoginFormData } from "@/lib/validators/auth.schema";

export default function LoginPage() {
  const { login, isLoading, error, clearError, passwordChallenge, completeNewPassword, clearPasswordChallenge } = useAuth();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data: LoginFormData) => {
    clearError();
    login(data);
  };

  if (passwordChallenge) {
    return <NewPasswordForm onCancel={clearPasswordChallenge} onSubmit={completeNewPassword} isLoading={isLoading} error={error} />;
  }

  return (
    <div>
      <div className="mb-7">
        <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">Welcome Back</h2>
        <p className="text-sm text-neutral-500 mt-1.5">Sign in to your Anava account</p>
      </div>

      {error && (
        <div
          className={`mb-5 px-4 py-3 rounded-lg text-sm border ${
            error === "You will be able to log in once your account is approved."
              ? "bg-amber-50 border-amber-200 text-amber-800"
              : error === "Your account has been rejected. Please contact reception."
              ? "bg-orange-50 border-orange-200 text-orange-800"
              : "bg-danger-50 border-danger-100 text-danger-700"
          }`}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          id="username"
          label="Email or Mobile Number"
          type="text"
          placeholder="you@example.com or +91XXXXXXXXXX"
          error={errors.username?.message}
          autoComplete="username"
          {...register("username")}
        />
        <Input
          id="password"
          label="Password"
          type="password"
          placeholder="Enter your password"
          error={errors.password?.message}
          autoComplete="current-password"
          {...register("password")}
        />
        <Button type="submit" className="w-full mt-1" size="lg" isLoading={isLoading}>
          Sign in
        </Button>
      </form>

      <div className="mt-6">
        <p className="text-center text-sm text-neutral-500 mb-3">Don&apos;t have an account?</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/register?method=email"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-neutral-300 text-sm font-medium text-neutral-700 hover:bg-neutral-50 hover:border-neutral-400 transition-colors"
          >
            <Mail className="w-4 h-4" />Sign up with Email
          </Link>
          <Link
            href="/register?method=mobile"
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-neutral-300 text-sm font-medium text-neutral-700 hover:bg-neutral-50 hover:border-neutral-400 transition-colors"
          >
            <Phone className="w-4 h-4" />Sign up with Mobile Number
          </Link>
        </div>
      </div>
    </div>
  );
}

// Cognito's NEW_PASSWORD_REQUIRED challenge — fires on a staff account's
// first login (the temp password Cognito auto-emailed after AdminCreateUser).
function NewPasswordForm({
  onCancel, onSubmit, isLoading, error,
}: {
  onCancel: () => void;
  onSubmit: (newPassword: string) => void;
  isLoading: boolean;
  error: string | null;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) { setLocalError("Password must be at least 8 characters"); return; }
    if (newPassword !== confirmPassword) { setLocalError("Passwords do not match"); return; }
    setLocalError(null);
    onSubmit(newPassword);
  };

  return (
    <div>
      <div className="mb-7">
        <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">Set your password</h2>
        <p className="text-sm text-neutral-500 mt-1.5">
          This is your first sign-in — choose a new password to replace the temporary one we emailed you.
        </p>
      </div>

      {(localError || error) && (
        <div className="mb-5 px-4 py-3 rounded-lg text-sm border bg-danger-50 border-danger-100 text-danger-700">
          {localError || error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="new_password"
          label="New password"
          type="password"
          placeholder="At least 8 characters"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <Input
          id="confirm_password"
          label="Confirm new password"
          type="password"
          placeholder="Re-enter your new password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <div className="flex gap-3">
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Back to sign in</Button>
          <Button type="submit" className="flex-1" isLoading={isLoading}>Set Password</Button>
        </div>
      </form>
    </div>
  );
}
