"use client";

import { useState } from "react";
import { Mail, Phone, X } from "lucide-react";
import { useAuth } from "@/lib/hooks";
import { authService } from "@/lib/api/services/auth.service";
import { updateUserInStore } from "@/store/slices/authSlice";
import { useAppDispatch } from "@/store/hooks";

/** Cognito-mode patient signup only leaves ONE channel verified — this
 * prompts for the other (email if they signed up with mobile, or vice
 * versa) right on the dashboard rather than blocking the registration
 * wizard, since it's account-security housekeeping, not a registration
 * step nothing else depends on. Renders nothing once both are verified
 * (which is always true in local dev / for staff — see /auth/me). */
export function VerifyChannelBanner() {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const [dismissed, setDismissed] = useState(false);
  const [step, setStep] = useState<"prompt" | "value" | "otp">("prompt");
  const [value, setValue] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (dismissed || !user) return null;
  const missingEmail = user.email_verified === false;
  const missingPhone = user.phone_verified === false;
  if (!missingEmail && !missingPhone) return null;

  // Only one of these is ever true for a given account (the OTP wizard
  // always verifies the signup channel immediately) — pick whichever it is.
  const attribute: "email" | "phone_number" = missingEmail ? "email" : "phone_number";
  const label = missingEmail ? "email" : "mobile number";

  const onSendCode = async () => {
    if (!value.trim()) { setError(`Enter your ${label}`); return; }
    setError(null);
    setBusy(true);
    try {
      await authService.verifyChannelStart(attribute, value.trim());
      setStep("otp");
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Could not send verification code");
    } finally {
      setBusy(false);
    }
  };

  const onConfirm = async () => {
    if (!otp.trim()) { setError("Enter the code we sent you"); return; }
    setError(null);
    setBusy(true);
    try {
      await authService.verifyChannelConfirm(attribute, otp.trim(), value.trim());
      dispatch(updateUserInStore(missingEmail ? { email_verified: true } : { phone_verified: true }));
      setDismissed(true);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Incorrect or expired code");
    } finally {
      setBusy(false);
    }
  };

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

            {step === "prompt" && (
              <button onClick={() => setStep("value")} className="mt-2 text-xs font-semibold text-amber-800 hover:underline">
                Verify now
              </button>
            )}

            {step === "value" && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type={missingEmail ? "email" : "tel"}
                  placeholder={missingEmail ? "you@example.com" : "+91XXXXXXXXXX"}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="flex-1 max-w-xs px-2.5 py-1.5 text-xs border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
                <button onClick={onSendCode} disabled={busy} className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50">
                  {busy ? "Sending…" : "Send code"}
                </button>
              </div>
            )}

            {step === "otp" && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  inputMode="numeric"
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="flex-1 max-w-[140px] px-2.5 py-1.5 text-xs border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
                <button onClick={onConfirm} disabled={busy} className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50">
                  {busy ? "Confirming…" : "Confirm"}
                </button>
              </div>
            )}

            {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
          </div>
        </div>
        <button onClick={() => setDismissed(true)} className="text-amber-400 hover:text-amber-600 flex-shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
