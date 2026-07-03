"use client";

import { useEffect, useState } from "react";
import { Building2, Edit2, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/hooks";
import { Card, CardContent, Button, Input, Skeleton, Modal, DetailFieldList } from "@/components/ui";
import { adminService } from "@/lib/api/services/admin.service";
import type { AdminClinic, CreateClinicPayload } from "@/types/admin.types";

const STATUS_STYLES: Record<AdminClinic["status"], string> = {
  setup: "bg-amber-100 text-amber-700",
  active: "bg-green-100 text-green-700",
  pending_closure: "bg-orange-100 text-orange-700",
  closed: "bg-neutral-200 text-neutral-600",
};
const STATUS_LABELS: Record<AdminClinic["status"], string> = {
  setup: "Setup", active: "Active", pending_closure: "Closing", closed: "Closed",
};

function MyClinicSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <div className="bg-white rounded-xl border border-neutral-200/80 p-6 space-y-3">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}

function EditClinicForm({ clinic, onSubmit, onClose }: {
  clinic: AdminClinic;
  onSubmit: (data: Partial<CreateClinicPayload>) => Promise<unknown>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    clinic_name: clinic.clinic_name, address: clinic.address ?? "", city: clinic.city ?? "",
    state: clinic.state ?? "", phone: clinic.phone ?? "", email: clinic.email ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit(form);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.detail || "Failed to update clinic");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Clinic Name *</label>
        <Input value={form.clinic_name} onChange={(e) => setForm((p) => ({ ...p, clinic_name: e.target.value }))} required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">City</label>
          <Input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">State</label>
          <Input value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Address</label>
        <Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Phone</label>
          <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Email</label>
          <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
        </div>
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Save Changes"}</Button>
      </div>
    </form>
  );
}

export default function ClinicAdminMyClinicPage() {
  const { user } = useAuth();
  const [clinic, setClinic] = useState<AdminClinic | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!user?.clinic_id) return;
    setError(null);
    try {
      setClinic(await adminService.getClinic(user.clinic_id));
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Failed to load clinic");
    }
  }

  useEffect(() => { setIsLoading(true); load().finally(() => setIsLoading(false)); }, [user?.clinic_id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  async function handleUpdate(data: Partial<CreateClinicPayload>) {
    if (!user?.clinic_id) return;
    const updated = await adminService.updateClinic(user.clinic_id, data);
    setClinic(updated);
    return updated;
  }

  if (isLoading) return <MyClinicSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-neutral-900">My Clinic</h1>
        <div className="flex items-center gap-2">
          <button onClick={handleRefresh} disabled={refreshing} title="Refresh"
            className="p-2.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          {clinic && (
            <Button onClick={() => setShowEdit(true)}><Edit2 className="h-4 w-4 mr-1.5" />Edit Clinic</Button>
          )}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}

      {clinic && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <Building2 className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-neutral-900">{clinic.clinic_name}</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[clinic.status]}`}>{STATUS_LABELS[clinic.status]}</span>
              </div>
            </div>
            <DetailFieldList data={clinic} exclude={["is_active"]} />
          </CardContent>
        </Card>
      )}

      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit Clinic">
        {clinic && <EditClinicForm clinic={clinic} onSubmit={handleUpdate} onClose={() => setShowEdit(false)} />}
      </Modal>
    </div>
  );
}
