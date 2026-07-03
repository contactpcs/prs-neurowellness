"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Plus, RefreshCw, X, Mail, Phone, MapPin, Building2 } from "lucide-react";
import { useAdminAccounts, useAdminRegions } from "@/lib/hooks";
import { Card, CardContent, Button, Input, Skeleton, Modal, DetailFieldList } from "@/components/ui";
import type { AdminAccount, RegionalAdminAssignPayload } from "@/types/admin.types";

function AdminsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="bg-white rounded-xl border border-neutral-200/80 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-neutral-100 last:border-0">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

const TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  super_admin: { bg: "bg-rose-100", text: "text-rose-700", label: "Super Admin" },
  regional_admin: { bg: "bg-blue-100", text: "text-blue-700", label: "Regional Admin" },
  clinic_admin: { bg: "bg-purple-100", text: "text-purple-700", label: "Clinic Admin" },
};

function AssignRegionalAdminForm({ regionsWithoutAdmin, onSubmit, onClose }: {
  regionsWithoutAdmin: { region_id: string; region_name: string }[];
  onSubmit: (regionId: string, data: RegionalAdminAssignPayload) => Promise<unknown>;
  onClose: () => void;
}) {
  const [regionId, setRegionId] = useState(regionsWithoutAdmin[0]?.region_id ?? "");
  const [form, setForm] = useState<RegionalAdminAssignPayload>({ email: "", first_name: "", last_name: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!regionId) { setError("Select a region"); return; }
    if (!form.email.trim() || !form.first_name.trim() || !form.last_name.trim()) {
      setError("Email, first name, and last name are required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSubmit(regionId, form);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.detail || "Failed to assign regional admin");
    } finally {
      setLoading(false);
    }
  }

  if (regionsWithoutAdmin.length === 0) {
    return (
      <p className="text-sm text-neutral-500">Every region already has a regional admin assigned.</p>
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
          {regionsWithoutAdmin.map((r) => (
            <option key={r.region_id} value={r.region_id}>{r.region_name}</option>
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
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Phone</label>
        <Input value={form.phone ?? ""} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
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

export default function AdminAdminsPage() {
  const { admins, isLoading, error, fetch } = useAdminAccounts();
  const { regions, fetch: fetchRegions, assignRegionalAdmin } = useAdminRegions();
  const [tab, setTab] = useState<"all" | "regional_admin" | "clinic_admin">("all");
  const [showAssign, setShowAssign] = useState(false);
  const [viewAdmin, setViewAdmin] = useState<AdminAccount | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => { fetch(); fetchRegions(); }, [fetch, fetchRegions]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await Promise.all([fetch(), fetchRegions()]); } finally { setRefreshing(false); }
  }

  // Super admin accounts aren't region/clinic-scoped — this page is for
  // managing the two scoped admin types only.
  const scoped = admins.filter((a) => a.admin_type !== "super_admin");
  const filtered = tab === "all" ? scoped : scoped.filter((a) => a.admin_type === tab);
  const regionalCount = scoped.filter((a) => a.admin_type === "regional_admin").length;
  const clinicCount = scoped.filter((a) => a.admin_type === "clinic_admin").length;

  const regionsWithoutAdmin = regions.filter((r) => !r.regional_admin_id).map((r) => ({ region_id: r.region_id, region_name: r.region_name }));

  const initials = (a: AdminAccount) => [a.first_name?.[0], a.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "?";

  if (isLoading) return <AdminsSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Admins</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{regionalCount} regional, {clinicCount} clinic admin{clinicCount !== 1 ? "s" : ""}</p>
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
          <Button onClick={() => setShowAssign(true)}>
            <Plus className="h-4 w-4 mr-1.5" />Assign Regional Admin
          </Button>
        </div>
      </div>

      <p className="text-xs text-neutral-400">
        Clinic admins are assigned from a clinic's card on the Clinics page (redirects to Staff to complete it) — this page manages regional admins directly and lists both.
      </p>

      {(error || actionError) && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error || actionError}</span>
          <button onClick={() => setActionError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1 w-fit">
        {([
          { key: "all", label: "All", count: scoped.length },
          { key: "regional_admin", label: "Regional", count: regionalCount },
          { key: "clinic_admin", label: "Clinic", count: clinicCount },
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

      <Card>
        {filtered.length === 0 ? (
          <CardContent className="py-16 text-center">
            <ShieldCheck className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-600">No admins found</p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Admin</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Scope</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map((admin) => {
                  const ts = TYPE_STYLES[admin.admin_type];
                  return (
                    <tr key={admin.admin_id} className="hover:bg-neutral-50/60 transition-colors">
                      <td className="px-6 py-3.5">
                        <button onClick={() => setViewAdmin(admin)} className="flex items-center gap-3 text-left hover:opacity-75 transition-opacity">
                          <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-xs flex-shrink-0">
                            {initials(admin)}
                          </div>
                          <div>
                            <p className="font-medium text-neutral-900 underline decoration-dotted decoration-neutral-300 underline-offset-2">{admin.first_name} {admin.last_name}</p>
                            <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                              <Mail className="h-3 w-3" />{admin.email}
                            </p>
                            {admin.phone && (
                              <p className="text-xs text-neutral-400 flex items-center gap-1">
                                <Phone className="h-3 w-3" />{admin.phone}
                              </p>
                            )}
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ts.bg} ${ts.text}`}>{ts.label}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                          {admin.region_name && (
                            <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-neutral-400" />{admin.region_name}</span>
                          )}
                          {admin.clinic_name && (
                            <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5 text-neutral-400" />{admin.clinic_name}</span>
                          )}
                          {!admin.region_name && !admin.clinic_name && "—"}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          admin.is_active ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
                        }`}>
                          {admin.is_active ? "Active" : "Pending Consent"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={showAssign} onClose={() => setShowAssign(false)} title="Assign Regional Admin">
        <AssignRegionalAdminForm
          regionsWithoutAdmin={regionsWithoutAdmin}
          onSubmit={assignRegionalAdmin}
          onClose={() => setShowAssign(false)}
        />
      </Modal>

      <Modal isOpen={!!viewAdmin} onClose={() => setViewAdmin(null)} title="Admin Details" className="max-w-3xl">
        {viewAdmin && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold flex-shrink-0">
                {initials(viewAdmin)}
              </div>
              <div>
                <p className="font-semibold text-neutral-900">{viewAdmin.first_name} {viewAdmin.last_name}</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_STYLES[viewAdmin.admin_type].bg} ${TYPE_STYLES[viewAdmin.admin_type].text}`}>
                  {TYPE_STYLES[viewAdmin.admin_type].label}
                </span>
              </div>
            </div>
            <DetailFieldList data={viewAdmin} />
          </div>
        )}
      </Modal>
    </div>
  );
}
