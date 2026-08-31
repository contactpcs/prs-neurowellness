"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, RefreshCw, X, MapPin, Phone, Mail, ClipboardList, UserPlus } from "lucide-react";
import { useAuth, useClinicRequests } from "@/lib/hooks";
import { Card, CardContent, Button, Input, Skeleton, Modal, DetailFieldList } from "@/components/ui";
import { adminService } from "@/lib/api/services/admin.service";
import type { CreateClinicRequestPayload, ClinicRequest } from "@/lib/api/services/clinicRequests.service";
import type { AdminClinic, ClinicAdminAssignPayload } from "@/types/admin.types";

const STATUS_STYLES: Record<AdminClinic["status"], string> = {
  setup: "bg-amber-100 text-amber-700",
  active: "bg-green-100 text-green-700",
  pending_closure: "bg-orange-100 text-orange-700",
  closed: "bg-neutral-200 text-neutral-600",
};
const STATUS_LABELS: Record<AdminClinic["status"], string> = {
  setup: "Setup", active: "Active", pending_closure: "Closing", closed: "Closed",
};

const REQUEST_STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
  withdrawn: "bg-neutral-200 text-neutral-600",
};

function ClinicsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-neutral-200/80 p-5 space-y-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}

function NewClinicRequestForm({ regionId, clinicOptions, onSubmit, onClose }: {
  regionId: string;
  clinicOptions: { value: string; label: string }[];
  onSubmit: (data: CreateClinicRequestPayload) => Promise<unknown>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<{ request_type: CreateClinicRequestPayload["request_type"]; clinic_type: string; clinic_id: string }>({
    request_type: "create_clinic", clinic_type: "anava_owned", clinic_id: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsClinic = form.request_type !== "create_clinic";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (needsClinic && !form.clinic_id) { setError("Select a clinic"); return; }
    setLoading(true);
    setError(null);
    try {
      await onSubmit({
        request_type: form.request_type, region_id: regionId,
        clinic_type: form.request_type === "create_clinic" ? form.clinic_type : undefined,
        clinic_id: needsClinic ? form.clinic_id : undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.detail || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Request Type *</label>
        <select
          value={form.request_type}
          onChange={(e) => setForm((p) => ({ ...p, request_type: e.target.value as typeof form.request_type }))}
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white"
        >
          <option value="create_clinic">Create New Clinic</option>
          <option value="close_clinic">Close a Clinic</option>
          <option value="change_admin">Change Clinic Admin</option>
          <option value="change_main_branch">Change Main Branch</option>
        </select>
      </div>
      {form.request_type === "create_clinic" ? (
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Clinic Type</label>
          <select value={form.clinic_type} onChange={(e) => setForm((p) => ({ ...p, clinic_type: e.target.value }))} className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white">
            <option value="anava_owned">Anava Owned</option>
            <option value="partner">Partner</option>
          </select>
        </div>
      ) : (
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Clinic *</label>
          <select value={form.clinic_id} onChange={(e) => setForm((p) => ({ ...p, clinic_id: e.target.value }))} className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white">
            <option value="">Select clinic…</option>
            {clinicOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
      )}
      <p className="text-xs text-neutral-400">A super admin reviews and approves clinic requests — this only submits it.</p>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? "Submitting…" : "Submit Request"}</Button>
      </div>
    </form>
  );
}

function AssignAdminForm({ clinic, onSubmit, onClose }: {
  clinic: AdminClinic;
  onSubmit: (clinicId: string, data: ClinicAdminAssignPayload) => Promise<unknown>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<ClinicAdminAssignPayload>({ email: "", first_name: "", last_name: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.email.trim() || !form.first_name.trim() || !form.last_name.trim()) { setError("Email, first name, and last name are required"); return; }
    setLoading(true);
    setError(null);
    try {
      await onSubmit(clinic.clinic_id, form);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.detail || "Failed to assign clinic admin");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Email *</label>
        <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">First Name *</label>
          <Input value={form.first_name} onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Last Name *</label>
          <Input value={form.last_name} onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))} required />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Phone</label>
        <Input value={form.phone ?? ""} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? "Assigning…" : "Assign Clinic Admin"}</Button>
      </div>
    </form>
  );
}

function ClinicCard({ clinic, onAssignAdmin, onView }: { clinic: AdminClinic; onAssignAdmin: (clinic: AdminClinic) => void; onView: (clinic: AdminClinic) => void }) {
  return (
    <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => onView(clinic)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-5 w-5 text-indigo-600" />
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[clinic.status]}`}>{STATUS_LABELS[clinic.status]}</span>
        </div>
        <h3 className="text-sm font-semibold text-neutral-900 leading-snug">{clinic.clinic_name}</h3>
        <p className="text-xs text-neutral-400">{clinic.clinic_code}</p>
        {!clinic.clinic_admin_id && (
          <p className="text-xs text-amber-600 mt-1.5 bg-amber-50 rounded px-2 py-1">No clinic admin assigned yet.</p>
        )}
        <div className="mt-2 space-y-1">
          {(clinic.city || clinic.state) && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{[clinic.city, clinic.state].filter(Boolean).join(", ")}</span>
            </div>
          )}
          {clinic.phone && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-500"><Phone className="h-3.5 w-3.5 flex-shrink-0" /><span>{clinic.phone}</span></div>
          )}
          {clinic.email && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-500"><Mail className="h-3.5 w-3.5 flex-shrink-0" /><span className="truncate">{clinic.email}</span></div>
          )}
        </div>
        {!clinic.clinic_admin_id && (
          <button
            onClick={(e) => { e.stopPropagation(); onAssignAdmin(clinic); }}
            className="mt-4 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-200"
          >
            <UserPlus className="h-3.5 w-3.5" />Assign Admin
          </button>
        )}
      </CardContent>
    </Card>
  );
}

export default function RegionalAdminClinicsPage() {
  const { user } = useAuth();
  const { requests, fetch: fetchRequests, createRequest } = useClinicRequests();
  const [clinics, setClinics] = useState<AdminClinic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRequest, setShowRequest] = useState(false);
  const [assignAdminTarget, setAssignAdminTarget] = useState<AdminClinic | null>(null);
  const [viewClinic, setViewClinic] = useState<AdminClinic | null>(null);
  const [viewRequest, setViewRequest] = useState<ClinicRequest | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!user?.region_id) return;
    setError(null);
    try {
      setClinics(await adminService.getClinics({ region_id: user.region_id }));
      await fetchRequests({ region_id: user.region_id });
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Failed to load clinics");
    }
  }

  useEffect(() => { setIsLoading(true); load().finally(() => setIsLoading(false)); }, [user?.region_id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  async function handleAssignAdmin(clinicId: string, data: ClinicAdminAssignPayload) {
    const updated = await adminService.assignClinicAdmin(clinicId, data);
    setClinics((prev) => prev.map((c) => (c.clinic_id === clinicId ? updated : c)));
    return updated;
  }

  const clinicOptions = clinics.map((c) => ({ value: c.clinic_id, label: c.clinic_name }));

  if (isLoading) return <ClinicsSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Clinics</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{clinics.length} clinic{clinics.length !== 1 ? "s" : ""} in your region</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} disabled={refreshing} title="Refresh"
            className="p-2.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <Button onClick={() => setShowRequest(true)}><Plus className="h-4 w-4 mr-1.5" />Request New Clinic</Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {clinics.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-600">No clinics in your region yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clinics.map((clinic) => <ClinicCard key={clinic.clinic_id} clinic={clinic} onAssignAdmin={setAssignAdminTarget} onView={setViewClinic} />)}
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-neutral-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <ClipboardList className="h-4 w-4" />My Requests
        </h2>
        <Card>
          {requests.length === 0 ? (
            <CardContent className="py-8 text-center text-sm text-neutral-500">No clinic requests submitted yet</CardContent>
          ) : (
            <div className="divide-y divide-neutral-100">
              {requests.map((r) => (
                <div key={r.request_id} className="flex items-center justify-between px-6 py-4 hover:bg-neutral-50/60 transition-colors cursor-pointer" onClick={() => setViewRequest(r)}>
                  <div>
                    <p className="text-sm font-medium text-neutral-900 capitalize underline decoration-dotted decoration-neutral-300 underline-offset-2">{r.request_type.replace(/_/g, " ")}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${REQUEST_STATUS_STYLES[r.status] ?? "bg-neutral-100 text-neutral-600"}`}>
                    {r.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Modal isOpen={showRequest} onClose={() => setShowRequest(false)} title="Request New Clinic">
        {user?.region_id && (
          <NewClinicRequestForm regionId={user.region_id} clinicOptions={clinicOptions} onSubmit={createRequest} onClose={() => setShowRequest(false)} />
        )}
      </Modal>

      <Modal isOpen={!!assignAdminTarget} onClose={() => setAssignAdminTarget(null)} title="Assign Clinic Admin">
        {assignAdminTarget && (
          <AssignAdminForm clinic={assignAdminTarget} onSubmit={handleAssignAdmin} onClose={() => setAssignAdminTarget(null)} />
        )}
      </Modal>

      <Modal isOpen={!!viewClinic} onClose={() => setViewClinic(null)} title="Clinic Details" className="max-w-3xl">
        {viewClinic && <DetailFieldList data={viewClinic} exclude={["is_active"]} />}
      </Modal>

      <Modal isOpen={!!viewRequest} onClose={() => setViewRequest(null)} title="Clinic Request Details" className="max-w-3xl">
        {viewRequest && <DetailFieldList data={viewRequest} />}
      </Modal>
    </div>
  );
}
