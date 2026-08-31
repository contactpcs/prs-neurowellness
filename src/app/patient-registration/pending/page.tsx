"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle } from "lucide-react";
import { useAuth } from "@/lib/hooks";
import { ROUTES } from "@/lib/constants";

export default function RegistrationPendingPage() {
  const { user, isRestoring, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isRestoring) return;
    if (!user) { router.replace(ROUTES.LOGIN); return; }
  }, [isRestoring, user, router]);

  if (isRestoring || !user) {
    return <div className="min-h-screen flex items-center justify-center text-neutral-400 text-sm">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-card border border-neutral-200/80 p-8 text-center space-y-5">
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="w-9 h-9 text-green-600" />
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 tracking-tight">Registration Complete!</h2>
          <p className="text-sm text-neutral-500 mt-2 leading-relaxed">
            You've completed every step. A receptionist at your clinic will review your registration and approve your
            account before you can sign in.
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          You'll be able to log in once your account is approved.
        </div>
        <button
          onClick={logout}
          className="inline-block w-full text-center py-3 px-4 rounded-lg bg-neutral-900 text-white font-medium text-sm hover:bg-neutral-800 transition-colors"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}
