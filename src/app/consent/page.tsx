"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Brain } from "lucide-react";
import { useAuth } from "@/lib/hooks";
import { Button } from "@/components/ui";
import { ROUTES } from "@/lib/constants";
import { consentService, type ConsentRecord, type ConsentTemplate } from "@/lib/api/services/consent.service";

export default function ConsentPage() {
  const { user, isRestoring, logout, completeConsent } = useAuth();
  const router = useRouter();

  const [template, setTemplate] = useState<ConsentTemplate | null>(null);
  const [record, setRecord] = useState<ConsentRecord | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A ref, not state — state updates are async (don't hit the DOM until the
  // next render), so a `signing` state flag alone can't stop a second click
  // that lands before React has actually disabled the button. handleSign is
  // async and yields at its first `await`, which is exactly the gap a fast
  // double-click (or a trackpad/touch double-fire) can slip through. A ref
  // updates synchronously, so this genuinely blocks a second concurrent call
  // no matter how fast the clicks are or when React gets around to painting.
  const signingRef = useRef(false);

  async function proceedPastConsent() {
    if (user?.roles.includes("patient")) {
      // Every patient (self- or staff-registered) stays inactive through
      // the whole registration-test wizard — signing here does NOT
      // activate the account (see consent/service.py::sign), so don't
      // refresh/redirect into a portal that would reject them. Just move
      // to the next step.
      router.push("/patient-registration/anamnesis");
      return;
    }
    // Backend already flipped profiles.is_active=TRUE in the same
    // transaction — re-read /auth/me and go straight into the portal,
    // no re-login needed.
    await completeConsent();
  }

  useEffect(() => {
    if (isRestoring) return;
    if (!user) { router.replace(ROUTES.LOGIN); return; }
    if (user.is_active) { router.replace(ROUTES.LOGIN); return; }

    const consentType = user.consent_type_required ?? (user.roles.includes("patient") ? "patient_onboarding" : "staff_onboarding");
    const role = user.roles[0] ?? "patient";
    Promise.all([
      // staff_onboarding templates are per-role now — patient_onboarding has
      // no role split, so pass role only for the staff case.
      consentService.getTemplate(consentType, consentType === "patient_onboarding" ? null : role),
      consentService.getMyPending(user.id, role),
    ])
      .then(async ([tpl, rec]) => {
        setTemplate(tpl);
        if (rec) { setRecord(rec); return; }
        // No PENDING record doesn't necessarily mean no record ever existed —
        // it can also mean this one already got signed (e.g. a duplicate
        // sign request got through, or the user landed back here after
        // already finishing) and there's genuinely nothing left to sign.
        // Check for that before showing a dead-end "contact admin" error.
        const idParam = role === "patient" ? { patient_id: user.id } : { staff_id: user.id };
        const all = await consentService.listForSubject(idParam);
        const alreadySigned = all.find((r) => r.consent_type === consentType && r.status === "signed");
        if (alreadySigned) {
          await proceedPastConsent();
          return;
        }
        setError("No pending consent record found for your account — contact your clinic admin.");
      })
      .catch(() => setError("Could not load your consent form. Try refreshing."))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestoring, user, router]);

  async function handleSign() {
    if (!record || !agreed || signingRef.current) return;
    signingRef.current = true;
    setSigning(true);
    setError(null);
    try {
      await consentService.sign(record.consent_id, {
        signature_data: `${user?.first_name} ${user?.last_name} — agreed ${new Date().toISOString()}`,
      });
      await proceedPastConsent();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.detail || "Failed to sign — please try again.");
    } finally {
      setSigning(false);
      signingRef.current = false;
    }
  }

  if (isRestoring || loading) {
    return <div className="min-h-screen flex items-center justify-center text-neutral-400 text-sm">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-card border border-neutral-200/80 p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-lg bg-brand-gradient flex items-center justify-center">
            <Brain className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-accent-dark">Anava PRS</span>
        </div>

        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="h-5 w-5 text-indigo-600" />
          <h1 className="text-lg font-bold text-neutral-900">{template?.title ?? "Onboarding Consent"}</h1>
        </div>
        <p className="text-sm text-neutral-500 mb-4">
          You need to sign this before you can use your account.
        </p>

        {template?.content && (
          <div className="max-h-64 overflow-y-auto text-sm text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg p-4 mb-4 whitespace-pre-wrap">
            {template.content}
          </div>
        )}

        <label className="flex items-start gap-2 text-sm text-neutral-700 mb-4">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5" />
          I have read and agree to the terms above.
        </label>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>}

        <div className="flex justify-between items-center">
          <button onClick={logout} className="text-xs text-neutral-400 hover:text-neutral-600">Log out</button>
          <Button disabled={!agreed || !record || signing} onClick={handleSign}>
            {signing ? "Signing…" : "Sign & Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
