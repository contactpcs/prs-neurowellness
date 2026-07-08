"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Phone, ShieldCheck, ArrowLeft } from "lucide-react";
import { useAuth } from "@/lib/hooks";
import { useAppDispatch } from "@/store/hooks";
import { authService } from "@/lib/api/services/auth.service";
import { updateUserInStore } from "@/store/slices/authSlice";

const BRAND = "linear-gradient(135deg, #00A1E4 0%, #17749B 100%)";
const BRAND_PRIMARY = "#00A1E4";

/** Full-screen version of the dashboard's channel-verification nudge —
 * same two Cognito calls (verifyChannelStart / verifyChannelConfirm), just
 * a dedicated destination instead of an inline banner, for patients who
 * signed up with only one of email/mobile and want to add the other. */
export default function VerifyChannelPage() {
  const { user } = useAuth();
  const dispatch = useAppDispatch();
  const router = useRouter();

  const missingEmail = user?.email_verified === false;
  const missingPhone = user?.phone_verified === false;

  const [target, setTarget] = useState<"email" | "phone_number" | null>(
    missingEmail ? "email" : missingPhone ? "phone_number" : null,
  );
  const [step, setStep] = useState<"value" | "otp">("value");
  const [value, setValue] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ email: boolean; phone: boolean }>({ email: !missingEmail, phone: !missingPhone });

  if (!user) return null;

  if (!target || (done.email && done.phone)) {
    return (
      <div className="max-w-md mx-auto text-center py-20">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-7 h-7 text-green-600" />
        </div>
        <h1 className="text-xl font-bold text-neutral-900 mb-1.5">Both channels verified</h1>
        <p className="text-sm text-neutral-500 mb-6">You can sign in with either your email or mobile number.</p>
        <button onClick={() => router.push("/patient/dashboard")}
          className="px-5 py-2.5 rounded-lg text-white text-sm font-semibold hover:opacity-90" style={{ background: BRAND }}>
          Back to dashboard
        </button>
      </div>
    );
  }

  const label = target === "email" ? "email" : "mobile number";
  const otherLabel = target === "email" ? "mobile number" : "email";

  const onSendCode = async () => {
    if (!value.trim()) { setError(`Enter your ${label}`); return; }
    setError(null); setBusy(true);
    try {
      await authService.verifyChannelStart(target, value.trim());
      setStep("otp");
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Could not send verification code");
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-md mx-auto py-10">
      <button onClick={() => router.push("/patient/dashboard")}
        className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to dashboard
      </button>

      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4" style={{ background: BRAND }}>
        {target === "email" ? <Mail className="w-6 h-6 text-white" /> : <Phone className="w-6 h-6 text-white" />}
      </div>

      <h1 className="text-xl font-bold text-neutral-900 mb-1.5">Verify your {label}</h1>
      <p className="text-sm text-neutral-500 mb-6">
        You signed up with your {otherLabel} — add and verify your {label} too, so you can sign in with either.
      </p>

      {step === "value" && (
        <div className="space-y-3">
          <input
            type={target === "email" ? "email" : "tel"}
            placeholder={target === "email" ? "you@example.com" : "+91XXXXXXXXXX"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-lg border border-neutral-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-sky-400"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button onClick={onSendCode} disabled={busy}
            className="w-full py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90" style={{ background: BRAND }}>
            {busy ? "Sending…" : "Send verification code"}
          </button>
        </div>
      )}

      {step === "otp" && (
        <div className="space-y-3">
          <p className="text-xs text-neutral-400">Code sent to {value}</p>
          <input
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            value={otp}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 6);
              setOtp(v);
              if (v.length === 6 && !busy) onConfirmWith(v);
            }}
            className="w-full rounded-lg border border-neutral-200 px-3.5 py-2.5 text-sm text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:border-sky-400"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button onClick={onSendCode} disabled={busy} className="text-xs font-medium" style={{ color: BRAND_PRIMARY }}>
            Resend code
          </button>
        </div>
      )}
    </div>
  );

  async function onConfirmWith(code: string) {
    setOtp(code);
    if (code.trim().length !== 6) return;
    setError(null); setBusy(true);
    try {
      await authService.verifyChannelConfirm(target!, code, value.trim());
      dispatch(updateUserInStore(target === "email" ? { email_verified: true } : { phone_verified: true }));
      const nextDone = { ...done, [target === "email" ? "email" : "phone"]: true };
      setDone(nextDone);
      if (target === "email" && !nextDone.phone) { setTarget("phone_number"); setStep("value"); setValue(""); setOtp(""); }
      else if (target === "phone_number" && !nextDone.email) { setTarget("email"); setStep("value"); setValue(""); setOtp(""); }
      else { setTarget(null); }
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Incorrect or expired code");
    } finally { setBusy(false); }
  }
}
