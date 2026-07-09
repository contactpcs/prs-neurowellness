"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, Phone, X } from "lucide-react";
import { useAuth } from "@/lib/hooks";

/** Cognito-mode patient signup only leaves ONE channel verified — this
 * nudges toward the dedicated /patient/verify-channel screen rather than
 * blocking the dashboard, since it's account-security housekeeping, not a
 * registration step nothing else depends on. Renders nothing once both are
 * verified (which is always true in local dev / for staff — see /auth/me). */
export function VerifyChannelBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !user) return null;
  const missingEmail = user.email_verified === false;
  const missingPhone = user.phone_verified === false;
  if (!missingEmail && !missingPhone) return null;

  const label = missingEmail ? "email" : "mobile number";

  return (
    <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          {missingEmail ? <Mail className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" /> : <Phone className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800">Verify your {label}</p>
            <p className="text-xs text-amber-700 mt-0.5">
              You signed up with your {missingEmail ? "mobile number" : "email"} — add and verify your {label} too, so you can sign in with either.
            </p>
            <Link href="/patient/profile" className="mt-2 inline-block text-xs font-semibold text-amber-800 hover:underline">
              Verify now
            </Link>
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="text-amber-400 hover:text-amber-600 flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
