"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { appointmentsService } from "@/lib/api/services";
import { treatmentProtocolService } from "@/lib/api/services/treatmentProtocol.service";
import { doctorsService } from "@/lib/api/services/doctors.service";
import { deviceSessionService } from "@/lib/api/services/deviceSession.service";
import { useDeviceSession, usePatientScoresSummary } from "@/lib/hooks";
import { Button, Card, CardHeader, CardContent, PageLoader, DetailFieldList, Input } from "@/components/ui";
import { PlacementMap } from "@/app/(roles)/doctor/patients/[id]/treatment-protocol/wizard/PlacementMap";
import { SignatureCapture } from "@/components/deviceSession/SignatureCapture";
import type { Appointment, PatientDetail } from "@/types/domain.types";
import type { ProtocolDetail } from "@/types/treatmentProtocol.types";
import type { ConsentBlock, DeviceSessionChecklistUpdate, DeviceSessionDetail } from "@/types/deviceSession.types";

/** Mirrors TreatmentProtocolPanel's convention: the wizard writes
 * "Reason: <label> — <note>" into the one free-text notes field the real
 * ProtocolCreate schema has. */
function splitReason(notes?: string | null): { reason: string; note: string } {
  if (!notes) return { reason: "Initial protocol", note: "" };
  const m = notes.match(/^Reason:\s*([^—]+)—\s*([\s\S]*)$/);
  if (m) return { reason: m[1].trim(), note: m[2].trim() };
  return { reason: "Initial protocol", note: notes };
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

const CONTRAINDICATION_ITEMS = [
  { code: "skull_injury", label: "No known skull injury or fracture" },
  { code: "implants", label: "No implanted metal or electronic devices" },
  { code: "skin_lesions", label: "No skin lesions at the electrode sites" },
  { code: "seizure_history", label: "No change in seizure history" },
  { code: "medication_change", label: "No relevant medication change" },
  { code: "prep", label: "Jewellery removed, hair prepped at electrode sites" },
  { code: "patient_ready", label: "Patient alert, hydrated, fed, and consents understood" },
];

const PATIENT_CONSENT_STATEMENTS = [
  { code: "no_skull_injury", label: "I confirm I have no known skull injury or fracture" },
  { code: "no_implants", label: "I confirm I have no implanted metal or electronic devices" },
  { code: "no_skin_lesions", label: "I confirm I have no skin lesions at the electrode sites" },
  { code: "seizure_unchanged", label: "I confirm my seizure history is unchanged" },
  { code: "understands_sensations", label: "I understand I may feel tingling, itching, or warmth during the session" },
];

const CA_DECLARATION_STATEMENTS = [
  { code: "checklist_completed", label: "I have completed the pre-session safety checklist" },
  { code: "scalp_inspected", label: "I have inspected the scalp at both electrode sites" },
  { code: "montage_verified", label: "I have verified the montage against the prescribed placement" },
  { code: "will_monitor", label: "I will monitor the patient and stop the session on any adverse event" },
];

export default function DeviceSessionChecklistPage() {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const router = useRouter();

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [protocol, setProtocol] = useState<ProtocolDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [patientDetail, setPatientDetail] = useState<PatientDetail | null>(null);
  const [prevSession, setPrevSession] = useState<DeviceSessionDetail | null>(null);
  const [prevAppointmentDate, setPrevAppointmentDate] = useState<string | null>(null);
  const { session, isLoading, saveChecklist, start } = useDeviceSession(appointmentId);
  const patientId = appointment?.patient_public_id ?? appointment?.patient_id ?? null;
  const { instances: scoreInstances } = usePatientScoresSummary(patientId ?? "");

  const [deviceBrand, setDeviceBrand] = useState("");
  const [deviceSerial, setDeviceSerial] = useState("");
  const [paymentOverrideReason, setPaymentOverrideReason] = useState("");
  const [proceedWithoutPayment, setProceedWithoutPayment] = useState(false);
  const [intensity, setIntensity] = useState<string>("");
  const [duration, setDuration] = useState<string>("");
  const [rampUp, setRampUp] = useState<string>("");
  const [rampDown, setRampDown] = useState<string>("");
  const [montageVerified, setMontageVerified] = useState(false);
  const [contraindications, setContraindications] = useState<Record<string, boolean>>({});
  const [patientConsent, setPatientConsent] = useState<Record<string, boolean>>({});
  const [caDeclaration, setCaDeclaration] = useState<Record<string, boolean>>({});
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!appointmentId) return;
    appointmentsService.getById(appointmentId)
      .then(async (appt) => {
        setAppointment(appt);
        const protocolId = appt.protocol_id;
        if (protocolId) {
          const detail = await treatmentProtocolService.getProtocolDetail(protocolId);
          setProtocol(detail);
          setIntensity(String(detail.prescribed_current_ma ?? ""));
          setDuration(String(detail.prescribed_duration_min ?? ""));
          setRampUp(String(detail.ramp_seconds ?? ""));
          setRampDown(String(detail.ramp_seconds ?? ""));
        }
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load appointment"));
  }, [appointmentId]);

  useEffect(() => {
    if (!patientId) return;
    doctorsService.getPatient(patientId).then(setPatientDetail).catch(() => setPatientDetail(null));
  }, [patientId]);

  // Previous session context — the device session immediately before this
  // one on the same protocol course, if it ran and completed.
  useEffect(() => {
    if (!protocol || appointment?.session_number == null) { setPrevSession(null); setPrevAppointmentDate(null); return; }
    const prev = protocol.sessions.find(
      (s) => s.session_number === (appointment.session_number as number) - 1 && s.status === "completed",
    );
    if (!prev) { setPrevSession(null); setPrevAppointmentDate(null); return; }
    setPrevAppointmentDate(prev.appointment_date);
    deviceSessionService.get(prev.appointment_id).then(setPrevSession).catch(() => setPrevSession(null));
  }, [protocol, appointment]);

  useEffect(() => {
    if (!session) return;
    setDeviceBrand(session.device_brand ?? "");
    setDeviceSerial(session.device_serial_number ?? "");
    setProceedWithoutPayment(session.payment_verified === false && !!session.payment_override_reason);
    setPaymentOverrideReason(session.payment_override_reason ?? "");
    if (session.actual_intensity_ma != null) setIntensity(String(session.actual_intensity_ma));
    if (session.actual_duration_min != null) setDuration(String(session.actual_duration_min));
    if (session.actual_ramp_up_sec != null) setRampUp(String(session.actual_ramp_up_sec));
    if (session.actual_ramp_down_sec != null) setRampDown(String(session.actual_ramp_down_sec));
    setMontageVerified(session.montage_verified);
    setContraindications(session.contraindication_checklist ?? {});
    if (session.patient_consent) {
      setPatientConsent(Object.fromEntries(session.patient_consent.statements.map((s) => [s.code, s.confirmed])));
    }
    if (session.ca_declaration) {
      setCaDeclaration(Object.fromEntries(session.ca_declaration.statements.map((s) => [s.code, s.confirmed])));
    }
  }, [session]);

  if (loadError) {
    return <div className="text-sm text-danger-600">{loadError}</div>;
  }
  if (!appointment || isLoading) return <PageLoader />;

  // A protocol uses either a catalogue placement (protocol.placement,
  // singular anode_site/cathode_site/return_sites) or a custom montage
  // (protocol.custom_montage, plural anode_sites/cathode_sites arrays) —
  // never both (chk_protocol_plan_one_placement, 54). Read whichever is set.
  const anodeSite = protocol?.placement?.anode_site
    ?? protocol?.custom_montage?.anode_sites?.[0]
    ?? null;
  const cathodeSites = protocol?.placement
    ? [protocol.placement.cathode_site, ...(protocol.placement.return_sites ?? [])].filter(Boolean) as string[]
    : (protocol?.custom_montage?.cathode_sites ?? []);

  const prescribedIntensity = protocol?.prescribed_current_ma ?? null;
  const prescribedDuration = protocol?.prescribed_duration_min ?? null;
  const prescribedRamp = protocol?.ramp_seconds ?? null;

  const intensityDeviates = prescribedIntensity != null && intensity !== "" && Number(intensity) !== prescribedIntensity;
  const durationDeviates = prescribedDuration != null && duration !== "" && Number(duration) !== prescribedDuration;
  const rampUpDeviates = prescribedRamp != null && rampUp !== "" && Number(rampUp) !== prescribedRamp;
  const rampDownDeviates = prescribedRamp != null && rampDown !== "" && Number(rampDown) !== prescribedRamp;

  const allContraindicationsChecked = CONTRAINDICATION_ITEMS.every((i) => contraindications[i.code]);
  const allPatientConsentChecked = PATIENT_CONSENT_STATEMENTS.every((s) => patientConsent[s.code]);
  const allCaDeclarationChecked = CA_DECLARATION_STATEMENTS.every((s) => caDeclaration[s.code]);
  // "Paid" on the underlying appointment (a real payment record via the
  // Razorpay webhook, per scheduling's AppointmentStatusUpdate) satisfies
  // this step on its own — session.payment_verified only exists to record
  // a CA's explicit override when the appointment ISN'T paid yet.
  const paymentOk = appointment.status === "paid"
    || session?.payment_verified
    || (proceedWithoutPayment && paymentOverrideReason.trim().length > 0);

  const missing: string[] = [];
  if (!paymentOk) missing.push("Payment verification");
  if (!deviceBrand) missing.push("Device brand");
  if (!intensity || !duration) missing.push("Stimulation parameters");
  if (!montageVerified) missing.push("Montage verification");
  if (!allContraindicationsChecked) missing.push("Contraindication checklist");
  if (!allPatientConsentChecked || !allCaDeclarationChecked) missing.push("Consent & declaration");

  const canStart = missing.length === 0;

  // Every field the "sync from session" effect above can overwrite on
  // reload. Any saveChecklist call that omits one of these risks the next
  // reload stomping an unsaved local checkbox/input back to whatever was
  // last persisted — see currentChecklistFields' callers for why every
  // save goes through here instead of a partial payload.
  const currentChecklistFields = (): DeviceSessionChecklistUpdate => ({
    payment_verified: paymentOk,
    payment_override_reason: proceedWithoutPayment ? paymentOverrideReason : null,
    device_brand: deviceBrand || null,
    device_serial_number: deviceSerial || null,
    actual_intensity_ma: intensity ? Number(intensity) : null,
    intensity_deviates: intensityDeviates,
    actual_duration_min: duration ? Number(duration) : null,
    duration_deviates: durationDeviates,
    actual_ramp_up_sec: rampUp ? Number(rampUp) : null,
    ramp_up_deviates: rampUpDeviates,
    actual_ramp_down_sec: rampDown ? Number(rampDown) : null,
    ramp_down_deviates: rampDownDeviates,
    montage_verified: montageVerified,
    contraindication_checklist: contraindications,
  });

  const persistChecklist = async () => {
    await saveChecklist(currentChecklistFields());
  };

  const handlePatientSignature = async (dataUrl: string) => {
    const block: ConsentBlock = {
      statements: PATIENT_CONSENT_STATEMENTS.map((s) => ({ code: s.code, confirmed: !!patientConsent[s.code] })),
      signature: dataUrl,
      signed_at: new Date().toISOString(),
    };
    // Includes every other field, not just patient_consent — otherwise the
    // reload this triggers refetches session and the sync effect stomps
    // any checkbox/input the CA had filled in but not yet saved back to
    // whatever was last persisted (the actual bug this fixes).
    await saveChecklist({ ...currentChecklistFields(), patient_consent: block });
  };

  const handleCaSignature = async (dataUrl: string) => {
    const block: ConsentBlock = {
      statements: CA_DECLARATION_STATEMENTS.map((s) => ({ code: s.code, confirmed: !!caDeclaration[s.code] })),
      signature: dataUrl,
      signed_at: new Date().toISOString(),
    };
    await saveChecklist({ ...currentChecklistFields(), ca_declaration: block });
  };

  const handleStart = async () => {
    setIsStarting(true);
    try {
      await persistChecklist();
      await start();
      router.push(`/clinical-assistant/device-sessions/${appointmentId}/live`);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="space-y-5 max-w-6xl pb-24">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => router.push("/clinical-assistant/appointments")}
          className="flex items-center gap-1.5 text-sm text-primary-700 hover:text-primary-900 transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Queue
        </button>
        <span className="text-neutral-300">|</span>
        <h1 className="text-lg font-bold text-neutral-900">Device Session · {appointment.patient_name}</h1>
        {appointment.session_number != null && (
          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-primary-50 text-primary-700">
            Session {appointment.session_number} of {protocol?.session_count ?? "—"}
          </span>
        )}
        <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${appointment.status === "paid" ? "bg-green-50 text-green-700" : "bg-neutral-100 text-neutral-600"}`}>
          {appointment.status === "paid" ? "Paid" : appointment.status.replace(/_/g, " ")}
        </span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5">
        {/* Left — read-only protocol summary */}
        <div className="space-y-4">
          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-neutral-900">Demographics &amp; Vitals</h3></CardHeader>
            <CardContent>
              <DetailFieldList
                data={{
                  patient: patientDetail
                    ? `${patientDetail.full_name}${patientDetail.age != null ? ` · ${patientDetail.age}${patientDetail.gender ? patientDetail.gender[0].toUpperCase() : ""}` : ""}${patientDetail.mrn ? ` · MRN ${patientDetail.mrn}` : ""}`
                    : appointment.patient_name,
                  bp_hr: "Not tracked",
                  weight: "Not tracked",
                  allergies: "Not tracked",
                  flags: "Not tracked",
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-neutral-900">Previous Session Context</h3></CardHeader>
            <CardContent>
              {appointment.session_number != null && appointment.session_number <= 1 ? (
                <p className="text-xs text-neutral-400">This is session 1 — no previous session to reference.</p>
              ) : !prevSession ? (
                <p className="text-xs text-neutral-400">No completed previous session on record.</p>
              ) : (
                <DetailFieldList
                  data={{
                    session: `Session ${(appointment.session_number as number) - 1} · ${fmtDate(prevAppointmentDate)}`,
                    tolerance: prevSession.feedback
                      ? `${prevSession.feedback.answers.comfort} · felt ${prevSession.feedback.answers.felt_after}`
                      : prevSession.symptoms.length
                        ? `${prevSession.symptoms.length} symptom${prevSession.symptoms.length === 1 ? "" : "s"} reported`
                        : "No issues reported",
                    ca_note: prevSession.notes[0]?.note_text ?? "—",
                    prs_trend: (() => {
                      const sorted = scoreInstances.slice().sort((a, b) => (a.completed_at ?? "").localeCompare(b.completed_at ?? ""));
                      if (sorted.length < 2) return "Not enough scores yet";
                      const first = sorted[0], last = sorted[sorted.length - 1];
                      return `${last.disease_name ?? "Score"}: ${first.disease_score ?? "—"} → ${last.disease_score ?? "—"}`;
                    })(),
                  }}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-neutral-900">Protocol — set by {protocol?.doctor_name || "doctor"}</h3>
                {protocol?.status && (
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${
                    protocol.status === "active" ? "bg-green-50 text-green-700" : "bg-neutral-100 text-neutral-600"
                  }`}>
                    {protocol.status}
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!protocol ? (
                <p className="text-xs text-neutral-400">No treatment protocol linked to this appointment yet.</p>
              ) : (
                <DetailFieldList
                  data={{
                    doctor: protocol.doctor_name,
                    modality: protocol.modality,
                    device: protocol.device_name,
                    current_ma: protocol.prescribed_current_ma,
                    duration_min: protocol.prescribed_duration_min,
                    ramp_seconds: protocol.ramp_seconds,
                    sessions_per_week: protocol.sessions_per_week,
                    session: appointment.session_number
                      ? `Session ${appointment.session_number} of ${protocol.session_count}`
                      : `Session of ${protocol.session_count}`,
                    follow_up_every: protocol.follow_up_every_n ? `Every ${protocol.follow_up_every_n} sessions` : "None scheduled",
                    effective_from: fmtDate(protocol.activated_at || protocol.created_at),
                    reason_for_protocol: splitReason(protocol.notes).reason,
                    doctors_note: splitReason(protocol.notes).note || "—",
                  }}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-neutral-900">Montage — Locked</h3></CardHeader>
            <CardContent>
              <PlacementMap anodeSite={anodeSite} cathodeSites={cathodeSites} interactive={false} />
              <p className="text-xs text-neutral-400 mt-6 text-center">Placement cannot be modified at session time.</p>
            </CardContent>
          </Card>
        </div>

        {/* Right — 6-step checklist */}
        <div className="space-y-4">
          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-neutral-900">1. Payment & Appointment Verification</h3></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-neutral-600">Status: <span className="font-medium">{appointment.status}</span></p>
              {!paymentOk && (
                <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={proceedWithoutPayment} onChange={(e) => setProceedWithoutPayment(e.target.checked)} className="mt-0.5" />
                    Proceed without recorded payment (override)
                  </label>
                  {proceedWithoutPayment && (
                    <Input placeholder="Reason for proceeding without payment" value={paymentOverrideReason} onChange={(e) => setPaymentOverrideReason(e.target.value)} />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-neutral-900">2. Device & Brand for This Session</h3></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {["Sooma", "Marbles", "Biothm", "Other"].map((brand) => (
                  <button
                    key={brand}
                    onClick={() => setDeviceBrand(brand)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      deviceBrand === brand ? "bg-primary-100 border-primary-400 text-primary-800" : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300"
                    }`}
                  >
                    {brand}
                  </button>
                ))}
              </div>
              <Input label="Device unit / serial no." value={deviceSerial} onChange={(e) => setDeviceSerial(e.target.value)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-neutral-900">3. Stimulation Parameters</h3></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Input label="Intensity (mA)" type="number" value={intensity} onChange={(e) => setIntensity(e.target.value)}
                hint={prescribedIntensity != null ? `Protocol: ${prescribedIntensity} mA` : undefined} />
              <Input label="Duration (min)" type="number" value={duration} onChange={(e) => setDuration(e.target.value)}
                hint={prescribedDuration != null ? `Protocol: ${prescribedDuration} min` : undefined} />
              <Input label="Ramp up (s)" type="number" value={rampUp} onChange={(e) => setRampUp(e.target.value)}
                hint={prescribedRamp != null ? `Protocol: ${prescribedRamp} s` : undefined} />
              <Input label="Ramp down (s)" type="number" value={rampDown} onChange={(e) => setRampDown(e.target.value)}
                hint={prescribedRamp != null ? `Protocol: ${prescribedRamp} s` : undefined} />
              {(intensityDeviates || durationDeviates || rampUpDeviates || rampDownDeviates) && (
                <p className="col-span-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  Deviation from protocol — this will be recorded in the session log.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-neutral-900">4. Montage Verification</h3></CardHeader>
            <CardContent>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={montageVerified} onChange={(e) => setMontageVerified(e.target.checked)} className="mt-0.5" />
                I have measured and marked the electrode positions against the 10-20 map. Placement cannot be modified at session time.
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-neutral-900">5. Contraindication & Fitness Checklist</h3></CardHeader>
            <CardContent className="space-y-2">
              <ul className="text-sm text-neutral-600 list-disc pl-5 space-y-1">
                {CONTRAINDICATION_ITEMS.map((item) => <li key={item.code}>{item.label}</li>)}
              </ul>
              <label className="flex items-start gap-2 text-sm font-medium pt-1">
                <input
                  type="checkbox"
                  checked={allContraindicationsChecked}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setContraindications(Object.fromEntries(CONTRAINDICATION_ITEMS.map((i) => [i.code, checked])));
                  }}
                  className="mt-0.5"
                />
                I confirm all of the above
              </label>
              <p className="text-xs text-neutral-400 pt-1">If any item cannot be confirmed, do not start — refer back to the doctor.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><h3 className="text-sm font-semibold text-neutral-900">6. Session Consent</h3></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-neutral-500 uppercase">Patient consent</p>
                <ul className="text-sm text-neutral-600 list-disc pl-5 space-y-1">
                  {PATIENT_CONSENT_STATEMENTS.map((s) => <li key={s.code}>{s.label}</li>)}
                </ul>
                <label className="flex items-start gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={allPatientConsentChecked}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setPatientConsent(Object.fromEntries(PATIENT_CONSENT_STATEMENTS.map((s) => [s.code, checked])));
                    }}
                    className="mt-0.5"
                  />
                  I confirm all of the above
                </label>
                {session?.patient_consent ? (
                  <p className="text-sm italic text-neutral-800 font-serif">{session.patient_consent.signature}</p>
                ) : (
                  <SignatureCapture signerName={appointment.patient_name ?? "Patient"} onCapture={handlePatientSignature} disabled={!allPatientConsentChecked} />
                )}
                {session?.patient_consent && <p className="text-xs text-success-600 flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Signed</p>}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-neutral-500 uppercase">CA declaration</p>
                <ul className="text-sm text-neutral-600 list-disc pl-5 space-y-1">
                  {CA_DECLARATION_STATEMENTS.map((s) => <li key={s.code}>{s.label}</li>)}
                </ul>
                <label className="flex items-start gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={allCaDeclarationChecked}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setCaDeclaration(Object.fromEntries(CA_DECLARATION_STATEMENTS.map((s) => [s.code, checked])));
                    }}
                    className="mt-0.5"
                  />
                  I confirm all of the above
                </label>
                {session?.ca_declaration ? (
                  <p className="text-sm italic text-neutral-800 font-serif">{session.ca_declaration.signature}</p>
                ) : (
                  <SignatureCapture signerName={caName} onCapture={handleCaSignature} disabled={!allCaDeclarationChecked} />
                )}
                {session?.ca_declaration && <p className="text-xs text-success-600 flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" /> Signed</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sticky start bar */}
      <div
        className={`fixed bottom-0 right-0 left-0 bg-white border-t border-neutral-200 px-6 py-4 flex items-center justify-between z-10 transition-[left] duration-150 ease-in-out ${
          isCollapsed ? "md:left-16" : "md:left-64"
        }`}
      >
        <div>
          <p className="text-sm font-semibold text-neutral-900">{canStart ? "Ready to start" : "Not ready yet"}</p>
          {!canStart && <p className="text-xs text-neutral-400">Missing: {missing.join(", ")}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/clinical-assistant/appointments")}>Back to Queue</Button>
          <Button onClick={handleStart} isLoading={isStarting} disabled={!canStart}>Start Session</Button>
        </div>
      </div>
    </div>
  );
}
