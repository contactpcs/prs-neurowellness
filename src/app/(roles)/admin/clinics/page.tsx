"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2, Plus, Edit2, PowerOff, Power, X,
  MapPin, Phone, Mail, Users, Trash2, UserPlus, RefreshCw, Star,
} from "lucide-react";
import { useAdminClinics } from "@/lib/hooks";
import { Card, CardContent, Button, Input, Skeleton, Modal, DetailFieldList, PageShell } from "@/components/ui";
import { adminService } from "@/lib/api/services/admin.service";
import type { AdminClinic, AdminRegion, CreateClinicPayload } from "@/types/admin.types";

// ─── Skeleton ─────────────────────────────────────────────────────

function ClinicsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-36" />
      </div>
      <Skeleton className="h-10 w-80" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-neutral-200/80 p-5 space-y-3">
            <div className="flex items-start justify-between">
              <Skeleton className="h-10 w-10 rounded-xl" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-32" />
            <div className="flex gap-4 pt-1">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Clinic Form (create only — no clinic_admin picker, that's step 2) ─────

interface ClinicFormProps {
  onSubmit: (data: CreateClinicPayload) => Promise<unknown>;
  onClose: () => void;
}

function ClinicForm({ onSubmit, onClose }: ClinicFormProps) {
  const [regions, setRegions] = useState<AdminRegion[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(true);
  const [showNewRegion, setShowNewRegion] = useState(false);
  const [newRegion, setNewRegion] = useState({ region_name: "", country: "India", state: "" });
  const [form, setForm] = useState<CreateClinicPayload>({
    clinic_code: "", clinic_name: "", clinic_type: "anava_owned", region_id: "",
    address: "", city: "", state: "", phone: "", email: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminService.getRegions()
      .then((list) => {
        setRegions(list);
        if (list.length > 0) set("region_id", list[0].region_id);
        else setShowNewRegion(true);
      })
      .finally(() => setRegionsLoading(false));
  }, []);

  function set(field: keyof CreateClinicPayload, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreateRegion() {
    if (!newRegion.region_name.trim() || !newRegion.state.trim()) {
      setError("Region name and state are required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const region = await adminService.createRegion(newRegion);
      setRegions((prev) => [...prev, region]);
      set("region_id", region.region_id);
      setShowNewRegion(false);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.detail || "Failed to create region");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.clinic_name.trim()) { setError("Clinic name is required"); return; }
    if (!form.clinic_code.trim()) { setError("Clinic code is required"); return; }
    if (!form.region_id) { setError("Select or create a region first"); return; }
    setLoading(true);
    setError(null);
    try {
      await onSubmit(form);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.detail || "Failed to save clinic");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Region *</label>
        {regionsLoading ? (
          <Skeleton className="h-9 w-full" />
        ) : showNewRegion ? (
          <div className="space-y-2 bg-neutral-50 rounded-lg p-3 border border-neutral-200">
            <p className="text-xs text-neutral-500">No regions yet — create one first.</p>
            <Input placeholder="Region name" value={newRegion.region_name} onChange={(e) => setNewRegion((p) => ({ ...p, region_name: e.target.value }))} />
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="State" value={newRegion.state} onChange={(e) => setNewRegion((p) => ({ ...p, state: e.target.value }))} />
              <Input placeholder="Country" value={newRegion.country} onChange={(e) => setNewRegion((p) => ({ ...p, country: e.target.value }))} />
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={loading} onClick={handleCreateRegion}>Create Region</Button>
              {regions.length > 0 && (
                <Button type="button" size="sm" variant="outline" onClick={() => setShowNewRegion(false)}>Cancel</Button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <select
              value={form.region_id}
              onChange={(e) => set("region_id", e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white"
            >
              {regions.map((r) => (
                <option key={r.region_id} value={r.region_id}>{r.region_name} ({r.state})</option>
              ))}
            </select>
            <Button type="button" variant="outline" size="sm" onClick={() => setShowNewRegion(true)}>+ New</Button>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Clinic Code *</label>
          <Input value={form.clinic_code} onChange={(e) => set("clinic_code", e.target.value)} placeholder="e.g. MUM-01" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Clinic Type *</label>
          <select
            value={form.clinic_type}
            onChange={(e) => set("clinic_type", e.target.value)}
            className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white h-9"
          >
            <option value="anava_owned">Anava Owned</option>
            <option value="partner">Partner</option>
            <option value="mobile">Mobile</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Clinic Name *</label>
        <Input value={form.clinic_name} onChange={(e) => set("clinic_name", e.target.value)} placeholder="e.g. Anava Mumbai" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">City</label>
          <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} placeholder="City" />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">State</label>
          <Input value={form.state ?? ""} onChange={(e) => set("state", e.target.value)} placeholder="State" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Address</label>
        <Input value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} placeholder="Full address" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Phone</label>
          <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="+91 ..." />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Email</label>
          <Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="clinic@email.com" />
        </div>
      </div>

      <p className="text-xs text-neutral-400">After creating, you'll be prompted to assign a clinic admin — no other staff can be added until then.</p>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? "Creating…" : "Create Clinic"}</Button>
      </div>
    </form>
  );
}

// ─── Edit Form (name/address/contact only — code/type/region are fixed after creation) ─

function EditClinicForm({ clinic, onSubmit, onClose }: { clinic: AdminClinic; onSubmit: (data: Partial<CreateClinicPayload>) => Promise<unknown>; onClose: () => void }) {
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

// ─── Status badge ───────────────────────────────────────────────────

const STATUS_STYLES: Record<AdminClinic["status"], string> = {
  setup: "bg-amber-100 text-amber-700",
  active: "bg-green-100 text-green-700",
  pending_closure: "bg-orange-100 text-orange-700",
  closed: "bg-neutral-200 text-neutral-600",
};
const STATUS_LABELS: Record<AdminClinic["status"], string> = {
  setup: "Setup",
  active: "Active",
  pending_closure: "Closing",
  closed: "Closed",
};

// ─── Clinic Card ──────────────────────────────────────────────────

interface ClinicCardProps {
  clinic: AdminClinic;
  onView: (clinic: AdminClinic) => void;
  onEdit: (clinic: AdminClinic) => void;
  onToggle: (clinic: AdminClinic) => void;
  onAssignAdmin: (clinic: AdminClinic) => void;
  onDelete: (clinic: AdminClinic) => void;
  toggling: boolean;
}

function ClinicCard({ clinic, onView, onEdit, onToggle, onAssignAdmin, onDelete, toggling }: ClinicCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-5 w-5 text-indigo-600" />
          </div>
          <div className="flex items-center gap-1.5">
            {clinic.is_main_branch && (
              <span title="Main branch" className="flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600">
                <Star className="h-3 w-3" />
              </span>
            )}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[clinic.status]}`}>
              {STATUS_LABELS[clinic.status]}
            </span>
          </div>
        </div>

        <button onClick={() => onView(clinic)} className="text-left hover:opacity-75 transition-opacity">
          <h3 className="text-sm font-semibold text-neutral-900 leading-snug underline decoration-dotted decoration-neutral-300 underline-offset-2">{clinic.clinic_name}</h3>
        </button>
        <p className="text-xs text-neutral-400">{clinic.clinic_code}</p>

        {!clinic.clinic_admin_id && (
          <p className="text-xs text-amber-600 mt-1.5 bg-amber-50 rounded px-2 py-1">No clinic admin assigned yet — assign one from Staff before adding other staff.</p>
        )}

        <div className="mt-2 space-y-1">
          {(clinic.city || clinic.state) && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{[clinic.city, clinic.state].filter(Boolean).join(", ")}</span>
            </div>
          )}
          {clinic.phone && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <Phone className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{clinic.phone}</span>
            </div>
          )}
          {clinic.email && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-500">
              <Mail className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{clinic.email}</span>
            </div>
          )}
        </div>

        {(clinic.doctor_count !== undefined || clinic.patient_count !== undefined) && (
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-neutral-100">
            {clinic.doctor_count !== undefined && (
              <div className="flex items-center gap-1 text-xs text-neutral-500">
                <Users className="h-3.5 w-3.5" />
                <span>{clinic.doctor_count} doctors</span>
              </div>
            )}
            {clinic.patient_count !== undefined && (
              <div className="flex items-center gap-1 text-xs text-neutral-500">
                <Users className="h-3.5 w-3.5" />
                <span>{clinic.patient_count} patients</span>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-4">
          {!clinic.clinic_admin_id && (
            <button
              onClick={() => onAssignAdmin(clinic)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-indigo-200"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Assign Admin
            </button>
          )}
          <button
            onClick={() => onEdit(clinic)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors border border-neutral-200"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            onClick={() => onToggle(clinic)}
            disabled={toggling || clinic.status === "setup" || clinic.status === "closed"}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors border disabled:opacity-40 ${
              clinic.is_active
                ? "text-red-600 hover:bg-red-50 border-red-200"
                : "text-green-600 hover:bg-green-50 border-green-200"
            }`}
          >
            {clinic.is_active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
            {clinic.is_active ? "Deactivate" : "Activate"}
          </button>
          <button
            onClick={() => onDelete(clinic)}
            title="Delete clinic (only if it has no staff/patients)"
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────

function ClinicDetailModal({ clinic, regionName }: { clinic: AdminClinic; regionName?: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
          <Building2 className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <p className="font-semibold text-neutral-900">{clinic.clinic_name}</p>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[clinic.status]}`}>{STATUS_LABELS[clinic.status]}</span>
        </div>
      </div>
      <DetailFieldList data={{ ...clinic, region_name: regionName ?? clinic.region_id }} exclude={["is_active"]} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────

export default function AdminClinicsPage() {
  const { clinics, isLoading, error, fetch, createClinic, updateClinic, toggleClinic, deleteClinic } = useAdminClinics();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editClinic, setEditClinic] = useState<AdminClinic | null>(null);
  const [viewClinic, setViewClinic] = useState<AdminClinic | null>(null);
  const [regions, setRegions] = useState<AdminRegion[]>([]);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  function goAssignAdmin(clinic: AdminClinic) {
    router.push(`/admin/admins/clinical?assignAdminClinic=${clinic.clinic_id}`);
  }

  useEffect(() => { fetch(); adminService.getRegions().then(setRegions).catch(() => {}); }, [fetch]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await fetch(); } finally { setRefreshing(false); }
  }

  const regionNameById = new Map(regions.map((r) => [r.region_id, r.region_name]));

  const filtered = clinics.filter((c) => {
    const matchesSearch =
      c.clinic_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.city ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ||
      (filter === "active" && c.is_active) ||
      (filter === "inactive" && !c.is_active);
    return matchesSearch && matchesFilter;
  });

  async function handleToggle(clinic: AdminClinic) {
    setTogglingId(clinic.clinic_id);
    setActionError(null);
    try {
      await toggleClinic(clinic.clinic_id, !clinic.is_active);
    } catch (e: any) {
      setActionError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Failed to update clinic status");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(clinic: AdminClinic) {
    if (!confirm(`Delete "${clinic.clinic_name}"? This only works if it has no staff or patients.`)) return;
    setActionError(null);
    try {
      await deleteClinic(clinic.clinic_id);
    } catch (e: any) {
      setActionError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Failed to delete clinic — it likely still has staff/patients. Close it instead.");
    }
  }

  if (isLoading) return <ClinicsSkeleton />;

  return (
    <PageShell
      title="Clinics"
      root="Admin"
      search={search}
      onSearch={setSearch}
      actions={
        <>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh"
            className="p-2.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1.5" />New Clinic
          </Button>
        </>
      }
      filters={
        <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1">
          {(["all", "active", "inactive"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                filter === f ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      }
    >
      <p className="text-sm text-neutral-500 -mt-3">{clinics.length} clinic{clinics.length !== 1 ? "s" : ""} registered</p>

      {(error || actionError) && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error || actionError}</span>
          <button onClick={() => setActionError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Building2 className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-600">No clinics found</p>
            <p className="text-xs text-neutral-400 mt-1">
              {search ? "Try a different search term" : "Add your first clinic to get started"}
            </p>
            {!search && (
              <Button className="mt-4" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-1.5" />Add Clinic
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((clinic) => (
            <ClinicCard
              key={clinic.clinic_id}
              clinic={clinic}
              onView={setViewClinic}
              onEdit={setEditClinic}
              onToggle={handleToggle}
              onAssignAdmin={goAssignAdmin}
              onDelete={handleDelete}
              toggling={togglingId === clinic.clinic_id}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create New Clinic">
        <ClinicForm onSubmit={createClinic} onClose={() => setShowCreate(false)} />
      </Modal>

      {/* Edit modal */}
      <Modal isOpen={!!editClinic} onClose={() => setEditClinic(null)} title="Edit Clinic">
        {editClinic && (
          <EditClinicForm
            clinic={editClinic}
            onSubmit={(data) => updateClinic(editClinic.clinic_id, data)}
            onClose={() => setEditClinic(null)}
          />
        )}
      </Modal>

      {/* Detail modal */}
      <Modal isOpen={!!viewClinic} onClose={() => setViewClinic(null)} title="Clinic Details" className="max-w-3xl">
        {viewClinic && <ClinicDetailModal clinic={viewClinic} regionName={regionNameById.get(viewClinic.region_id)} />}
      </Modal>
    </PageShell>
  );
}
