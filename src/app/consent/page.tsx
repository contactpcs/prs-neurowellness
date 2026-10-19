"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Brain, UserRound } from "lucide-react";
import { useAuth } from "@/lib/hooks";
import { Button } from "@/components/ui";
import { ROUTES } from "@/lib/constants";
import { consentService, type ConsentDocument } from "@/lib/api/services/consent.service";

const GUARDIAN_REASON_LABEL: Record<string, string> = {
  minor: "the patient is under 18",
  lacks_capacity: "the patient cannot consent for themselves",
  lawful_guardian: "you are the patient's lawful guardian",
  nominated_representative: "you are the patient's nominated representative",
};

function errorMessage(err: any, fallback: string): string {
  return err?.response?.data?.error?.message || err?.response?.data?.detail || fallback;
}

export default function ConsentPage() {
  const { user, isRestoring, logout, completeConsent } = useAuth();
  const router = useRouter();

  const [doc, setDoc] = useState<ConsentDocument | null>(null);
  const [ticked, setTicked] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A ref, not state: blocks a second click that lands before React has
  // re-rendered the disabled button.
  const signingRef = useRef(false);

  const isPatient = user?.roles.includes("patient") ?? false;
  // An active patient here was asked to re-consent to a new version; they go
  // back to the portal afterwards, not into the registration wizard.
  const reconsent = isPatient && user?.is_active === true;

  async function proceedPastConsent() {
    if (isPatient && !reconsent) {
      // Signing does not activate a new patient — the registration wizard
      // continues (consent/service.py::sign).
      router.push("/patient-registration/anamnesis");
      return;
    }
    await completeConsent();
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const pending = await consentService.getMyPending();
      if (!pending) {
        await proceedPastConsent();
        return;
      }
      setDoc(pending);
      setTicked({});
    } catch (err) {
      setError(errorMessage(err, "Could not load your consent form. Try refreshing."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isRestoring) return;
    if (!user) { router.replace(ROUTES.LOGIN); return; }
    if (user.is_active && user.consent_signed !== false) { router.replace(ROUTES.LOGIN); return; }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestoring, user?.id]);

  const requiredMissing = doc ? doc.clauses.some((c) => c.required && !ticked[c.code]) : true;

  async function handleSign() {
    if (!doc || requiredMissing || signingRef.current) return;
    signingRef.current = true;
    setSigning(true);
    setError(null);
    let leaving = false;
    try {
      const accepted = doc.clauses.filter((c) => ticked[c.code]).map((c) => c.code);
      await consentService.sign(doc.consent_id, accepted, doc.rendered_hash);
      // Another consent may be waiting (e.g. a transfer); show it next.
      const next = await consentService.getMyPending();
      if (next) {
        setDoc(next);
        setTicked({});
      } else {
        leaving = true; // navigating away — keep the spinner up instead of flashing the form
        await proceedPastConsent();
      }
    } catch (err: any) {
      if (err?.response?.data?.error?.code === "CONSENT_TEXT_CHANGED") {
        setError("This form was updated while you were reading it. Please review the new version.");
        await load();
      } else {
        setError(errorMessage(err, "Failed to sign — please try again."));
      }
    } finally {
      if (!leaving) setSigning(false);
      signingRef.current = false;
    }
  }

  if (isRestoring || loading) {
    return <div className="min-h-screen flex items-center justify-center text-neutral-400 text-sm">Loading…</div>;
  }

  if (signing) {
    return (
      <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-neutral-200 border-t-indigo-600 rounded-full animate-spin" />
        <p className="text-sm text-neutral-500">Recording your consent…</p>
      </div>
    );
  }

  const signer = doc?.signer;
  const guardian = signer?.signer_type === "guardian";

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-card border border-neutral-200/80 p-6 sm:p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-8 h-8 rounded-lg bg-brand-gradient flex items-center justify-center">
            <Brain className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-accent-dark">Anava</span>
        </div>

        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-5 w-5 text-indigo-600" />
          <h1 className="text-lg font-bold text-neutral-900">{doc?.title ?? "Consent"}</h1>
        </div>
        <p className="text-xs text-neutral-400 mb-4">Version {doc?.version}</p>

        {reconsent && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
            Our consent form has been updated. Please review and confirm it to keep using your account.
          </p>
        )}

        {guardian && signer && (
          <div className="flex items-start gap-2 text-sm text-blue-800 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 mb-4">
            <UserRound className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              You are giving this consent as <strong>{signer.name}</strong>
              {signer.relation ? ` (${signer.relation})` : ""} on behalf of <strong>{signer.on_behalf_of}</strong>
              {signer.guardian_reason && GUARDIAN_REASON_LABEL[signer.guardian_reason] ? `, because ${GUARDIAN_REASON_LABEL[signer.guardian_reason]}` : ""}.
            </span>
          </div>
        )}

        {doc && (
          <div className="max-h-72 overflow-y-auto text-sm text-neutral-700 bg-neutral-50 border border-neutral-200 rounded-lg p-4 mb-4 whitespace-pre-wrap">
            {doc.content}
          </div>
        )}

        {doc && (
          <div className="space-y-3 mb-4">
            {doc.clauses.map((c) => (
              <label key={c.code} className="flex items-start gap-2.5 text-sm text-neutral-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!ticked[c.code]}
                  onChange={(e) => setTicked((t) => ({ ...t, [c.code]: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 rounded border-neutral-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span>
                  {c.label}
                  {c.required
                    ? <span className="text-red-500"> *</span>
                    : <span className="text-xs text-neutral-400"> (optional)</span>}
                </span>
              </label>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>}

        <p className="text-xs text-neutral-400 mb-4">
          Your answers, the time, and your device and network address are recorded with this consent. You can download a copy from your profile.
        </p>

        <div className="flex justify-between items-center">
          <button onClick={logout} className="text-xs text-neutral-400 hover:text-neutral-600">Log out</button>
          <Button disabled={!doc || requiredMissing} onClick={handleSign}>
            I agree
          </Button>
        </div>
      </div>
    </div>
  );
}
