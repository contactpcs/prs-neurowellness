"use client";

import { useEffect, useState } from "react";
import { MapPin, Plus, Trash2, X, RefreshCw, Building2, PowerOff, Power } from "lucide-react";
import { useAdminRegions } from "@/lib/hooks";
import { Card, CardContent, Button, Input, Skeleton, Modal, DetailFieldList } from "@/components/ui";
import type { AdminRegion } from "@/types/admin.types";

function RegionsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-36" />
      </div>
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

function RegionForm({ onSubmit, onClose }: { onSubmit: (data: { region_name: string; country: string; state: string }) => Promise<unknown> ; onClose: () => void }) {
  const [form, setForm] = useState({ region_name: "", country: "India", state: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.region_name.trim() || !form.state.trim()) { setError("Region name and state are required"); return; }
    setLoading(true);
    setError(null);
    try {
      await onSubmit(form);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.detail || "Failed to create region");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Region Name *</label>
        <Input value={form.region_name} onChange={(e) => setForm((p) => ({ ...p, region_name: e.target.value }))} placeholder="e.g. West India" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">State *</label>
          <Input value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} placeholder="Maharashtra" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Country *</label>
          <Input value={form.country} onChange={(e) => setForm((p) => ({ ...p, country: e.target.value }))} placeholder="India" required />
        </div>
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create Region"}</Button>
      </div>
    </form>
  );
}

function RegionDetailModal({ region }: { region: AdminRegion }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <MapPin className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <p className="font-semibold text-neutral-900">{region.region_name}</p>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${region.is_active ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"}`}>
            {region.is_active ? "Active" : "Inactive"}
          </span>
        </div>
      </div>
      <DetailFieldList data={region} />
    </div>
  );
}

function RegionCard({ region, onView, onToggle, onDelete, toggling }: { region: AdminRegion; onView: (r: AdminRegion) => void; onToggle: (r: AdminRegion) => void; onDelete: (r: AdminRegion) => void; toggling: boolean }) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <MapPin className="h-5 w-5 text-indigo-600" />
          </div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${region.is_active ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"}`}>
            {region.is_active ? "Active" : "Inactive"}
          </span>
        </div>
        <button onClick={() => onView(region)} className="text-left hover:opacity-75 transition-opacity">
          <h3 className="text-sm font-semibold text-neutral-900 leading-snug underline decoration-dotted decoration-neutral-300 underline-offset-2">{region.region_name}</h3>
        </button>
        <p className="text-xs text-neutral-500 mt-1">{region.state}, {region.country}</p>
        {!region.regional_admin_id && (
          <p className="text-xs text-amber-600 mt-1.5 bg-amber-50 rounded px-2 py-1">No regional admin yet — assign one from the Admins page before any clinic here can add staff or patients.</p>
        )}
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={() => onToggle(region)}
            disabled={toggling}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors border disabled:opacity-40 ${
              region.is_active ? "text-red-600 hover:bg-red-50 border-red-200" : "text-green-600 hover:bg-green-50 border-green-200"
            }`}
          >
            {region.is_active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
            {region.is_active ? "Deactivate" : "Activate"}
          </button>
          <button
            onClick={() => onDelete(region)}
            title="Delete region (only if it has no clinics)"
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminRegionsPage() {
  const { regions, isLoading, error, fetch, createRegion, updateRegion, deleteRegion } = useAdminRegions();
  const [showCreate, setShowCreate] = useState(false);
  const [viewRegion, setViewRegion] = useState<AdminRegion | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { fetch(); }, [fetch]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await fetch(); } finally { setRefreshing(false); }
  }

  async function handleToggle(region: AdminRegion) {
    setTogglingId(region.region_id);
    setActionError(null);
    try {
      await updateRegion(region.region_id, { is_active: !region.is_active });
    } catch (e: any) {
      setActionError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Failed to update region");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(region: AdminRegion) {
    if (!confirm(`Delete "${region.region_name}"? This only works if it has no clinics.`)) return;
    setActionError(null);
    try {
      await deleteRegion(region.region_id);
    } catch (e: any) {
      setActionError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Failed to delete region — it likely still has clinics.");
    }
  }

  if (isLoading) return <RegionsSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Regions</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{regions.length} region{regions.length !== 1 ? "s" : ""}</p>
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
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1.5" />New Region
          </Button>
        </div>
      </div>

      {(error || actionError) && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error || actionError}</span>
          <button onClick={() => setActionError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {regions.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-600">No regions yet</p>
            <p className="text-xs text-neutral-400 mt-1">Create one before you can add clinics.</p>
            <Button className="mt-4" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1.5" />Add Region
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {regions.map((region) => (
            <RegionCard
              key={region.region_id}
              region={region}
              onView={setViewRegion}
              onToggle={handleToggle}
              onDelete={handleDelete}
              toggling={togglingId === region.region_id}
            />
          ))}
        </div>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Region">
        <RegionForm onSubmit={createRegion} onClose={() => setShowCreate(false)} />
      </Modal>

      <Modal isOpen={!!viewRegion} onClose={() => setViewRegion(null)} title="Region Details" className="max-w-3xl">
        {viewRegion && <RegionDetailModal region={viewRegion} />}
      </Modal>
    </div>
  );
}
