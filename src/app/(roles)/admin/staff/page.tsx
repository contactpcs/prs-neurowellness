"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  UserCog, Plus, Search, Edit2, Power, PowerOff, Trash2,
  X, Mail, Building2, RefreshCw, ShieldCheck,
} from "lucide-react";
import { useAdminStaff, useAdminClinics } from "@/lib/hooks";
import { Card, CardContent, Button, Input, Skeleton, Modal, DetailFieldList } from "@/components/ui";
import { consentService, type ConsentRecord } from "@/lib/api/services/consent.service";
import { adminService } from "@/lib/api/services/admin.service";
import type { AdminClinic, AdminStaffMember, RegisterStaffPayload } from "@/types/admin.types";

const CLINIC_STATUS_STYLES: Record<AdminClinic["status"], string> = {
  setup: "bg-amber-100 text-amber-700",
  active: "bg-green-100 text-green-700",
  pending_closure: "bg-orange-100 text-orange-700",
  closed: "bg-neutral-200 text-neutral-600",
};
const CLINIC_STATUS_LABELS: Record<AdminClinic["status"], string> = {
  setup: "Setup", active: "Active", pending_closure: "Closing", closed: "Closed",
};

const ROLES = [
  { value: "doctor",             label: "Doctor" },
  { value: "receptionist",       label: "Receptionist" },
  { value: "clinical_assistant", label: "Clinical Assistant" },
  { value: "clinical_admin",     label: "Clinical Admin" },
];

const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  doctor:             { bg: "bg-blue-100",   text: "text-blue-700" },
  receptionist:       { bg: "bg-cyan-100",   text: "text-cyan-700" },
  clinical_assistant: { bg: "bg-teal-100",   text: "text-teal-700" },
  clinical_admin:     { bg: "bg-purple-100", text: "text-purple-700" },
  platform_admin:     { bg: "bg-rose-100",   text: "text-rose-700" },
};

function roleLabel(role: string) {
  return ROLES.find((r) => r.value === role)?.label ?? role.replace(/_/g, " ");
}

function roleColor(role: string) {
  return ROLE_COLORS[role] ?? { bg: "bg-neutral-100", text: "text-neutral-600" };
}

// ─── Skeleton ─────────────────────────────────────────────────────

function StaffSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="bg-white rounded-xl border border-neutral-200/80 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-neutral-100 last:border-0">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-8 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Register / Edit Form ─────────────────────────────────────────

interface StaffFormProps {
  initial?: Partial<AdminStaffMember>;
  clinicOptions: { value: string; label: string }[];
  onSubmit: (data: RegisterStaffPayload) => Promise<unknown>;
  onClose: () => void;
  isEdit?: boolean;
  /** Arrived here via "Assign Admin" on the Clinics page — locks role +
   * clinic so the person can't accidentally register a different kind of
   * staff member on that clinic. */
  lockClinicId?: string;
  lockRole?: string;
}

function StaffForm({ initial, clinicOptions, onSubmit, onClose, isEdit, lockClinicId, lockRole }: StaffFormProps) {
  const [form, setForm] = useState<RegisterStaffPayload>({
    first_name: initial?.first_name ?? "",
    last_name: initial?.last_name ?? "",
    email: initial?.email ?? "",
    password: "",
    role: lockRole ?? initial?.role ?? "doctor",
    clinic_id: lockClinicId ?? initial?.clinic_id ?? "",
    phone: initial?.phone ?? "",
    gender: undefined,
    dob: "",
    address: "",
    city: "",
    state: "",
    country: "India",
    pincode: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof RegisterStaffPayload>(field: K, value: RegisterStaffPayload[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.first_name.trim()) { setError("First name is required"); return; }
    if (!form.email.trim()) { setError("Email is required"); return; }
    if (!isEdit && form.role !== "clinical_admin" && !form.password.trim()) { setError("Password is required"); return; }
    if (!form.clinic_id) { setError("Please select a clinic"); return; }
    setLoading(true);
    setError(null);
    try {
      await onSubmit(form);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || "Failed to save staff member");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {lockRole === "clinical_admin" && (
        <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg px-3 py-2">
          Assigning this clinic's admin — role and clinic are fixed.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">First Name *</label>
          <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} placeholder="First name" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Last Name</label>
          <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} placeholder="Last name" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Email *</label>
        <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="staff@clinic.com" required />
      </div>
      {!isEdit && form.role !== "clinical_admin" && (
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Password *</label>
          <Input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="Temporary password" required />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Role *</label>
          <select
            value={form.role}
            onChange={(e) => set("role", e.target.value)}
            disabled={!!lockRole}
            className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white disabled:bg-neutral-100 disabled:text-neutral-500"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Phone</label>
          <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="+91 ..." />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Clinic *</label>
        <select
          value={form.clinic_id}
          onChange={(e) => set("clinic_id", e.target.value)}
          disabled={!!lockClinicId}
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white disabled:bg-neutral-100 disabled:text-neutral-500"
        >
          <option value="">Select clinic…</option>
          {clinicOptions.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Gender</label>
          <select
            value={form.gender ?? ""}
            onChange={(e) => set("gender", (e.target.value || undefined) as RegisterStaffPayload["gender"])}
            className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white h-9"
          >
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Date of Birth</label>
          <Input type="date" value={form.dob ?? ""} onChange={(e) => set("dob", e.target.value)} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Address</label>
        <Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} placeholder="Full address" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">City</label>
          <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">State</label>
          <Input value={form.state ?? ""} onChange={(e) => set("state", e.target.value)} />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : isEdit ? "Update Staff" : "Register Staff"}
        </Button>
      </div>
    </form>
  );
}

// ─── Confirm Delete Modal ─────────────────────────────────────────

function ConfirmDeleteModal({ member, onConfirm, onClose }: {
  member: AdminStaffMember;
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
        Are you sure you want to permanently delete{" "}
        <strong>{member.first_name} {member.last_name}</strong>? This action cannot be undone.
      </p>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          type="button"
          variant="danger"
          disabled={loading}
          onClick={confirm}
        >
          {loading ? "Deleting…" : "Delete"}
        </Button>
      </div>
    </div>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────

function StaffDetailModal({ member }: { member: AdminStaffMember }) {
  const rc = roleColor(member.role);
  const [consents, setConsents] = useState<ConsentRecord[] | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    setConsents(null);
    if (!member.profile_id) return;
    consentService.listForSubject({ staff_id: member.profile_id }).then(setConsents).catch(() => setConsents([]));
  }, [member.profile_id]);

  useEffect(() => {
    setDetail(null);
    setDetailError(null);
    adminService.getStaffDetail(member.id, member.role).then(setDetail).catch(() => setDetailError("Couldn't load full record"));
  }, [member.id, member.role]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-semibold flex-shrink-0">
          {[member.first_name?.[0], member.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "?"}
        </div>
        <div>
          <p className="font-semibold text-neutral-900">{member.first_name} {member.last_name}</p>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${rc.bg} ${rc.text}`}>{roleLabel(member.role)}</span>
        </div>
      </div>

      {detail === null ? (
        detailError ? <p className="text-xs text-red-500">{detailError}</p> : <p className="text-xs text-neutral-400">Loading full record…</p>
      ) : (
        <DetailFieldList data={detail} exclude={["doctor_id", "ca_id", "receptionist_id", "profile_id"]} />
      )}

      <div>
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />Consent Records
        </p>
        {!member.profile_id ? (
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

    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────

export default function AdminStaffPage() {
  const { staff, isLoading, error, fetch, registerStaff, updateStaff, toggleStaff, deleteStaff } = useAdminStaff();
  const { clinics, fetch: fetchClinics, assignClinicAdmin } = useAdminClinics();
  const searchParams = useSearchParams();
  const router = useRouter();
  const assignAdminClinicId = searchParams.get("assignAdminClinic");

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [clinicFilter, setClinicFilter] = useState("all");
  const [showRegister, setShowRegister] = useState(false);
  const [editMember, setEditMember] = useState<AdminStaffMember | null>(null);
  const [deleteMember, setDeleteMember] = useState<AdminStaffMember | null>(null);
  const [detailMember, setDetailMember] = useState<AdminStaffMember | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetch(); fetchClinics(); }, [fetch, fetchClinics]);

  // Arrived here via "Assign Admin" on the Clinics page — open the register
  // modal pre-locked to clinical_admin + that clinic.
  useEffect(() => {
    if (assignAdminClinicId) setShowRegister(true);
  }, [assignAdminClinicId]);

  function closeRegister() {
    setShowRegister(false);
    if (assignAdminClinicId) router.replace("/admin/staff");
  }

  async function handleRegisterSubmit(data: RegisterStaffPayload) {
    if (data.role === "clinical_admin") {
      return assignClinicAdmin(data.clinic_id, {
        email: data.email, first_name: data.first_name, last_name: data.last_name, phone: data.phone,
      });
    }
    return registerStaff(data);
  }

  async function handleRefresh() {
    setRefreshing(true);
    try { await Promise.all([fetch(), fetchClinics()]); } finally { setRefreshing(false); }
  }

  const clinicOptions = clinics.map((c) => ({ value: c.clinic_id, label: c.clinic_name }));
  const clinicById = new Map(clinics.map((c) => [c.clinic_id, c]));

  const filtered = staff.filter((s) => {
    const name = `${s.first_name} ${s.last_name}`.toLowerCase();
    const matchesSearch =
      name.includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase());
    const matchesRole = roleFilter === "all" || s.role === roleFilter;
    const matchesClinic = clinicFilter === "all" || s.clinic_id === clinicFilter;
    return matchesSearch && matchesRole && matchesClinic;
  });

  async function handleToggle(member: AdminStaffMember) {
    setTogglingId(member.id);
    setActionError(null);
    try {
      await toggleStaff(member.id, !member.is_active, member.role);
    } catch (e: any) {
      setActionError(e?.response?.data?.detail || "Failed to update staff status");
    } finally {
      setTogglingId(null);
    }
  }

  const initials = (m: AdminStaffMember) =>
    [m.first_name?.[0], m.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "?";

  if (isLoading) return <StaffSkeleton />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Staff</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{staff.length} staff member{staff.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh"
            className="p-2.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <Button onClick={() => setShowRegister(true)}>
            <Plus className="h-4 w-4 mr-1.5" />Register Staff
          </Button>
        </div>
      </div>

      {(error || actionError) && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error || actionError}</span>
          <button onClick={() => setActionError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search staff…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-white"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="h-3.5 w-3.5 text-neutral-400" />
            </button>
          )}
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="all">All Roles</option>
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select
          value={clinicFilter}
          onChange={(e) => setClinicFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="all">All Clinics</option>
          {clinicOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <Card>
        {filtered.length === 0 ? (
          <CardContent className="py-16 text-center">
            <UserCog className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-600">No staff members found</p>
            <p className="text-xs text-neutral-400 mt-1">
              {search ? "Try a different search term" : "Register your first staff member"}
            </p>
            {!search && (
              <Button className="mt-4" onClick={() => setShowRegister(true)}>
                <Plus className="h-4 w-4 mr-1.5" />Register Staff
              </Button>
            )}
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Staff Member</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Role</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Clinic</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Status</th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((member) => {
                  const rc = roleColor(member.role);
                  const memberClinic = member.clinic_id ? clinicById.get(member.clinic_id) : undefined;
                  return (
                    <tr key={member.id} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="px-6 py-3.5">
                        <button
                          onClick={() => setDetailMember(member)}
                          className="flex items-center gap-3 text-left hover:opacity-75 transition-opacity"
                        >
                          <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-semibold text-xs flex-shrink-0">
                            {initials(member)}
                          </div>
                          <div>
                            <p className="font-medium text-neutral-900 underline decoration-dotted decoration-neutral-300 underline-offset-2">
                              {member.first_name} {member.last_name}
                            </p>
                            <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                              <Mail className="h-3 w-3" />{member.email}
                            </p>
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${rc.bg} ${rc.text}`}>
                          {roleLabel(member.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                          <Building2 className="h-3.5 w-3.5 text-neutral-400 flex-shrink-0" />
                          <span className="truncate max-w-[110px]">{member.clinic_name ?? member.clinic_id ?? "—"}</span>
                          {memberClinic && (
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${CLINIC_STATUS_STYLES[memberClinic.status]}`}>
                              {CLINIC_STATUS_LABELS[memberClinic.status]}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          member.is_active ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
                        }`}>
                          {member.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditMember(member)}
                            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleToggle(member)}
                            disabled={togglingId === member.id}
                            className={`p-1.5 rounded-lg transition-colors ${
                              member.is_active
                                ? "text-amber-500 hover:text-amber-700 hover:bg-amber-50"
                                : "text-green-500 hover:text-green-700 hover:bg-green-50"
                            }`}
                            title={member.is_active ? "Deactivate" : "Reactivate"}
                          >
                            {member.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => setDeleteMember(member)}
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
      <Modal isOpen={showRegister} onClose={closeRegister} title={assignAdminClinicId ? "Assign Clinic Admin" : "Register Staff Member"}>
        <StaffForm
          clinicOptions={clinicOptions}
          onSubmit={handleRegisterSubmit}
          onClose={closeRegister}
          lockClinicId={assignAdminClinicId ?? undefined}
          lockRole={assignAdminClinicId ? "clinical_admin" : undefined}
        />
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={!!editMember} onClose={() => setEditMember(null)} title="Edit Staff Member">
        {editMember && (
          <StaffForm
            initial={editMember}
            isEdit
            clinicOptions={clinicOptions}
            onSubmit={(data) => updateStaff(editMember.id, data)}
            onClose={() => setEditMember(null)}
          />
        )}
      </Modal>

      {/* Detail modal */}
      <Modal isOpen={!!detailMember} onClose={() => setDetailMember(null)} title="Staff Details" className="max-w-3xl">
        {detailMember && <StaffDetailModal member={detailMember} />}
      </Modal>

      {/* Delete confirm modal */}
      <Modal isOpen={!!deleteMember} onClose={() => setDeleteMember(null)} title="Delete Staff Member">
        {deleteMember && (
          <ConfirmDeleteModal
            member={deleteMember}
            onConfirm={() => deleteStaff(deleteMember.id, deleteMember.role)}
            onClose={() => setDeleteMember(null)}
          />
        )}
      </Modal>
    </div>
  );
}
