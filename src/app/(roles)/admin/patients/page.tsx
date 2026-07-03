"use client";

import { Fragment, useEffect, useState } from "react";
import {
  Users, Search, X, Check, XCircle, Trash2, Edit2,
  Clock, Building2, Calendar, Plus, RefreshCw, FileText, ShieldCheck,
} from "lucide-react";
import { useAdminPatients, useAdminClinics } from "@/lib/hooks";
import { Card, CardContent, Button, Input, Skeleton, Modal, DetailFieldList } from "@/components/ui";
import { consentService, type ConsentRecord } from "@/lib/api/services/consent.service";
import { filesService, type PatientFile } from "@/lib/api/services/files.service";
import { adminService } from "@/lib/api/services/admin.service";
import { PatientJourneySections, type PatientJourneyDetail } from "@/components/admin/PatientJourneySections";
import type { AdminClinic, AdminPatient } from "@/types/admin.types";

const CLINIC_STATUS_STYLES: Record<AdminClinic["status"], string> = {
  setup: "bg-amber-100 text-amber-700",
  active: "bg-green-100 text-green-700",
  pending_closure: "bg-orange-100 text-orange-700",
  closed: "bg-neutral-200 text-neutral-600",
};
const CLINIC_STATUS_LABELS: Record<AdminClinic["status"], string> = {
  setup: "Setup", active: "Active", pending_closure: "Closing", closed: "Closed",
};

// Matches patients/service.py _REGISTRATION_STEPS exactly — registration_status
// is a single field that means "everything up to and including this step is done".
const REGISTRATION_STEPS: { key: string; label: string }[] = [
  { key: "demographics_complete", label: "Demographics" },
  { key: "disease_selected", label: "Disease Selection" },
  { key: "consent_signed", label: "Consent Signed" },
  { key: "anamnesis_complete", label: "Anamnesis" },
  { key: "general_prs_complete", label: "General PRS" },
  { key: "registration_complete", label: "Registration Complete" },
];

// ─── Skeleton ─────────────────────────────────────────────────────

function PatientsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <div className="flex gap-3">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="bg-white rounded-xl border border-neutral-200/80 overflow-hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-neutral-100 last:border-0">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20 rounded-lg" />
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────

function StatusBadge({ status }: { status: AdminPatient["approval_status"] }) {
  const map = {
    pending:  { bg: "bg-amber-100",  text: "text-amber-700",  icon: Clock,    label: "Pending" },
    approved: { bg: "bg-green-100",  text: "text-green-700",  icon: Check,    label: "Approved" },
    rejected: { bg: "bg-red-100",    text: "text-red-600",    icon: XCircle,  label: "Rejected" },
  };
  const cfg = map[status] ?? map.pending;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
      <cfg.icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

// ─── Register Patient Form ────────────────────────────────────────

function RegisterPatientForm({ clinicOptions, onSubmit, onClose }: {
  clinicOptions: { value: string; label: string }[];
  onSubmit: (data: { email: string; first_name: string; last_name: string; phone?: string; gender?: string; dob?: string; address?: string; primary_clinic_id: string; emergency_contact_name?: string; emergency_contact_phone?: string }) => Promise<unknown>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    email: "", first_name: "", last_name: "", phone: "", gender: "", dob: "", address: "",
    primary_clinic_id: "", emergency_contact_name: "", emergency_contact_phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.trim() || !form.first_name.trim() || !form.last_name.trim()) { setError("Email, first name, and last name are required"); return; }
    if (!form.primary_clinic_id) { setError("Select a clinic"); return; }
    setLoading(true);
    setError(null);
    try {
      await onSubmit(form);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.detail || "Failed to register patient");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">First Name *</label>
          <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Last Name *</label>
          <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} required />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Email *</label>
        <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Clinic *</label>
        <select
          value={form.primary_clinic_id}
          onChange={(e) => set("primary_clinic_id", e.target.value)}
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white"
        >
          <option value="">Select clinic…</option>
          {clinicOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Phone</label>
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Date of Birth</label>
          <Input type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Gender</label>
        <select value={form.gender} onChange={(e) => set("gender", e.target.value)} className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white h-9">
          <option value="">—</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Address</label>
        <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Emergency Contact Name</label>
          <Input value={form.emergency_contact_name} onChange={(e) => set("emergency_contact_name", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Emergency Contact Phone</label>
          <Input value={form.emergency_contact_phone} onChange={(e) => set("emergency_contact_phone", e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? "Registering…" : "Register Patient"}</Button>
      </div>
    </form>
  );
}

// ─── Edit Patient Form ─────────────────────────────────────────────

function EditPatientForm({ patient, onSubmit, onClose }: {
  patient: AdminPatient;
  onSubmit: (data: { first_name?: string; last_name?: string; phone?: string; gender?: string; dob?: string; address?: string; emergency_contact_name?: string; emergency_contact_phone?: string }) => Promise<unknown>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    first_name: patient.first_name ?? "",
    last_name: patient.last_name ?? "",
    phone: patient.phone ?? "",
    gender: patient.gender ?? "",
    dob: patient.date_of_birth ?? "",
    address: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(field: K, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim()) { setError("First name and last name are required"); return; }
    setLoading(true);
    setError(null);
    try {
      await onSubmit(form);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.detail || "Failed to update patient");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">First Name *</label>
          <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Last Name *</label>
          <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Phone</label>
          <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Date of Birth</label>
          <Input type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Gender</label>
        <select value={form.gender} onChange={(e) => set("gender", e.target.value)} className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white h-9">
          <option value="">—</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Address</label>
        <Input value={form.address} onChange={(e) => set("address", e.target.value)} />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Update Patient"}</Button>
      </div>
    </form>
  );
}

// ─── Confirm Delete ───────────────────────────────────────────────

function ConfirmDelete({ patient, onConfirm, onClose }: {
  patient: AdminPatient;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  async function confirm() {
    setLoading(true);
    try { await onConfirm(); onClose(); } finally { setLoading(false); }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-700">
        Permanently delete <strong>{patient.first_name} {patient.last_name}</strong>? This action cannot be undone.
      </p>
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          disabled={loading}
          className="bg-red-600 hover:bg-red-700 focus:ring-red-500"
          onClick={confirm}
        >
          {loading ? "Deleting…" : "Delete Patient"}
        </Button>
      </div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────

function PatientDetailModal({ patient, clinic }: { patient: AdminPatient; clinic?: AdminClinic }) {
  const [consents, setConsents] = useState<ConsentRecord[] | null>(null);
  const [files, setFiles] = useState<PatientFile[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    setConsents(null);
    setFiles(null);
    setLoadError(null);
    const loaders: Promise<unknown>[] = [];
    if (patient.profile_id) {
      loaders.push(consentService.listForSubject({ patient_id: patient.profile_id }).then(setConsents).catch(() => setLoadError("Couldn't load consent records")));
    }
    loaders.push(filesService.listPatientFiles(patient.id, "medical_history").then(setFiles).catch(() => setLoadError("Couldn't load files")));
  }, [patient.id, patient.profile_id]);

  useEffect(() => {
    setDetail(null);
    setDetailError(null);
    adminService.getPatientDetail(patient.id).then(setDetail).catch(() => setDetailError("Couldn't load full record"));
  }, [patient.id]);

  const currentStepIndex = REGISTRATION_STEPS.findIndex((s) => s.key === patient.registration_status);
  const medicalHistorySubmitted = files !== null && files.length > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold flex-shrink-0">
          {[patient.first_name?.[0], patient.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "?"}
        </div>
        <div>
          <p className="font-semibold text-neutral-900">{patient.first_name} {patient.last_name}</p>
          <StatusBadge status={patient.approval_status} />
        </div>
      </div>

      {clinic && (
        <div className="flex items-center justify-between px-4 py-2.5 text-sm border border-neutral-100 rounded-lg">
          <span className="text-neutral-500">Clinic</span>
          <span className="flex items-center gap-1.5 text-neutral-800 font-medium">
            {clinic.clinic_name}
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${CLINIC_STATUS_STYLES[clinic.status]}`}>
              {CLINIC_STATUS_LABELS[clinic.status]}
            </span>
          </span>
        </div>
      )}

      {detail === null ? (
        detailError ? <p className="text-xs text-red-500">{detailError}</p> : <p className="text-xs text-neutral-400">Loading full record…</p>
      ) : (
        <DetailFieldList
          data={detail}
          exclude={["profile_id", "primary_clinic_id", "clinic_name", "diseases", "anamnesis", "anamnesis_responses", "anamnesis_catalog", "general_prs"]}
        />
      )}

      {detail && <PatientJourneySections detail={detail as unknown as PatientJourneyDetail} />}

      {/* Registration progress — horizontal stepper */}
      <div>
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Registration Progress</p>
        <div className="flex items-start overflow-x-auto pb-1">
          {REGISTRATION_STEPS.map((step, i) => {
            const done = currentStepIndex >= 0 && i <= currentStepIndex;
            const isLast = i === REGISTRATION_STEPS.length - 1;
            return (
              <Fragment key={step.key}>
                {/* Fixed-width column — dot and label share the same width so
                    the label centers exactly under its own dot, not under
                    the connector line next to it. */}
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
        {!patient.registration_status && (
          <p className="text-xs text-neutral-400 mt-1">No registration_status on record.</p>
        )}
      </div>

      {/* Medical history */}
      <div className="flex items-center justify-between text-sm border border-neutral-100 rounded-lg px-4 py-2.5">
        <span className="flex items-center gap-2 text-neutral-600"><FileText className="h-4 w-4 text-neutral-400" />Medical History</span>
        {files === null ? (
          <span className="text-neutral-400 text-xs">Loading…</span>
        ) : (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${medicalHistorySubmitted ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"}`}>
            {medicalHistorySubmitted ? `${files.length} file${files.length !== 1 ? "s" : ""} submitted` : "Not submitted"}
          </span>
        )}
      </div>

      {/* Consent records */}
      <div>
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />Consent Records
        </p>
        {!patient.profile_id ? (
          <p className="text-xs text-neutral-400">No profile_id on record — can't look up consent.</p>
        ) : consents === null ? (
          <p className="text-xs text-neutral-400">Loading…</p>
        ) : consents.length === 0 ? (
          <p className="text-xs text-neutral-400">No consent records found.</p>
        ) : (
          <div className="divide-y divide-neutral-100 border border-neutral-100 rounded-lg overflow-hidden">
            {consents.map((c) => (
              <div key={c.consent_id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-neutral-700 capitalize">{c.consent_type.replace(/_/g, " ")}</span>
                <span className="flex items-center gap-2">
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

      {loadError && <p className="text-xs text-red-500">{loadError}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────

export default function AdminPatientsPage() {
  const { patients, isLoading, error, fetch, registerPatient, updatePatient, approvePatient, rejectPatient, deletePatient } = useAdminPatients();
  const { clinics, fetch: fetchClinics } = useAdminClinics();

  const [tab, setTab] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [search, setSearch] = useState("");
  const [clinicFilter, setClinicFilter] = useState("all");
  const [showRegister, setShowRegister] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminPatient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminPatient | null>(null);
  const [detailPatient, setDetailPatient] = useState<AdminPatient | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetch(); fetchClinics(); }, [fetch, fetchClinics]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await Promise.all([fetch(), fetchClinics()]); } finally { setRefreshing(false); }
  }

  const pendingCount  = patients.filter((p) => p.approval_status === "pending").length;
  const approvedCount = patients.filter((p) => p.approval_status === "approved").length;
  const rejectedCount = patients.filter((p) => p.approval_status === "rejected").length;

  const filtered = patients.filter((p) => {
    const name = `${p.first_name} ${p.last_name}`.toLowerCase();
    const matchesSearch =
      name.includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase()) ||
      (p.mrn ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesClinic = clinicFilter === "all" || p.clinic_id === clinicFilter;
    const matchesTab = tab === "all" || p.approval_status === tab;
    return matchesSearch && matchesClinic && matchesTab;
  });

  async function handleApprove(id: string) {
    setProcessingId(id);
    setActionError(null);
    try { await approvePatient(id); } catch (e: any) {
      setActionError(e?.response?.data?.detail || "Failed to approve patient");
    } finally { setProcessingId(null); }
  }

  async function handleReject(id: string) {
    setProcessingId(id);
    setActionError(null);
    try { await rejectPatient(id); } catch (e: any) {
      setActionError(e?.response?.data?.detail || "Failed to reject patient");
    } finally { setProcessingId(null); }
  }

  const initials = (p: AdminPatient) =>
    [p.first_name?.[0], p.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "?";

  const clinicOptions = clinics.map((c) => ({ value: c.clinic_id, label: c.clinic_name }));
  const clinicById = new Map(clinics.map((c) => [c.clinic_id, c]));

  if (isLoading) return <PatientsSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Patients</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{patients.length} total patients</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh"
            className="p-2.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <Button onClick={() => setShowRegister(true)}>
            <Plus className="h-4 w-4 mr-1.5" />Register Patient
          </Button>
        </div>
      </div>

      {(error || actionError) && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error || actionError}</span>
          <button onClick={() => setActionError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1 w-fit">
        {([
          { key: "all",      label: "All",      count: patients.length },
          { key: "pending",  label: "Pending",  count: pendingCount  },
          { key: "approved", label: "Approved", count: approvedCount },
          { key: "rejected", label: "Rejected", count: rejectedCount },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === t.key ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {t.label}
            <span className={`text-[10px] font-semibold rounded-full px-1.5 py-0.5 min-w-[18px] text-center ${
              tab === t.key ? "bg-blue-100 text-blue-700" : "bg-neutral-200 text-neutral-500"
            }`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, email, MRN…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-neutral-400" />
            </button>
          )}
        </div>
        <select
          value={clinicFilter}
          onChange={(e) => setClinicFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="all">All Clinics</option>
          {clinicOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {/* Patient Table */}
      <Card>
        {filtered.length === 0 ? (
          <CardContent className="py-16 text-center">
            <Users className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-600">No patients found</p>
            <p className="text-xs text-neutral-400 mt-1">
              {search ? "Try a different search term" : `No ${tab === "all" ? "" : tab + " "}patients`}
            </p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Patient</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Clinic</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">DOB / Gender</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Status</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((patient) => {
                  const patientClinic = patient.clinic_id ? clinicById.get(patient.clinic_id) : undefined;
                  return (
                  <tr key={patient.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="px-6 py-3.5">
                      <button
                        onClick={() => setDetailPatient(patient)}
                        className="flex items-center gap-3 text-left hover:opacity-75 transition-opacity"
                      >
                        <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold text-xs flex-shrink-0">
                          {initials(patient)}
                        </div>
                        <div>
                          <p className="font-medium text-neutral-900 underline decoration-dotted decoration-neutral-300 underline-offset-2">
                            {patient.first_name} {patient.last_name}
                          </p>
                          <p className="text-xs text-neutral-500 mt-0.5">{patient.email}</p>
                          {patient.mrn && (
                            <p className="text-[10px] text-neutral-400 font-mono">MRN: {patient.mrn}</p>
                          )}
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                        <Building2 className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
                        <span className="truncate max-w-[110px]">{patient.clinic_name ?? "—"}</span>
                        {patientClinic && (
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${CLINIC_STATUS_STYLES[patientClinic.status]}`}>
                            {CLINIC_STATUS_LABELS[patientClinic.status]}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="text-xs text-neutral-600 space-y-0.5">
                        {patient.date_of_birth && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-neutral-400" />
                            {new Date(patient.date_of_birth).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                          </div>
                        )}
                        {patient.gender && (
                          <span className="capitalize text-neutral-500">{patient.gender}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <StatusBadge status={patient.approval_status} />
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        {patient.approval_status === "pending" && (
                          <>
                            <button
                              onClick={() => handleApprove(patient.id)}
                              disabled={processingId === patient.id}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors disabled:opacity-50"
                            >
                              <Check className="h-3.5 w-3.5" />
                              Approve
                            </button>
                            <button
                              onClick={() => handleReject(patient.id)}
                              disabled={processingId === patient.id}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors disabled:opacity-50"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Reject
                            </button>
                          </>
                        )}
                        {patient.approval_status === "rejected" && (
                          <button
                            onClick={() => handleApprove(patient.id)}
                            disabled={processingId === patient.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Approve
                          </button>
                        )}
                        <button
                          onClick={() => setEditTarget(patient)}
                          className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(patient)}
                          className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Register modal */}
      <Modal isOpen={showRegister} onClose={() => setShowRegister(false)} title="Register Patient">
        <RegisterPatientForm clinicOptions={clinicOptions} onSubmit={registerPatient} onClose={() => setShowRegister(false)} />
      </Modal>

      {/* Detail modal */}
      <Modal isOpen={!!detailPatient} onClose={() => setDetailPatient(null)} title="Patient Details" className="max-w-3xl">
        {detailPatient && (
          <PatientDetailModal
            patient={detailPatient}
            clinic={detailPatient.clinic_id ? clinicById.get(detailPatient.clinic_id) : undefined}
          />
        )}
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Patient">
        {editTarget && (
          <EditPatientForm
            patient={editTarget}
            onSubmit={(data) => updatePatient(editTarget.id, data)}
            onClose={() => setEditTarget(null)}
          />
        )}
      </Modal>

      {/* Delete modal */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Patient">
        {deleteTarget && (
          <ConfirmDelete
            patient={deleteTarget}
            onConfirm={() => deletePatient(deleteTarget.id)}
            onClose={() => setDeleteTarget(null)}
          />
        )}
      </Modal>
    </div>
  );
}
