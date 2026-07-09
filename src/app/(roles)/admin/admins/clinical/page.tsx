"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { useAdminAccounts, useAdminClinics } from "@/lib/hooks";
import { Button, Input, Modal } from "@/components/ui";
import type { ClinicAdminAssignPayload } from "@/types/admin.types";
import { AdminAccountsSection } from "../_shared";

function AssignClinicAdminForm({ clinicOptions, lockClinicId, onSubmit, onClose }: {
  clinicOptions: { value: string; label: string }[];
  lockClinicId?: string;
  onSubmit: (clinicId: string, data: ClinicAdminAssignPayload) => Promise<unknown>;
  onClose: () => void;
}) {
  const [clinicId, setClinicId] = useState(lockClinicId ?? clinicOptions[0]?.value ?? "");
  const [form, setForm] = useState<ClinicAdminAssignPayload>({
    email: "", first_name: "", last_name: "", phone: "",
    gender: undefined, dob: "", address: "", city: "", state: "", country: "", pincode: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ClinicAdminAssignPayload>(field: K, value: ClinicAdminAssignPayload[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clinicId) { setError("Select a clinic"); return; }
    if (!form.email.trim() || !form.first_name.trim() || !form.last_name.trim()) {
      setError("Email, first name, and last name are required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSubmit(clinicId, form);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.detail || "Failed to assign clinic admin");
    } finally {
      setLoading(false);
    }
  }

  if (!lockClinicId && clinicOptions.length === 0) {
    return (
      <p className="text-sm text-neutral-500">Every clinic already has a clinic admin.</p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Clinic *</label>
        <select
          value={clinicId}
          onChange={(e) => setClinicId(e.target.value)}
          disabled={!!lockClinicId}
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white disabled:bg-neutral-100 disabled:text-neutral-500"
        >
          {clinicOptions.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Phone</label>
          <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Gender</label>
          <select
            value={form.gender ?? ""}
            onChange={(e) => set("gender", (e.target.value || undefined) as ClinicAdminAssignPayload["gender"])}
            className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white h-9"
          >
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Date of Birth</label>
          <Input type="date" value={form.dob ?? ""} onChange={(e) => set("dob", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">City</label>
          <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">State</label>
          <Input value={form.state ?? ""} onChange={(e) => set("state", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Address</label>
          <Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Country</label>
          <Input value={form.country ?? ""} onChange={(e) => set("country", e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Pincode</label>
          <Input value={form.pincode ?? ""} onChange={(e) => set("pincode", e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-neutral-400">They'll need to sign their onboarding consent on first login before they can act.</p>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? "Assigning…" : "Assign Clinic Admin"}</Button>
      </div>
    </form>
  );
}

export default function ClinicAdminsPage() {
  const { admins, isLoading, error, fetch, updateAdmin } = useAdminAccounts();
  const { clinics, fetch: fetchClinics, assignClinicAdmin } = useAdminClinics();
  const searchParams = useSearchParams();
  const router = useRouter();
  // Arrived here via "Assign Admin" on the Clinics page — that flow used to
  // land on /admin/staff; it now lands here directly, locked to that clinic.
  const assignAdminClinicId = searchParams.get("assignAdminClinic");

  const [showAssign, setShowAssign] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetch(); fetchClinics(); }, [fetch, fetchClinics]);
  useEffect(() => { if (assignAdminClinicId) setShowAssign(true); }, [assignAdminClinicId]);

  function closeAssign() {
    setShowAssign(false);
    if (assignAdminClinicId) router.replace("/admin/admins/clinical");
  }

  async function handleRefresh() {
    setRefreshing(true);
    try { await Promise.all([fetch(), fetchClinics()]); } finally { setRefreshing(false); }
  }

  const clinicAdmins = admins.filter((a) => a.admin_type === "clinic_admin");
  const unassignedClinics = clinics.filter((c) => !c.clinic_admin_id).map((c) => ({ value: c.clinic_id, label: c.clinic_name }));

  return (
    <>
      <AdminAccountsSection
        title="Clinic Admins"
        subtitle={`${clinicAdmins.length} clinic admin${clinicAdmins.length !== 1 ? "s" : ""}`}
        admins={clinicAdmins}
        isLoading={isLoading}
        error={error}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        updateAdmin={updateAdmin}
        emptyLabel="No clinic admins found"
        headerAction={
          unassignedClinics.length > 0 ? (
            <Button onClick={() => setShowAssign(true)}>
              <Plus className="h-4 w-4 mr-1.5" />Assign Clinic Admin
            </Button>
          ) : undefined
        }
      />

      <Modal isOpen={showAssign} onClose={closeAssign} title="Assign Clinic Admin">
        <AssignClinicAdminForm
          clinicOptions={unassignedClinics}
          lockClinicId={assignAdminClinicId ?? undefined}
          onSubmit={assignClinicAdmin}
          onClose={closeAssign}
        />
      </Modal>
    </>
  );
}
