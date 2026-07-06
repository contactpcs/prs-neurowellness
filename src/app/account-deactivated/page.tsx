"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldOff, Brain } from "lucide-react";
import { useAuth } from "@/lib/hooks";
import { Button } from "@/components/ui";
import { ROUTES } from "@/lib/constants";

export default function AccountDeactivatedPage() {
  const { user, isRestoring, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isRestoring) return;
    if (!user) { router.replace(ROUTES.LOGIN); return; }
    // Only a genuinely deactivated (previously-active, consent already
    // signed) account belongs here — anyone still mid-onboarding gets sent
    // back to the real consent screen instead.
    if (user.is_active !== false || user.consent_signed === false) {
      router.replace(ROUTES.LOGIN);
    }
  }, [isRestoring, user, router]);

  if (isRestoring) {
    return <div className="min-h-screen flex items-center justify-center text-neutral-400 text-sm">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-card border border-neutral-200/80 p-8 text-center">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-lg bg-brand-gradient flex items-center justify-center">
            <Brain className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-accent-dark">Anava PRS</span>
        </div>

        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <ShieldOff className="h-7 w-7 text-red-600" />
        </div>

        <h1 className="text-lg font-bold text-neutral-900 mb-2">Your account has been deactivated</h1>
        <p className="text-sm text-neutral-500 mb-6">
          Your profile has been set to inactive. Please contact your clinic admin or regional admin to have your account reactivated.
        </p>

        <Button variant="outline" onClick={logout}>Log out</Button>
      </div>
    </div>
  );
}
