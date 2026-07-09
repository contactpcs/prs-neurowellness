"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useAdminAccounts, useAdminRegions, useAdminClinics } from "@/lib/hooks";
import { Button, Input, Modal } from "@/components/ui";
import type { AdminClinic, RegionalAdminAssignPayload } from "@/types/admin.types";
import { AdminAccountsSection } from "../_shared";

function AssignRegionalAdminForm({ regionsWithClinic, onSubmit, onClose }: {
  regionsWithClinic: { region_id: string; region_name: string; main_branch_clinic: AdminClinic }[];
  onSubmit: (regionId: string, data: RegionalAdminAssignPayload) => Promise<unknown>;
  onClose: () => void;
}) {
  const [regionId, setRegionId] = useState(regionsWithClinic[0]?.region_id ?? "");
  const [form, setForm] = useState<Omit<RegionalAdminAssignPayload, "clinic_id">>({
    email: "", first_name: "", last_name: "", phone: "",
    gender: undefined, dob: "", address: "", city: "", state: "", country: "", pincode: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const selected = regionsWithClinic.find((r) => r.region_id === regionId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!regionId || !selected) { setError("Select a region"); return; }
    if (!form.email.trim() || !form.first_name.trim() || !form.last_name.trim()) {
      setError("Email, first name, and last name are required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSubmit(regionId, { ...form, clinic_id: selected.main_branch_clinic.clinic_id });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.detail || "Failed to assign regional admin");
    } finally {
      setLoading(false);
    }
  }

  if (regionsWithClinic.length === 0) {
    return (
      <p className="text-sm text-neutral-500">Every region either already has a regional admin, or has no clinic yet — create a region's first clinic before assigning its regional admin.</p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Region *</label>
        <select
          value={regionId}
          onChange={(e) => setRegionId(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white"
        >
          {regionsWithClinic.map((r) => (
            <option key={r.region_id} value={r.region_id}>{r.region_name}</option>
          ))}
        </select>
        {selected && (
          <p className="text-xs text-neutral-400 mt-1">
            Regional admin will be based at this region&apos;s main-branch clinic: <span className="font-medium text-neutral-600">{selected.main_branch_clinic.clinic_name}</span>
          </p>
        )}
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
            onChange={(e) => set("gender", (e.target.value || undefined) as RegionalAdminAssignPayload["gender"])}
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
        <Button type="submit" disabled={loading}>{loading ? "Assigning…" : "Assign Regional Admin"}</Button>
      </div>
    </form>
  );
}

export default function RegionalAdminsPage() {
  const { admins, isLoading, error, fetch, updateAdmin } = useAdminAccounts();
  const { regions, fetch: fetchRegions, assignRegionalAdmin } = useAdminRegions();
  const { clinics, fetch: fetchClinics } = useAdminClinics();
  const [showAssign, setShowAssign] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetch(); fetchRegions(); fetchClinics(); }, [fetch, fetchRegions, fetchClinics]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await Promise.all([fetch(), fetchRegions(), fetchClinics()]); } finally { setRefreshing(false); }
  }

  const regionalAdmins = admins.filter((a) => a.admin_type === "regional_admin");

  // Regional admin can only be assigned once a region has its main-branch
  // (first-created) clinic — resolve that clinic per region, dropping any
  // region that has no clinic yet.
  const regionsWithClinic = regions
    .filter((r) => !r.regional_admin_id)
    .map((r) => ({ region_id: r.region_id, region_name: r.region_name, main_branch_clinic: clinics.find((c) => c.region_id === r.region_id && c.is_main_branch) }))
    .filter((r): r is { region_id: string; region_name: string; main_branch_clinic: AdminClinic } => !!r.main_branch_clinic);

  return (
    <>
      <AdminAccountsSection
        title="Regional Admins"
        subtitle={`${regionalAdmins.length} regional admin${regionalAdmins.length !== 1 ? "s" : ""}`}
        admins={regionalAdmins}
        isLoading={isLoading}
        error={error}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        updateAdmin={updateAdmin}
        emptyLabel="No regional admins found"
        headerAction={
          <Button onClick={() => setShowAssign(true)}>
            <Plus className="h-4 w-4 mr-1.5" />Assign Regional Admin
          </Button>
        }
      />

      <Modal isOpen={showAssign} onClose={() => setShowAssign(false)} title="Assign Regional Admin">
        <AssignRegionalAdminForm
          regionsWithClinic={regionsWithClinic}
          onSubmit={assignRegionalAdmin}
          onClose={() => setShowAssign(false)}
        />
      </Modal>
    </>
  );
}
