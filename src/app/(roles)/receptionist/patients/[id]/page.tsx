"use client";

import { Fragment, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, User, Mail, Phone, Calendar, MapPin,
  Stethoscope, CheckCircle, XCircle, Loader2, UserCheck,
  Heart, AlertCircle, ClipboardList, Check, CalendarPlus,
} from "lucide-react";
import { staffService } from "@/lib/api/services/staff.service";
import { receptionService } from "@/lib/api/services/reception.service";
import { adminService } from "@/lib/api/services/admin.service";
import { appointmentsService } from "@/lib/api/services/appointments.service";
import { useReceptionPatient, useClinics } from "@/lib/hooks";
import { Card, CardHeader, CardContent, PageLoader } from "@/components/ui";
import { PatientJourneySections, type PatientJourneyDetail } from "@/components/admin/PatientJourneySections";
import type { DoctorListItem, Appointment } from "@/types/domain.types";

const TABS = ["Overview", "Appointments", "Timeline"] as const;
type Tab = (typeof TABS)[number];

function fmt12(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function fmtDate(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

const APPT_STATUS_TONE: Record<string, { bg: string; text: string }> = {
  scheduled:   { bg: "bg-warning-50",  text: "text-warning-700" },
  confirmed:   { bg: "bg-primary-50",  text: "text-primary-700" },
  checked_in:  { bg: "bg-success-50",  text: "text-success-700" },
  in_progress: { bg: "bg-primary-100", text: "text-primary-800" },
  completed:   { bg: "bg-success-50",  text: "text-success-700" },
  cancelled:   { bg: "bg-danger-50",   text: "text-danger-700" },
  no_show:     { bg: "bg-neutral-100", text: "text-neutral-600" },
  rescheduled: { bg: "bg-neutral-100", text: "text-neutral-600" },
};

function ApptStatusChip({ status }: { status: string }) {
  const tone = APPT_STATUS_TONE[status] ?? APPT_STATUS_TONE.scheduled;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${tone.bg} ${tone.text}`}>
      {status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
    </span>
  );
}

// Matches patients/service.py _REGISTRATION_STEPS exactly — same stepper used
// on the admin/regional-admin/clinic-admin patient-detail views.
const REGISTRATION_STEPS: { key: string; label: string }[] = [
  { key: "demographics_complete", label: "Demographics" },
  { key: "disease_selected", label: "Disease Selection" },
  { key: "consent_signed", label: "Consent Signed" },
  { key: "anamnesis_complete", label: "Anamnesis" },
  { key: "general_prs_complete", label: "General PRS" },
  { key: "registration_complete", label: "Registration Complete" },
];

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-blue-600" />
      </div>
      <div>
        <p className="text-xs text-neutral-400">{label}</p>
        <p className="text-sm font-medium text-neutral-800 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function statusBadge(status?: string) {
  switch (status) {
    case "active":   return "bg-green-50 text-green-700 border-green-200";
    case "pending":  return "bg-amber-50 text-amber-700 border-amber-200";
    case "inactive": return "bg-neutral-100 text-neutral-600 border-neutral-200";
    default:         return "bg-neutral-100 text-neutral-500 border-neutral-200";
  }
}

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [doctors, setDoctors]         = useState<DoctorListItem[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [allocating, setAllocating]   = useState(false);
  const [reallocating, setReallocating] = useState(false);
  const [actionLoading, setActionLoading] = useState<"approve" | "reject" | null>(null);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [toast, setToast]             = useState<{ msg: string; ok: boolean } | null>(null);
  const [journeyDetail, setJourneyDetail] = useState<Record<string, unknown> | null>(null);
  const [journeyError, setJourneyError]   = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Overview");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [apptsLoading, setApptsLoading] = useState(true);

  const { patient, isLoading: patientLoading, refresh: refreshPatient } = useReceptionPatient(id);
  const { clinics } = useClinics();
  const isLoading = patientLoading || doctorsLoading;

  useEffect(() => {
    setApptsLoading(true);
    appointmentsService.list({ patient_id: id, limit: 100 })
      .then((res) => setAppointments(res.appointments))
      .catch(() => setAppointments([]))
      .finally(() => setApptsLoading(false));
  }, [id]);

  useEffect(() => {
    setJourneyDetail(null);
    setJourneyError(null);
    adminService.getPatientDetail(id).then(setJourneyDetail).catch(() => setJourneyError("Couldn't load registration record"));
  }, [id]);

  const registrationStatus = journeyDetail?.registration_status as string | undefined;
  const currentStepIndex = REGISTRATION_STEPS.findIndex((s) => s.key === registrationStatus);

  // Resolve clinic name reactively.
  const resolvedClinic: string | null = (() => {
    if (!patient?.clinic_id) return null;
    const match = clinics.find((c) => c.clinic_id === patient.clinic_id);
    return match?.clinic_name || match?.city || null;
  })();

  useEffect(() => {
    receptionService.getDoctors()
      .then(({ doctors: d }) => setDoctors(d))
      .catch(() => {})
      .finally(() => setDoctorsLoading(false));
  }, []);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAllocate = async () => {
    if (!selectedDoctor) return;
    setAllocating(true);
    try {
      await staffService.allocatePatient(id, selectedDoctor);
      setSelectedDoctor("");
      setReallocating(false);
      refreshPatient();
      showToast("Patient successfully allocated to doctor.", true);
    } catch {
      showToast("Failed to allocate patient. Please try again.", false);
    } finally {
      setAllocating(false);
    }
  };

  const handleApprove = async () => {
    setActionLoading("approve");
    try {
      await receptionService.approvePatient(id);
      refreshPatient();
      showToast("Patient approved successfully.", true);
    } catch {
      showToast("Failed to approve patient.", false);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    setActionLoading("reject");
    try {
      // Real endpoint has no rejection-reason field — rejectReason isn't transmitted.
      await receptionService.rejectPatient(id);
      setRejectModal(false);
      refreshPatient();
      showToast("Patient registration rejected.", true);
    } catch {
      showToast("Failed to reject patient.", false);
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) return <PageLoader />;
  if (!patient)  return (
    <div className="text-center py-20 text-neutral-400">Patient not found.</div>
  );

  const name    = patient.full_name || `${patient.first_name} ${patient.last_name}`.trim() || "Unknown";
  const initials = (patient.first_name?.[0] || name[0] || "?").toUpperCase() +
                   (patient.last_name?.[0]  || name.split(" ")[1]?.[0] || "").toUpperCase();
  const isPending = patient.approval_status === "pending";
  const clinic = resolvedClinic || patient.clinic_name || patient.clinic_city;

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs">
        <Link href="/receptionist/dashboard" className="text-neutral-400 hover:text-neutral-600">Receptionist</Link>
        <span className="text-neutral-300">/</span>
        <Link href="/receptionist/patients" className="text-neutral-400 hover:text-neutral-600">All Patients</Link>
        <span className="text-neutral-300">/</span>
        <span className="text-neutral-700 font-medium">{name}</span>
      </nav>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-dropdown text-sm font-medium text-white transition-all ${toast.ok ? "bg-success-500" : "bg-danger-500"}`}>
          {toast.ok ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Patient header */}
      <Card>
        <CardContent className="flex flex-col sm:flex-row sm:items-center gap-5 py-6">
          <div className="w-[66px] h-[66px] rounded-full bg-brand-gradient flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-xl font-bold text-neutral-900">{name}</h1>
              {patient.status && (
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border capitalize ${statusBadge(patient.status)}`}>
                  {patient.status}
                </span>
              )}
              {patient.mrn && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-neutral-100 text-neutral-600">
                  MRN: {patient.mrn}
                </span>
              )}
            </div>
            <p className="text-sm text-neutral-500 mt-1">
              {[patient.age ? `${patient.age} Years` : null, patient.gender, patient.phone].filter(Boolean).join(" · ")}
            </p>
            {clinic && (
              <p className="flex items-center gap-1 text-xs text-primary-600 font-medium mt-1">
                <MapPin className="h-3 w-3" />{clinic}
              </p>
            )}
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => router.back()}
              className="h-[38px] px-3.5 rounded-lg border border-neutral-300 bg-white text-neutral-700 text-sm font-medium hover:bg-neutral-50 transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <Link
              href="/receptionist/appointments"
              className="h-[38px] px-4 rounded-lg bg-brand-gradient text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-1.5 whitespace-nowrap"
            >
              <CalendarPlus className="h-4 w-4" /> Book Appointment
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={
              tab === t
                ? "h-8 px-3.5 rounded-full text-xs font-medium bg-brand-gradient text-white"
                : "h-8 px-3.5 rounded-full text-xs font-medium border border-neutral-300 bg-white text-neutral-600"
            }
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
      <>
      {/* Approve / Reject actions for pending patients */}
      {isPending && (
        <Card>
          <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 py-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-700">Pending Registration Approval</p>
              <p className="text-xs text-neutral-500 mt-0.5">
                This patient self-registered and is waiting for your review.
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={handleApprove}
                disabled={!!actionLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading === "approve"
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <CheckCircle className="h-3.5 w-3.5" />}
                Approve
              </button>
              <button
                onClick={() => setRejectModal(true)}
                disabled={!!actionLoading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-red-200 text-red-700 text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                <XCircle className="h-3.5 w-3.5" />
                Reject
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Registration progress — horizontal stepper */}
      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-neutral-700">Registration Progress</h3></CardHeader>
        <CardContent>
          <div className="flex items-start overflow-x-auto pb-1">
            {REGISTRATION_STEPS.map((step, i) => {
              const done = currentStepIndex >= 0 && i <= currentStepIndex;
              const isLast = i === REGISTRATION_STEPS.length - 1;
              return (
                <Fragment key={step.key}>
                  <div className="flex flex-col items-center flex-shrink-0 w-16">
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-colors ${
                      done ? "bg-green-500 border-green-500" : "bg-white border-neutral-300"
                    }`}>
                      {done && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                    </span>
                    <span className={`text-[10px] mt-1.5 text-center leading-tight ${done ? "text-neutral-800 font-medium" : "text-neutral-400"}`}>
                      {step.label}
                    </span>
                  </div>
                  {!isLast && (
                    <span className={`h-0.5 flex-1 mt-2.5 min-w-[0.75rem] transition-colors ${done ? "bg-green-500" : "bg-neutral-200"}`} />
                  )}
                </Fragment>
              );
            })}
          </div>
          {!registrationStatus && !journeyError && <p className="text-xs text-neutral-400 mt-1">Loading…</p>}
          {journeyError && <p className="text-xs text-red-500 mt-1">{journeyError}</p>}
        </CardContent>
      </Card>

      {/* Disease selection / anamnesis / general PRS */}
      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-neutral-700">Registration Record</h3></CardHeader>
        <CardContent className="space-y-4">
          {journeyDetail ? (
            <PatientJourneySections detail={journeyDetail as unknown as PatientJourneyDetail} />
          ) : (
            !journeyError && <p className="text-xs text-neutral-400">Loading…</p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Contact Information */}
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-neutral-700">Contact Information</h3></CardHeader>
          <CardContent className="space-y-4">
            <InfoRow icon={Mail}     label="Email"         value={patient.email} />
            <InfoRow icon={Phone}    label="Phone"         value={patient.phone} />
            <InfoRow icon={Calendar} label="Date of Birth"
              value={patient.date_of_birth
                ? new Date(patient.date_of_birth).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
                : null}
            />
            <InfoRow icon={User}     label="Gender"
              value={patient.gender
                ? patient.gender.charAt(0).toUpperCase() + patient.gender.slice(1)
                : null}
            />
            {clinic && <InfoRow icon={MapPin} label="Clinic" value={clinic} />}
          </CardContent>
        </Card>

        {/* Allocate to Doctor */}
        <Card>
          <CardHeader>
            <h3 className="text-sm font-semibold text-neutral-700">Allocate to Doctor</h3>
          </CardHeader>
          <CardContent className="space-y-4">
            {patient.doctor_name && !reallocating ? (
              <div className="flex flex-col items-center justify-center py-4 text-center gap-2">
                <UserCheck className="h-8 w-8 text-green-500" />
                <p className="text-sm font-medium text-green-700">Currently allocated to Dr. {patient.doctor_name}</p>
                <button
                  onClick={() => { setReallocating(true); setSelectedDoctor(""); }}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Reallocate
                </button>
              </div>
            ) : (
              <>
                <p className="text-xs text-neutral-500">
                  Assign this patient to an available doctor at your clinic.
                </p>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                    Select Doctor <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedDoctor}
                    onChange={(e) => setSelectedDoctor(e.target.value)}
                    className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-neutral-700"
                  >
                    <option value="">— Choose a doctor —</option>
                    {doctors.map((d) => (
                      <option key={d.id} value={d.id}>
                        Dr. {d.first_name} {d.last_name}
                        {d.specialization ? ` — ${d.specialization}` : ""}
                        {` (${d.patient_count} patients)`}
                      </option>
                    ))}
                  </select>
                </div>

                {doctors.length === 0 && (
                  <p className="text-xs text-neutral-400">No doctors available at your clinic. Contact admin.</p>
                )}

                <div className="flex gap-2">
                  {patient.doctor_name && (
                    <button
                      onClick={() => { setReallocating(false); setSelectedDoctor(""); }}
                      className="px-4 py-2.5 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={handleAllocate}
                    disabled={!selectedDoctor || allocating}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {allocating
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Allocating…</>
                      : <><Stethoscope className="h-3.5 w-3.5" />Allocate Doctor</>}
                  </button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Medical Information */}
      {(patient.medical_history || patient.emergency_contact || patient.blood_group) && (
        <Card>
          <CardHeader><h3 className="text-sm font-semibold text-neutral-700">Medical Information</h3></CardHeader>
          <CardContent className="space-y-4">
            <InfoRow icon={AlertCircle} label="Emergency Contact" value={patient.emergency_contact} />
            <InfoRow icon={Heart}       label="Blood Group"       value={patient.blood_group} />
            {patient.medical_history && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <ClipboardList className="h-4 w-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-neutral-400">Medical History</p>
                  <p className="text-sm text-neutral-800 mt-0.5 whitespace-pre-wrap leading-relaxed">
                    {patient.medical_history}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      </>
      )}

      {tab === "Appointments" && (
        <Card>
          {apptsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-neutral-200 border-t-primary-500 rounded-full animate-spin" />
            </div>
          ) : appointments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <Calendar className="w-8 h-8 text-neutral-200 mb-2" />
              <p className="text-sm font-medium text-neutral-400">No appointments yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div style={{ minWidth: 640 }}>
                <div className="grid gap-3 px-5 py-2.5 bg-neutral-50 border-b border-neutral-100" style={{ gridTemplateColumns: "1.2fr 1.2fr 1fr 1fr" }}>
                  {["Date / Time", "Doctor", "Visit Type", "Status"].map((h) => (
                    <span key={h} className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">{h}</span>
                  ))}
                </div>
                {[...appointments]
                  .sort((a, b) => b.appointment_date.localeCompare(a.appointment_date))
                  .map((a) => (
                    <div key={a.appointment_id} className="grid gap-3 items-center px-5 py-3 border-b border-neutral-100 last:border-0" style={{ gridTemplateColumns: "1.2fr 1.2fr 1fr 1fr" }}>
                      <span className="text-xs text-neutral-700">{fmtDate(a.appointment_date)}, {fmt12(a.start_time)}</span>
                      <span className="text-xs text-neutral-700">{a.doctor_name ? `Dr. ${a.doctor_name}` : "—"}</span>
                      <span className="text-xs text-neutral-600 capitalize truncate">{(a.appointment_type ?? "").replace(/_/g, " ")}</span>
                      <ApptStatusChip status={a.status} />
                    </div>
                  ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {tab === "Timeline" && (
        <Card>
          {!patient.recent_sessions || patient.recent_sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <ClipboardList className="w-8 h-8 text-neutral-200 mb-2" />
              <p className="text-sm font-medium text-neutral-400">No session history yet</p>
            </div>
          ) : (
            <div className="px-6 py-5">
              {[...patient.recent_sessions]
                .sort((a, b) => (b.session_date ?? "").localeCompare(a.session_date ?? ""))
                .map((s, i, arr) => (
                  <div key={s.id} className="flex gap-4">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-2.5 h-2.5 rounded-full bg-primary-500 mt-1.5" />
                      {i < arr.length - 1 && <div className="w-0.5 flex-1 bg-neutral-200 min-h-[30px]" />}
                    </div>
                    <div className="pb-5">
                      <p className="text-[11px] font-semibold text-neutral-400">
                        {s.session_date
                          ? new Date(s.session_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                          : "—"}
                      </p>
                      <p className="text-sm text-neutral-800 mt-0.5">
                        {s.title || "Session"}{s.session_type ? ` — ${s.session_type}` : ""}
                        {s.status ? ` (${s.status})` : ""}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </Card>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-neutral-900">Reject Registration</h3>
            <p className="text-sm text-neutral-500">
              Rejecting will notify <span className="font-medium text-neutral-800">{name}</span> that their registration was not approved.
            </p>
            <div>
              <label className="text-xs font-medium text-neutral-700 block mb-1.5">
                Reason <span className="text-neutral-400">(optional)</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Provide a reason to help the patient understand…"
                rows={3}
                className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-300 transition"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setRejectModal(false); setRejectReason(""); }}
                className="flex-1 px-4 py-2 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading === "reject"}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading === "reject" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
