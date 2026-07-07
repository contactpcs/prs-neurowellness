"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import {
  Users, Search, X, Check, Trash2, Edit2,
  Building2, Calendar, Plus, RefreshCw, FileText, ShieldCheck, Power, PowerOff,
} from "lucide-react";
import { useAuth } from "@/lib/hooks";
import { Card, CardContent, Button, Input, Skeleton, Modal, DetailFieldList } from "@/components/ui";
import { adminService } from "@/lib/api/services/admin.service";
import { consentService, type ConsentRecord } from "@/lib/api/services/consent.service";
import { filesService, type PatientFile } from "@/lib/api/services/files.service";
import { PatientJourneySections, type PatientJourneyDetail } from "@/components/admin/PatientJourneySections";
import type { AdminClinic, AdminPatient } from "@/types/admin.types";

const REGISTRATION_STEPS: { key: string; label: string }[] = [
  { key: "demographics_complete", label: "Demographics" },
  { key: "disease_selected", label: "Disease Selection" },
  { key: "consent_signed", label: "Consent Signed" },
  { key: "anamnesis_complete", label: "Anamnesis" },
  { key: "general_prs_complete", label: "General PRS" },
  { key: "registration_complete", label: "Registration Complete" },
];

function PatientsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <div className="bg-white rounded-xl border border-neutral-200/80 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-neutral-100 last:border-0">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

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
        <select value={form.primary_clinic_id} onChange={(e) => set("primary_clinic_id", e.target.value)} className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white">
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

function EditPatientForm({ patient, onSubmit, onClose }: {
  patient: AdminPatient;
  onSubmit: (data: { first_name?: string; last_name?: string; phone?: string; gender?: string; dob?: string; address?: string; emergency_contact_name?: string; emergency_contact_phone?: string }) => Promise<unknown>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    first_name: patient.first_name ?? "", last_name: patient.last_name ?? "",
    phone: patient.phone ?? "", gender: patient.gender ?? "", dob: patient.date_of_birth ?? "", address: "",
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

function ConfirmDelete({ patient, onConfirm, onClose }: {
  patient: AdminPatient; onConfirm: () => Promise<void>; onClose: () => void;
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
        <Button variant="danger" disabled={loading} onClick={confirm}>{loading ? "Deleting…" : "Delete Patient"}</Button>
      </div>
    </div>
  );
}

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
    if (patient.profile_id) {
      consentService.listForSubject({ patient_id: patient.profile_id }).then(setConsents).catch(() => setLoadError("Couldn't load consent records"));
    }
    filesService.listPatientFiles(patient.id, "medical_history").then(setFiles).catch(() => setLoadError("Couldn't load files"));
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
        <p className="font-semibold text-neutral-900">{patient.first_name} {patient.last_name}</p>
      </div>

      {clinic && (
        <div className="flex items-center justify-between px-4 py-2.5 text-sm border border-neutral-100 rounded-lg">
          <span className="text-neutral-500">Clinic</span>
          <span className="text-neutral-800 font-medium">{clinic.clinic_name}</span>
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

      <div>
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Registration Progress</p>
        <div className="flex items-start overflow-x-auto pb-1">
          {REGISTRATION_STEPS.map((step, i) => {
            const done = currentStepIndex >= 0 && i <= currentStepIndex;
            const isLast = i === REGISTRATION_STEPS.length - 1;
            return (
              <Fragment key={step.key}>
                <div className="flex flex-col items-center flex-shrink-0 w-16">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border-2 transition-colors ${done ? "bg-green-500 border-green-500" : "bg-white border-neutral-300"}`}>
                    {done && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                  </span>
                  <span className={`text-[10px] mt-1.5 text-center leading-tight ${done ? "text-neutral-800 font-medium" : "text-neutral-400"}`}>{step.label}</span>
                </div>
                {!isLast && <span className={`h-0.5 flex-1 mt-2.5 min-w-[0.75rem] transition-colors ${done ? "bg-green-500" : "bg-neutral-200"}`} />}
              </Fragment>
            );
          })}
        </div>
      </div>

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

      <div>
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />Consent Records
        </p>
        {!patient.profile_id ? (
          <p className="text-xs text-neutral-400">No profile_id on record.</p>
        ) : consents === null ? (
          <p className="text-xs text-neutral-400">Loading…</p>
        ) : consents.length === 0 ? (
          <p className="text-xs text-neutral-400">No consent records found.</p>
        ) : (
          <div className="divide-y divide-neutral-100 border border-neutral-100 rounded-lg overflow-hidden">
            {consents.map((c) => (
              <div key={c.consent_id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="text-neutral-700 capitalize">{c.consent_type.replace(/_/g, " ")}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  c.status === "signed" ? "bg-green-100 text-green-700" : c.status === "revoked" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"
                }`}>{c.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {loadError && <p className="text-xs text-red-500">{loadError}</p>}
    </div>
  );
}

export default function RegionalAdminPatientsPage() {
  const { user } = useAuth();
  const [clinics, setClinics] = useState<AdminClinic[]>([]);
  const [patients, setPatients] = useState<AdminPatient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [clinicFilter, setClinicFilter] = useState("all");
  const [showRegister, setShowRegister] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminPatient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminPatient | null>(null);
  const [detailPatient, setDetailPatient] = useState<AdminPatient | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.region_id) return;
    setError(null);
    try {
      const regionClinics = await adminService.getClinics({ region_id: user.region_id });
      setClinics(regionClinics);
      const results = await Promise.all(regionClinics.map((c) => adminService.getPatients({ clinic_id: c.clinic_id })));
      setPatients(results.flatMap((r) => r.patients));
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Failed to load patients");
    }
  }, [user?.region_id]);

  useEffect(() => { setIsLoading(true); load().finally(() => setIsLoading(false)); }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  const clinicOptions = clinics.map((c) => ({ value: c.clinic_id, label: c.clinic_name }));
  const clinicById = new Map(clinics.map((c) => [c.clinic_id, c]));

  const filtered = patients.filter((p) => {
    const name = `${p.first_name} ${p.last_name}`.toLowerCase();
    const matchesSearch = name.includes(search.toLowerCase()) || p.email.toLowerCase().includes(search.toLowerCase()) || (p.mrn ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesClinic = clinicFilter === "all" || p.clinic_id === clinicFilter;
    return matchesSearch && matchesClinic;
  });

  async function handleRegister(data: { email: string; first_name: string; last_name: string; phone?: string; gender?: string; dob?: string; address?: string; primary_clinic_id: string; emergency_contact_name?: string; emergency_contact_phone?: string }) {
    const created = await adminService.registerPatient(data);
    setPatients((prev) => [created, ...prev]);
    return created;
  }
  async function handleUpdate(id: string, data: Parameters<typeof adminService.updatePatient>[1]) {
    const updated = await adminService.updatePatient(id, data);
    setPatients((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  }
  async function handleDelete(id: string) {
    await adminService.deletePatient(id);
    setPatients((prev) => prev.filter((p) => p.id !== id));
  }
  async function handleToggleActive(patient: AdminPatient) {
    setProcessingId(patient.id);
    setActionError(null);
    try {
      const updated = await adminService.updatePatient(patient.id, { is_active: !patient.is_active });
      setPatients((prev) => prev.map((p) => (p.id === patient.id ? updated : p)));
    } catch (e: any) {
      setActionError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Failed to update patient status");
    } finally {
      setProcessingId(null);
    }
  }

  const initials = (p: AdminPatient) => [p.first_name?.[0], p.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "?";

  if (isLoading) return <PatientsSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Patients</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{patients.length} patient{patients.length !== 1 ? "s" : ""} across your region</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} disabled={refreshing} title="Refresh"
            className="p-2.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <Button onClick={() => setShowRegister(true)}><Plus className="h-4 w-4 mr-1.5" />Register Patient</Button>
        </div>
      </div>

      {(error || actionError) && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error || actionError}</span>
          <button onClick={() => setActionError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, MRN…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg bg-white" />
        </div>
        <select value={clinicFilter} onChange={(e) => setClinicFilter(e.target.value)} className="px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white">
          <option value="all">All Clinics</option>
          {clinicOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <CardContent className="py-16 text-center">
            <Users className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-600">No patients found</p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Patient</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Clinic</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">DOB / Gender</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((patient) => (
                  <tr key={patient.id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="px-6 py-3.5">
                      <button onClick={() => setDetailPatient(patient)} className="flex items-center gap-3 text-left hover:opacity-75 transition-opacity">
                        <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold text-xs flex-shrink-0">
                          {initials(patient)}
                        </div>
                        <div>
                          <p className="font-medium text-neutral-900 underline decoration-dotted decoration-neutral-300 underline-offset-2">
                            {patient.first_name} {patient.last_name}
                          </p>
                          <p className="text-xs text-neutral-500 mt-0.5">{patient.email}</p>
                          {patient.mrn && <p className="text-[10px] text-neutral-400 font-mono">MRN: {patient.mrn}</p>}
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                        <Building2 className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
                        <span className="truncate max-w-[110px]">{patient.clinic_id ? clinicById.get(patient.clinic_id)?.clinic_name ?? "—" : "—"}</span>
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
                        {patient.gender && <span className="capitalize text-neutral-500">{patient.gender}</span>}
                      </div>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => setEditTarget(patient)} className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors" title="Edit">
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggleActive(patient)}
                          disabled={processingId === patient.id}
                          title={patient.is_active === false ? "Reactivate" : "Deactivate"}
                          className={`p-1.5 rounded-lg transition-colors ${
                            patient.is_active === false
                              ? "text-green-500 hover:text-green-700 hover:bg-green-50"
                              : "text-amber-500 hover:text-amber-700 hover:bg-amber-50"
                          }`}
                        >
                          {patient.is_active === false ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                        </button>
                        <button onClick={() => setDeleteTarget(patient)} className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={showRegister} onClose={() => setShowRegister(false)} title="Register Patient">
        <RegisterPatientForm clinicOptions={clinicOptions} onSubmit={handleRegister} onClose={() => setShowRegister(false)} />
      </Modal>

      <Modal isOpen={!!detailPatient} onClose={() => setDetailPatient(null)} title="Patient Details" className="max-w-3xl">
        {detailPatient && <PatientDetailModal patient={detailPatient} clinic={detailPatient.clinic_id ? clinicById.get(detailPatient.clinic_id) : undefined} />}
      </Modal>

      <Modal isOpen={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Patient">
        {editTarget && <EditPatientForm patient={editTarget} onSubmit={(data) => handleUpdate(editTarget.id, data)} onClose={() => setEditTarget(null)} />}
      </Modal>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Patient">
        {deleteTarget && <ConfirmDelete patient={deleteTarget} onConfirm={() => handleDelete(deleteTarget.id)} onClose={() => setDeleteTarget(null)} />}
      </Modal>
    </div>
  );
}
