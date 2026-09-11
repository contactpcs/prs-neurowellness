"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  User,
  Check, X, AlertCircle, Stethoscope, Edit2, ChevronRight,
  Mail, Phone, FileText, Upload, Download, ShieldCheck, FileSignature,
} from "lucide-react";
import { PageLoader, Modal } from "@/components/ui";
import { usersService, NoSupportedFieldsError } from "@/lib/api/services/users.service";
import { authService } from "@/lib/api/services/auth.service";
import { patientFilesService, type PatientFile } from "@/lib/api/services/patientFiles.service";
import { consentService, type ConsentRecord } from "@/lib/api/services/consent.service";
import { extractErrorMessage } from "@/lib/api/errors";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { updateUserInStore } from "@/store/slices/authSlice";
import { fetchMyDoctor, selectMyDoctor, invalidateDashboard } from "@/store/slices/patientsSlice";
import { useAuth, useMyAssessments } from "@/lib/hooks";
import { computeProfileCompletion } from "@/lib/profileCompletion";
import { dialCodeForCountry } from "@/lib/countries";

// ─── helpers ──────────────────────────────────────────────────────

function computeAge(dob?: string): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) age--;
  return age;
}

function buildDiff(
  current: Record<string, string>,
  original: Record<string, string>,
): Record<string, string> {
  const diff: Record<string, string> = {};
  for (const [k, v] of Object.entries(current)) {
    if (v !== (original[k] ?? "")) diff[k] = v;
  }
  return diff;
}

const EMPTY_FORM = {
  full_name: "",
  date_of_birth: "", gender: "",
  government_id: "", id_type: "", language_pref: "",
  address_line1: "", city: "", state: "", country: "", pincode: "",
  blood_group: "", allergies: "", emergency_contact: "", emergency_contact_phone: "",
  occupation: "", marital_status: "",
  insurance_provider: "", insurance_policy: "",
  weight_kg: "", height_ft: "", height_in: "",
};

type FormState = typeof EMPTY_FORM;
type TabId = "personal" | "medical" | "verification" | "consents";

// ─── styles ───────────────────────────────────────────────────────

const BRAND_PRIMARY = "#00A1E4";
const BRAND = "linear-gradient(135deg, #00A1E4 0%, #09172E 100%)";
const inputCls =
  "w-full rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-all focus:outline-none focus:ring-2 focus:border-sky-400 hover:border-neutral-300";
const labelCls = "text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1.5 block";

function FieldInput({
  label, value, onChange, type = "text", placeholder, readOnly, numeric,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; readOnly?: boolean;
  /** Digits only, one optional decimal point (weight, dimensions) — strips
   * anything else as it's typed rather than validating after the fact, so
   * a letter or symbol never lands in the field at all. */
  numeric?: boolean;
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <input
        type={type}
        inputMode={numeric ? "decimal" : undefined}
        className={readOnly ? `${inputCls} bg-neutral-50 cursor-default` : inputCls}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        onChange={(e) => onChange(numeric ? sanitizeNumeric(e.target.value) : e.target.value)}
      />
    </div>
  );
}

// Keeps digits and at most one decimal point — matches how a weight/height
// field is actually typed, rather than a strict number parse that would
// reject a bare "72." while the patient is still mid-keystroke on "72.5".
function sanitizeNumeric(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
}

// read-only display row (label → value table style)
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between py-2.5 gap-4 border-b border-neutral-100 last:border-b-0">
      <span className="text-sm text-neutral-400 flex-shrink-0 w-40">{label}</span>
      <span className="text-sm font-semibold text-neutral-900 text-right">{value || "—"}</span>
    </div>
  );
}

const BLOOD_GROUP_OPTIONS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

const ID_TYPE_OPTIONS = [
  { value: "aadhaar",  label: "Aadhaar" },
  { value: "passport", label: "Passport" },
];

const TABS: { id: TabId; label: string; Icon: React.ElementType }[] = [
  { id: "personal",     label: "Personal Information",   Icon: User        },
  { id: "medical",      label: "Medical History/Files",  Icon: FileText    },
  { id: "verification", label: "Verification",           Icon: ShieldCheck },
  { id: "consents",     label: "Consents",                Icon: FileSignature },
];

// ─── inline channel verification (Overview tab — Cognito mode only) ─
// Same two calls the old dedicated /patient/verify-channel screen used;
// consolidated here per explicit request — no separate page.
function ChannelVerification({
  emailVerified, phoneVerified, hasEmail, hasPhone, country,
}: { emailVerified?: boolean; phoneVerified?: boolean; hasEmail: boolean; hasPhone: boolean; country?: string }) {
  const dispatch = useAppDispatch();
  // phone_verified/email_verified default to `true` in the auth store when
  // the backend sends nothing for them (staff accounts never go through
  // OTP, so "unset" reading as "verified" is the right default there) — but
  // for a patient with literally no phone/email on file yet, that same
  // default means "verified" when there is nothing to have verified. Only
  // treat a channel as missing when it's both present and explicitly
  // unverified, or entirely absent (needs adding + verifying from scratch).
  const missingEmail = emailVerified === false || !hasEmail;
  const missingPhone = phoneVerified === false || !hasPhone;
  const [target, setTarget] = useState<"email" | "phone_number" | null>(
    missingEmail ? "email" : missingPhone ? "phone_number" : null,
  );
  const [value, setValue] = useState("");
  const [otpOpen, setOtpOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [duplicateOpen, setDuplicateOpen] = useState(false);

  if (!missingEmail && !missingPhone) return null;
  if (!target) return null;

  const label = target === "email" ? "email" : "mobile number";
  const otherLabel = target === "email" ? "mobile number" : "email";
  const dialCode = dialCodeForCountry(country);
  // Cognito needs E.164 (+<dial code><digits>) — country is already known
  // from registration, so the digits-only input is all the patient types;
  // no separate "type your country code" step.
  const fullValue = target === "phone_number" ? `${dialCode}${value.replace(/\D/g, "")}` : value.trim();

  const closeModal = () => { setOtpOpen(false); setOtp(""); setError(null); setResendMessage(null); };

  const onSendCode = async () => {
    if (!value.trim()) { setError(`Enter your ${label}`); return; }
    if (target === "phone_number") {
      const digits = value.replace(/\D/g, "");
      // E.164's own national-number bound (7-15 digits) — not a per-country
      // exact length, since dialCode already varies by the patient's own
      // country. Catches the actual bug: a 1-2 digit typo or a pasted
      // non-numeric string was passing straight through to Cognito before,
      // since the only prior check was "is the field non-empty."
      if (digits.length < 7 || digits.length > 15) {
        setError("Enter a valid mobile number");
        return;
      }
    } else if (!/^\S+@\S+\.\S+$/.test(value.trim())) {
      setError("Enter a valid email address");
      return;
    }
    setError(null); setBusy(true);
    try {
      await authService.verifyChannelStart(target, fullValue);
      setOtpOpen(true);
    } catch (e: any) {
      // Backend already checks profiles for this value up front (before
      // ever calling Cognito) and raises PHONE_ALREADY_EXISTS/
      // EMAIL_ALREADY_EXISTS specifically — surfaced as its own popup
      // instead of folding into the generic inline error line, since "this
      // number belongs to another account" is a distinct, actionable case
      // (try a different number) rather than a transient send failure.
      const code = e?.response?.data?.error?.code;
      if (code === "PHONE_ALREADY_EXISTS" || code === "EMAIL_ALREADY_EXISTS") {
        setDuplicateOpen(true);
      } else {
        setError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Could not send verification code");
      }
    } finally { setBusy(false); }
  };

  const onResend = async () => {
    setError(null); setResendMessage(null); setResending(true);
    try {
      await authService.verifyChannelStart(target, fullValue);
      setResendMessage("Code resent.");
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Could not resend code");
    } finally { setResending(false); }
  };

  const onConfirmWith = async (code: string) => {
    if (code.trim().length !== 6) return;
    setError(null); setBusy(true);
    try {
      await authService.verifyChannelConfirm(target, code, fullValue);
      dispatch(updateUserInStore(target === "email" ? { email_verified: true } : { phone_verified: true }));
      closeModal();
      const otherStillMissing = target === "email" ? missingPhone : missingEmail;
      if (otherStillMissing) { setTarget(target === "email" ? "phone_number" : "email"); setValue(""); }
      else { setTarget(null); }
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Incorrect or expired code");
    } finally { setBusy(false); }
  };

  return (
    <>
      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
        <div className="flex items-start gap-2.5">
          {target === "email" ? <Mail className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" /> : <Phone className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">Verify your {label}</p>
            <p className="text-xs text-amber-700 mt-0.5">
              You signed up with your {otherLabel} — add and verify your {label} too, so you can sign in with either.
            </p>

            <div className="mt-2 flex items-center gap-2">
              {target === "email" ? (
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="flex-1 max-w-xs px-2.5 py-1.5 text-xs border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                />
              ) : (
                <div className="flex items-center gap-1.5 max-w-xs flex-1">
                  <span className="flex items-center justify-center px-2 py-1.5 rounded-lg border border-amber-300 bg-white text-xs text-amber-700 flex-shrink-0">
                    {dialCode}
                  </span>
                  <input
                    type="tel"
                    placeholder="XXXXXXXXXX"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className="flex-1 min-w-0 px-2.5 py-1.5 text-xs border border-amber-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                  />
                </div>
              )}
              <button onClick={onSendCode} disabled={busy} className="px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50 flex-shrink-0">
                {busy ? "Sending…" : "Verify"}
              </button>
            </div>

            {error && !otpOpen && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
          </div>
        </div>
      </div>

      <Modal isOpen={otpOpen} onClose={closeModal} title={`Verify your ${label}`}>
        <div className="space-y-3">
          <p className="text-sm text-neutral-600">
            Enter the 6-digit code sent to <span className="font-semibold text-neutral-900">{fullValue}</span>.
          </p>
          <input
            inputMode="numeric" maxLength={6} placeholder="123456" value={otp} autoFocus
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 6);
              setOtp(v);
              if (v.length === 6 && !busy) onConfirmWith(v);
            }}
            className="w-full text-center tracking-[0.5em] text-lg font-semibold px-3 py-2.5 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-300"
          />
          {busy && <p className="text-xs text-neutral-500">Confirming…</p>}
          {error && <p className="text-xs text-red-600">{error}</p>}
          {resendMessage && !error && <p className="text-xs text-success-600">{resendMessage}</p>}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={onResend}
              disabled={resending || busy}
              className="text-xs font-semibold text-primary-600 hover:text-primary-700 disabled:opacity-50"
            >
              {resending ? "Resending…" : "Resend code"}
            </button>
            <button
              onClick={() => onConfirmWith(otp)}
              disabled={otp.length !== 6 || busy}
              className="px-4 py-2 text-xs font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              Verify
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={duplicateOpen} onClose={() => setDuplicateOpen(false)} title={`${target === "email" ? "Email" : "Phone number"} already in use`}>
        <div className="space-y-3">
          <p className="text-sm text-neutral-600">
            <span className="font-semibold text-neutral-900">{fullValue}</span> is already registered to another account.
            Enter a different {label} to continue.
          </p>
          <button
            onClick={() => { setDuplicateOpen(false); setValue(""); }}
            className="px-4 py-2 text-xs font-semibold text-white bg-primary-600 rounded-lg hover:bg-primary-700"
          >
            Try a different {label}
          </button>
        </div>
      </Modal>
    </>
  );
}

const DOCUMENT_TYPE_OPTIONS = [
  { value: "past_prescription",    label: "Past prescription" },
  { value: "lab_report",           label: "Lab report" },
  { value: "imaging_report",       label: "Imaging report" },
  { value: "hospital_discharge",   label: "Hospital discharge summary" },
  { value: "referral_letter",      label: "Referral letter" },
  { value: "vaccination_record",   label: "Vaccination record" },
  { value: "insurance_document",   label: "Insurance document" },
  { value: "previous_assessment",  label: "Previous assessment" },
  { value: "doctor_notes",         label: "Doctor notes" },
  { value: "other",                label: "Other" },
];

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Files tab — patient uploads their own medical history documents ─
function MedicalFilesSection({ patientId, clinicId }: { patientId?: string; clinicId?: string }) {
  const [files, setFiles] = useState<PatientFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [documentType, setDocumentType] = useState("other");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!patientId) { setLoading(false); return; }
    patientFilesService.list(patientId)
      .then(setFiles)
      .catch(() => setError("Failed to load files"))
      .finally(() => setLoading(false));
  }, [patientId]);

  const onPick = () => fileInputRef.current?.click();

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !patientId || !clinicId) return;
    setError(null);
    setUploading(true);
    try {
      const uploaded = await patientFilesService.upload(patientId, clinicId, file, documentType);
      setFiles((prev) => [uploaded, ...prev]);
    } catch (err: any) {
      setError(extractErrorMessage(err, "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const onDownload = async (fileId: string, fileName: string) => {
    try {
      const url = await patientFilesService.downloadUrl(fileId);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      setError("Could not download this file");
    }
  };

  if (!patientId || !clinicId) {
    return <p className="text-sm text-neutral-400">Loading…</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-bold text-neutral-900">Medical History Files</h2>
          <p className="text-xs text-neutral-400 mt-0.5">Upload previous prescriptions, lab reports, or any other medical records.</p>
        </div>
      </div>

      <div className="rounded-xl border border-neutral-200 p-4 mb-5 flex flex-wrap items-center gap-3">
        <select
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          className="px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:border-sky-400"
        >
          {DOCUMENT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <input ref={fileInputRef} type="file" className="hidden" onChange={onFileSelected} />
        <button
          onClick={onPick} disabled={uploading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
          style={{ background: BRAND }}
        >
          <Upload className="w-3.5 h-3.5" /> {uploading ? "Uploading…" : "Upload file"}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-neutral-400">Loading files…</p>
      ) : files.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-200 py-14 text-center text-sm text-neutral-400">
          No files uploaded yet
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.file_id} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 p-3.5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4" style={{ color: BRAND_PRIMARY }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-900 truncate">{f.file_name}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {DOCUMENT_TYPE_OPTIONS.find((o) => o.value === f.document_type)?.label ?? f.document_type}
                    {f.file_size ? ` · ${formatFileSize(f.file_size)}` : ""}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onDownload(f.file_id, f.file_name)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 flex-shrink-0"
              >
                <Download className="w-3.5 h-3.5" /> Download
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Consents tab — medical treatment + data-use consent records ───
function ConsentsSection({ patientProfileId }: { patientProfileId?: string }) {
  const [consents, setConsents] = useState<ConsentRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Assessment consent forms the patient still has to review & sign — this is
  // where that action lives now (the patient-dashboard card was removed).
  const { assessments } = useMyAssessments();
  const pendingToSign = assessments.filter((a) => a.status === "granted");

  useEffect(() => {
    if (!patientProfileId) return;
    consentService.listForSubject({ patient_id: patientProfileId })
      .then(setConsents)
      .catch(() => setError("Failed to load consent records"));
  }, [patientProfileId]);

  return (
    <div>
      <h2 className="text-base font-bold text-neutral-900 mb-1">Consents</h2>
      <p className="text-xs text-neutral-400 mb-4">Medical treatment and data-use consents signed with the clinic.</p>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {pendingToSign.length > 0 && (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-widest">Awaiting your signature</p>
          {pendingToSign.map((a) => (
            <div key={a.permission_id} className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-amber-900 truncate">
                  {a.disease_name ? `${a.disease_name} assessment consent` : "Medical consent form"}
                </p>
                <p className="text-xs text-amber-700 mt-0.5">Review the treatment consent document and sign digitally.</p>
              </div>
              <Link
                href={`/patient/consent/${a.permission_id}`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-xs font-semibold flex-shrink-0 hover:opacity-90 transition-opacity"
                style={{ background: BRAND }}
              >
                Review &amp; sign <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}
        </div>
      )}

      {!patientProfileId || consents === null ? (
        <p className="text-sm text-neutral-400">Loading…</p>
      ) : consents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-200 py-14 text-center text-sm text-neutral-400">
          No consent records found
        </div>
      ) : (
        <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-xl overflow-hidden">
          {consents.map((c) => (
            <div key={c.consent_id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex items-center gap-2.5 text-sm font-semibold text-neutral-900 capitalize">
                <FileSignature className="w-4 h-4 flex-shrink-0" style={{ color: BRAND_PRIMARY }} />
                {c.consent_type.replace(/_/g, " ")}
              </span>
              <span className="flex items-center gap-2 flex-shrink-0">
                {c.signed_at && <span className="text-xs text-neutral-400">{new Date(c.signed_at).toLocaleDateString()}</span>}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  c.status === "signed" ? "bg-green-100 text-green-700" : c.status === "revoked" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"
                }`}>
                  {c.status}
                </span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── component ────────────────────────────────────────────────────

export default function PatientProfilePage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <PatientProfile />
    </Suspense>
  );
}

function PatientProfile() {
  const dispatch   = useAppDispatch();
  const myDoctor   = useAppSelector(selectMyDoctor);
  const { user }   = useAuth();

  const [profileRaw,  setProfileRaw]  = useState<Record<string, unknown> | null>(null);
  const [fetchError,  setFetchError]  = useState<string | null>(null);
  const [isEditing,   setIsEditing]   = useState(false);
  const [isSaving,    setIsSaving]    = useState(false);
  const [saveError,   setSaveError]   = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const searchParams = useSearchParams();
  const [activeTab,   setActiveTab]   = useState<TabId>("personal");

  // Deep-link support: /patient/profile?tab=medical opens the Medical History tab.
  // "files" kept as an alias for pre-existing links built before the tab rename.
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t === "files") { setActiveTab("medical"); return; }
    if (t && TABS.some((tab) => tab.id === t)) setActiveTab(t as TabId);
  }, [searchParams]);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const originalRef     = useRef<FormState>(EMPTY_FORM);

  useEffect(() => {
    dispatch(fetchMyDoctor());
    usersService.getProfile()
      .then((rawResp) => {
        // API returns { patient: {...}, permissions: [...], ... }
        const d: any = (rawResp as any).patient ?? rawResp;
        setProfileRaw(d as Record<string, unknown>);
        const filled: FormState = {
          full_name:         (d.full_name      as string) ?? `${d.first_name ?? ""} ${d.last_name ?? ""}`.trim(),
          date_of_birth:     (d.dob            as string) ?? "",
          gender:            (d.gender         as string) ?? "",
          government_id:     (d.government_id  as string) ?? "",
          id_type:           (d.id_type        as string) ?? "",
          language_pref:     ((d.language_pref ?? d.primary_language) as string) ?? "",
          address_line1:     (d.address        as string) ?? "",
          city:              (d.city           as string) ?? "",
          state:             (d.state          as string) ?? "",
          country:           (d.country        as string) ?? "",
          pincode:           (d.pincode        as string) ?? "",
          blood_group:       (d.blood_group    as string) ?? "",
          allergies:         (d.allergies      as string) ?? "",
          emergency_contact: (d.emergency_contact_name as string) ?? "",
          emergency_contact_phone: (d.emergency_contact_phone as string) ?? "",
          occupation:        (d.occupation     as string) ?? "",
          marital_status:    (d.marital_status as string) ?? "",
          insurance_provider:(d.insurance_provider as string) ?? "",
          insurance_policy:  (d.insurance_policy as string) ?? "",
          weight_kg:         (d.weight_kg != null ? String(d.weight_kg) : ""),
          height_ft:         (d.height_ft != null ? String(d.height_ft) : ""),
          height_in:         (d.height_in != null ? String(d.height_in) : ""),
        };
        setForm(filled);
        originalRef.current = filled;
      })
      .catch(() => setFetchError("Failed to load profile"));
  }, [dispatch]);

  const set = (field: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (form.id_type === "aadhaar" && form.government_id.length !== 12) {
      setSaveError("Aadhaar number must be exactly 12 digits.");
      return;
    }
    if (form.emergency_contact_phone.length > 0 && form.emergency_contact_phone.length !== 10) {
      setSaveError("Emergency contact number must be exactly 10 digits.");
      return;
    }
    const diff = buildDiff(form, originalRef.current);
    if (!Object.keys(diff).length) { setIsEditing(false); return; }
    setIsSaving(true); setSaveError(null); setSaveSuccess(false);
    try {
      const rawUpdated = await usersService.updateProfile(diff);
      const u: any = (rawUpdated as any).patient ?? rawUpdated;
      const freshFilled: FormState = {
        full_name:         (u.full_name      as string) ?? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim(),
        date_of_birth:     (u.dob            as string) ?? "",
        gender:            (u.gender         as string) ?? "",
        government_id:     (u.government_id  as string) ?? "",
        id_type:           (u.id_type        as string) ?? "",
        language_pref:     ((u.language_pref ?? u.primary_language) as string) ?? "",
        address_line1:     (u.address        as string) ?? "",
        city:              (u.city           as string) ?? "",
        state:             (u.state          as string) ?? "",
        country:           (u.country        as string) ?? "",
        pincode:           (u.pincode        as string) ?? "",
        blood_group:       (u.blood_group    as string) ?? "",
        allergies:         (u.allergies      as string) ?? "",
        emergency_contact: (u.emergency_contact_name as string) ?? "",
        emergency_contact_phone: (u.emergency_contact_phone as string) ?? "",
        occupation:        (u.occupation     as string) ?? "",
        marital_status:    (u.marital_status as string) ?? "",
        insurance_provider:(u.insurance_provider as string) ?? "",
        insurance_policy:  (u.insurance_policy as string) ?? "",
        weight_kg:         (u.weight_kg != null ? String(u.weight_kg) : ""),
        height_ft:         (u.height_ft != null ? String(u.height_ft) : ""),
        height_in:         (u.height_in != null ? String(u.height_in) : ""),
      };
      setForm(freshFilled);
      originalRef.current = freshFilled;
      setProfileRaw(u as Record<string, unknown>);
      dispatch(updateUserInStore({
        full_name:     u.full_name,
        first_name:    u.first_name,
        last_name:     u.last_name,
        city:          u.city,
        gender:        u.gender,
        date_of_birth: u.date_of_birth,
      }));
      // Dashboard's own profile-completion card reads a separately-cached
      // (5-min TTL) copy of this same data — without this it keeps showing
      // whatever it loaded before this save until that TTL expires.
      dispatch(invalidateDashboard());
      setSaveSuccess(true);
      setIsEditing(false);
    } catch (err) {
      // NoSupportedFieldsError means the diff only touched fields with no
      // backend column yet (weight, blood group, occupation, ...) — the
      // PATCH never even went out, so the form the user was looking at is
      // still accurate. Leave isEditing/form untouched instead of the
      // catch-all path, which would otherwise read as "save failed" for a
      // field that was never going to save in the first place.
      if (err instanceof NoSupportedFieldsError) {
        setSaveError(err.message);
        return;
      }
      setSaveError(err instanceof Error ? err.message : "Failed to save profile");
    } finally { setIsSaving(false); }
  };

  const handleCancel = () => { setForm(originalRef.current); setSaveError(null); setIsEditing(false); };

  if (!profileRaw && !fetchError) return <PageLoader />;

  const age         = computeAge(form.date_of_birth);
  const mrn         = (profileRaw?.mrn as string) || "—";
  const status      = (profileRaw?.approval_status as string) || "active";
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
  const email       = (profileRaw?.email as string) ?? "";
  const phone       = (profileRaw?.phone as string) ?? "";
  const { percent: completionPct, items: completionItems } = computeProfileCompletion(profileRaw, {
    email_verified: user?.email_verified, phone_verified: user?.phone_verified,
  });
  const missingItems = completionItems.filter((i) => !i.done);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* ── Header card ── */}
      <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-sky-50 via-blue-50/60 to-sky-50 p-6">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: BRAND }}>
            <User className="w-8 h-8 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-neutral-900 leading-tight truncate">Welcome, {form.full_name || "—"}</h1>

          </div>
        </div>

        {completionPct < 100 && (
          <div className="mt-5">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs font-semibold text-neutral-500">Profile completion</p>
              <span className="text-xs font-bold" style={{ color: BRAND_PRIMARY }}>{completionPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/70 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${completionPct}%`, background: BRAND }} />
            </div>
            {missingItems.length > 0 && (
              <p className="text-[11px] text-neutral-500 mt-1.5">
                Missing: {missingItems.map((i) => i.label).join(", ")}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-6 pt-5 border-t border-blue-100">
          <div>
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Country</p>
            <p className="text-sm font-semibold text-neutral-800">{form.country || "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Age</p>
            <p className="text-sm font-semibold text-neutral-800">{age ?? "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Plan</p>
            <p className="text-sm font-semibold" style={{ color: BRAND_PRIMARY }}>Standard</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-neutral-400 uppercase tracking-widest mb-1">Status</p>
            <p className="text-sm font-semibold capitalize" style={{ color: BRAND_PRIMARY }}>{statusLabel}</p>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
        <div className="flex border-b border-neutral-100 overflow-x-auto">
          {TABS.map(({ id, label, Icon }) => {
            const active = activeTab === id;
            return (
              <button key={id} onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px flex-shrink-0 ${
                  active ? "text-neutral-900 border-sky-500" : "text-neutral-500 border-transparent hover:text-neutral-700"
                }`}>
                <Icon className="w-4 h-4" />
                {label}
              </button>
            );
          })}
        </div>

        {/* ── Personal Information ── */}
        {activeTab === "personal" && (
          <div className="p-6">
            {fetchError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm mb-5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {fetchError}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left — Personal Information */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-bold text-neutral-900">Personal Information</h2>
                  {!isEditing && (
                    <button
                      onClick={() => { setSaveSuccess(false); setIsEditing(true); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-semibold hover:opacity-90 transition-opacity"
                      style={{ background: BRAND }}
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Edit
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-3">
                    <FieldInput label="Full Name"     value={form.full_name}     onChange={(v) => set("full_name", v)} />
                    <FieldInput label="Date of Birth" value={form.date_of_birth} onChange={(v) => set("date_of_birth", v)} type="date" />
                    <FieldInput label="Address"       value={form.address_line1} onChange={(v) => set("address_line1", v)} placeholder="Street address" />
                    <FieldInput label="Country"       value={form.country}       onChange={(v) => set("country", v)} />
                    <div className="grid grid-cols-2 gap-3">
                      <FieldInput label="City"    value={form.city}    onChange={(v) => set("city", v)} />
                      <FieldInput label="State"   value={form.state}   onChange={(v) => set("state", v)} />
                    </div>
                    <FieldInput label="Pincode"   value={form.pincode}  onChange={(v) => set("pincode", v)} numeric />
                    <div>
                      <label className={labelCls}>Gender</label>
                      <select className={inputCls} value={form.gender} onChange={(e) => set("gender", e.target.value)}>
                        <option value="">Select</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                        <option value="prefer_not_to_say">Prefer not to say</option>
                      </select>
                    </div>
                    <FieldInput label="Occupation"   value={form.occupation}   onChange={(v) => set("occupation", v)} />
                    <div>
                      <label className={labelCls}>Marital Status</label>
                      <select className={inputCls} value={form.marital_status} onChange={(e) => set("marital_status", e.target.value)}>
                        <option value="">Select</option>
                        <option value="single">Single</option>
                        <option value="married">Married</option>
                        <option value="undisclosed">Undisclosed</option>
                      </select>
                    </div>
                    <FieldInput
                      label="Emergency Contact Name"
                      value={form.emergency_contact}
                      onChange={(v) => set("emergency_contact", v)}
                      placeholder="Full name"
                    />
                    <FieldInput
                      label="Emergency Contact Number"
                      value={form.emergency_contact_phone}
                      onChange={(v) => set("emergency_contact_phone", v.replace(/\D/g, "").slice(0, 10))}
                      type="tel"
                      placeholder="10-digit phone number"
                    />
                    {form.emergency_contact_phone.length > 0 && form.emergency_contact_phone.length !== 10 && (
                      <p className="text-xs text-red-600">Emergency contact number must be exactly 10 digits.</p>
                    )}
                    <div>
                      <label className={labelCls}>ID Type</label>
                      <select
                        className={inputCls}
                        value={form.id_type}
                        onChange={(e) => {
                          const t = e.target.value;
                          set("id_type", t);
                          // Aadhaar is digits-only, exactly 12 — re-sanitize any
                          // value already typed under a different ID type.
                          if (t === "aadhaar") set("government_id", form.government_id.replace(/\D/g, "").slice(0, 12));
                        }}
                      >
                        <option value="">Select</option>
                        {ID_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <FieldInput
                      label={form.id_type === "aadhaar" ? "Aadhaar Number" : "Government ID"}
                      value={form.government_id}
                      onChange={(v) => set("government_id", form.id_type === "aadhaar" ? v.replace(/\D/g, "").slice(0, 12) : v)}
                      type={form.id_type === "aadhaar" ? "tel" : "text"}
                      placeholder={form.id_type === "aadhaar" ? "12-digit Aadhaar number" : "e.g., Aadhaar, Passport number"}
                    />
                    {form.id_type === "aadhaar" && form.government_id.length > 0 && form.government_id.length !== 12 && (
                      <p className="text-xs text-red-600">Aadhaar number must be exactly 12 digits.</p>
                    )}
                    <FieldInput label="Mother Tongue" value={form.language_pref} onChange={(v) => set("language_pref", v)} />

                    {saveError && (
                      <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" /> {saveError}
                      </div>
                    )}
                    <div className="flex gap-2 pt-1">
                      <button onClick={handleSave} disabled={isSaving}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
                        style={{ background: BRAND }}>
                        <Check className="w-3.5 h-3.5" /> {isSaving ? "Saving…" : "Save"}
                      </button>
                      <button onClick={handleCancel} disabled={isSaving}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-neutral-100 text-neutral-700 text-sm font-semibold hover:bg-neutral-200 transition-colors">
                        <X className="w-3.5 h-3.5" /> Cancel
                      </button>
                    </div>
                    {saveSuccess && (
                      <span className="flex items-center gap-1.5 text-sm text-green-600 font-medium">
                        <Check className="w-4 h-4" /> Saved
                      </span>
                    )}
                  </div>
                ) : (
                  <div>
                    <InfoRow label="Full Name"    value={form.full_name} />
                    <InfoRow label="Email"        value={email} />
                    <InfoRow label="Phone"        value={phone} />
                    <InfoRow label="Date of Birth" value={form.date_of_birth} />
                    <InfoRow label="Gender"       value={form.gender} />
                    <InfoRow label="Address"      value={form.address_line1} />
                    <InfoRow label="City"         value={form.city} />
                    <InfoRow label="State"        value={form.state} />
                    <InfoRow label="Country"      value={form.country} />
                    <InfoRow label="Pincode"      value={form.pincode} />
                    <InfoRow label="Occupation"   value={form.occupation} />
                    <InfoRow label="Marital Status" value={form.marital_status} />
                    <InfoRow label="Government ID"  value={form.government_id} />
                    <InfoRow label="ID Type"        value={form.id_type} />
                    <InfoRow label="Mother Tongue" value={form.language_pref} />
                  </div>
                )}
              </div>

              {/* Right — Medical Information + Care Team */}
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-neutral-900">Medical Information</h2>
                  </div>

                  {isEditing ? (
                    <div className="space-y-3">
                      <FieldInput label="Weight (KG)"        value={form.weight_kg}         onChange={(v) => set("weight_kg", v)}         placeholder="e.g., 72" numeric />
                      <div>
                        <label className={labelCls}>Height</label>
                        <div className="grid grid-cols-2 gap-3">
                          <input className={inputCls} inputMode="decimal" value={form.height_ft} placeholder="Feet (e.g., 5)"   onChange={(e) => set("height_ft", sanitizeNumeric(e.target.value))} />
                          <input className={inputCls} inputMode="decimal" value={form.height_in} placeholder="Inches (e.g., 10)" onChange={(e) => set("height_in", sanitizeNumeric(e.target.value))} />
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Blood Group</label>
                        <select className={inputCls} value={form.blood_group} onChange={(e) => set("blood_group", e.target.value)}>
                          <option value="">Select</option>
                          {BLOOD_GROUP_OPTIONS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                        </select>
                      </div>
                      <FieldInput label="Allergies"          value={form.allergies}          onChange={(v) => set("allergies", v)}          placeholder="e.g., Penicillin" />
                      <FieldInput label="Insurance Provider" value={form.insurance_provider} onChange={(v) => set("insurance_provider", v)} />
                      <FieldInput label="Policy Number"      value={form.insurance_policy}   onChange={(v) => set("insurance_policy", v)} />
                    </div>
                  ) : (
                    <div>
                      <InfoRow label="Weight (KG)"        value={form.weight_kg ? `${form.weight_kg} kg` : null} />
                      <InfoRow label="Height"             value={form.height_ft ? `${form.height_ft}′ ${form.height_in || "0"}″` : null} />
                      <InfoRow label="Blood Group"        value={form.blood_group} />
                      <InfoRow label="Allergies"          value={form.allergies} />
                      <InfoRow label="Emergency Contact Name"   value={form.emergency_contact} />
                      <InfoRow label="Emergency Contact Number" value={form.emergency_contact_phone} />
                      <InfoRow label="Insurance Provider" value={form.insurance_provider} />
                      <InfoRow label="Policy Number"      value={form.insurance_policy} />
                    </div>
                  )}
                </div>

                {/* Primary Care Team */}
                <div>
                  <h2 className="text-base font-bold text-neutral-900 mb-3">Primary Care Team</h2>
                  {myDoctor ? (
                    <div className="rounded-xl border border-neutral-200 p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center flex-shrink-0">
                          <Stethoscope className="w-4 h-4" style={{ color: BRAND_PRIMARY }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-neutral-900">
                            Dr. {myDoctor.first_name} {myDoctor.last_name}
                          </p>
                          {myDoctor.specialization && (
                            <p className="text-xs text-neutral-500 mt-0.5">{myDoctor.specialization}</p>
                          )}
                          <span className="inline-block mt-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ color: BRAND_PRIMARY, background: "#EFF9FF" }}>
                            Primary
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-neutral-200 p-4 text-sm text-neutral-400 text-center">
                      No doctor assigned yet
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Medical History/Files ── */}
        {activeTab === "medical" && (
          <div className="p-6">
            <MedicalFilesSection patientId={user?.patient_id} clinicId={user?.clinic_id} />
          </div>
        )}

        {/* ── Verification ── */}
        {activeTab === "verification" && (
          <div className="p-6">
            <h2 className="text-base font-bold text-neutral-900 mb-4">Verification</h2>
            <ChannelVerification
              emailVerified={user?.email_verified}
              phoneVerified={user?.phone_verified}
              hasEmail={!!email.trim()}
              hasPhone={!!phone.trim()}
              country={form.country}
            />
            <div>
              <InfoRow label="Email"       value={email} />
              <InfoRow label="Email verified" value={user?.email_verified ? "Yes" : "No"} />
              <InfoRow label="Phone"       value={phone} />
              <InfoRow label="Phone verified" value={user?.phone_verified ? "Yes" : "No"} />
            </div>
          </div>
        )}

        {/* ── Consents ── */}
        {activeTab === "consents" && (
          <div className="p-6">
            <ConsentsSection patientProfileId={user?.id} />
          </div>
        )}

      </div>
    </div>
  );
}
