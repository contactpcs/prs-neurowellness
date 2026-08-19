"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Power, PowerOff, DollarSign } from "lucide-react";
import { Card, CardContent, Button, Input, Select, Modal, Badge, Skeleton } from "@/components/ui";
import { adminService } from "@/lib/api/services/admin.service";
import { treatmentProtocolService } from "@/lib/api/services/treatmentProtocol.service";
import type { AdminClinic, BillableItem, BillableItemCategory, BillableItemCreatePayload, BillableItemUpdatePayload } from "@/types/admin.types";
import type { DeviceRead } from "@/types/treatmentProtocol.types";

function extractErrorMessage(err: any, fallback: string): string {
  return err?.response?.data?.error?.message || err?.response?.data?.detail || fallback;
}

// Free text on the backend — reference.billable_items.appointment_type has
// no CHECK constraint, and scheduling/service.py now accepts anything with
// an active billable_items row (see AppointmentService.create's dynamic
// validation). These 4 are just the always-valid legacy set (scheduling/
// schemas.py APPOINTMENT_TYPES) offered as quick picks; typing a new value
// here is how a super admin introduces a brand-new appointment type — it
// becomes bookable the moment this form saves, no code change needed.
const LEGACY_APPOINTMENT_TYPES = ["initial", "follow_up", "device_session", "protocol_followup"];

function ItemsSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-white rounded-xl border border-neutral-200/80 p-4">
          <Skeleton className="h-4 w-48 mb-2" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

// ─── Create Form ──────────────────────────────────────────────────

function CreateItemForm({
  devices,
  clinics,
  knownAppointmentTypes,
  onSubmit,
  onClose,
}: {
  devices: DeviceRead[];
  clinics: AdminClinic[];
  knownAppointmentTypes: string[];
  onSubmit: (data: BillableItemCreatePayload) => Promise<unknown>;
  onClose: () => void;
}) {
  const [category, setCategory] = useState<BillableItemCategory>("appointment");
  const [form, setForm] = useState({
    item_code: "",
    name: "",
    description: "",
    price: "",
    currency: "INR",
    duration_minutes: "",
    appointment_type: LEGACY_APPOINTMENT_TYPES[0],
    device_id: "",
    clinic_id: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(field: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.item_code.trim()) {
      setError("Item code is required");
      return;
    }
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    const price = parseFloat(form.price);
    if (!Number.isFinite(price) || price < 0) {
      setError("Price must be 0 or more");
      return;
    }
    if (category === "device_session" && !form.device_id) {
      setError("Select a device");
      return;
    }
    if (category === "appointment" && !form.appointment_type.trim()) {
      setError("Appointment type is required");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onSubmit({
        item_code: form.item_code.trim(),
        category,
        appointment_type: category === "appointment" ? form.appointment_type.trim() : null,
        device_id: category === "device_session" ? form.device_id : null,
        clinic_id: form.clinic_id || null,
        name: form.name.trim(),
        description: form.description.trim() || null,
        price,
        currency: form.currency.trim() || "INR",
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes, 10) : null,
      });
      onClose();
    } catch (err: any) {
      setError(extractErrorMessage(err, "Failed to create billable item"));
    } finally {
      setLoading(false);
    }
  }

  const typeSuggestions = Array.from(new Set([...LEGACY_APPOINTMENT_TYPES, ...knownAppointmentTypes]));

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Category *</label>
        <div className="flex gap-1 bg-neutral-100 rounded-lg p-1">
          {(["appointment", "device_session"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                category === c ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {c === "appointment" ? "Appointment" : "Device Session"}
            </button>
          ))}
        </div>
      </div>

      {category === "appointment" ? (
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Appointment Type *</label>
          <Input
            value={form.appointment_type}
            onChange={(e) => set("appointment_type", e.target.value)}
            placeholder="e.g. initial, follow_up, or a new type"
            list="appointment-type-suggestions"
            required
          />
          <datalist id="appointment-type-suggestions">
            {typeSuggestions.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <p className="mt-1 text-xs text-neutral-400">
            Pick an existing type, or type a new one — it becomes bookable the moment this saves.
          </p>
        </div>
      ) : (
        <Select
          label="Device *"
          value={form.device_id}
          onChange={(e) => set("device_id", e.target.value)}
          options={devices.map((d) => ({
            value: d.device_id,
            label: `${d.device_name}${d.company_name ? ` — ${d.company_name}` : ""}`,
          }))}
          placeholder="Select a device"
          required
        />
      )}

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Clinic</label>
        <Select
          value={form.clinic_id}
          onChange={(e) => set("clinic_id", e.target.value)}
          options={clinics.map((c) => ({ value: c.clinic_id, label: c.clinic_name }))}
          placeholder="Platform default (all clinics)"
        />
        <p className="mt-1 text-xs text-neutral-400">
          Leave blank to set the default price everyone gets. Pick a clinic to override just that one — e.g. Clinic A stays ₹500,
          Clinic B charges ₹1000 for the same type.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Item Code *</label>
          <Input value={form.item_code} onChange={(e) => set("item_code", e.target.value)} placeholder="e.g. APPT-INITIAL" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Duration (min)</label>
          <Input type="number" min={0} value={form.duration_minutes} onChange={(e) => set("duration_minutes", e.target.value)} placeholder="Optional" />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Name *</label>
        <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Initial Assessment" required />
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Description</label>
        <Input value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Optional" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Price *</label>
          <Input type="number" min={0} step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="0.00" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Currency</label>
          <Input value={form.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} placeholder="INR" />
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Creating…" : "Create Item"}
        </Button>
      </div>
    </form>
  );
}

// ─── Edit Form (price/name/description/currency/duration/is_active only —
// category/appointment_type/device_id are fixed at creation) ──────────────

function EditItemForm({
  item,
  clinicName,
  onSubmit,
  onClose,
}: {
  item: BillableItem;
  clinicName: string;
  onSubmit: (data: BillableItemUpdatePayload) => Promise<unknown>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: item.name,
    description: item.description ?? "",
    price: String(item.price),
    currency: item.currency,
    duration_minutes: item.duration_minutes ? String(item.duration_minutes) : "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const price = parseFloat(form.price);
    if (!Number.isFinite(price) || price < 0) {
      setError("Price must be 0 or more");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onSubmit({
        name: form.name.trim(),
        description: form.description.trim() || null,
        price,
        currency: form.currency.trim() || "INR",
        duration_minutes: form.duration_minutes ? parseInt(form.duration_minutes, 10) : null,
      });
      onClose();
    } catch (err: any) {
      setError(extractErrorMessage(err, "Failed to update billable item"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-xs text-neutral-500 bg-neutral-50 rounded-lg px-3 py-2">
        {item.category === "appointment" ? `Appointment type: ${item.appointment_type}` : "Device-priced item"} · {clinicName} —
        fixed at creation. To reprice a different appointment type, device, or clinic, deactivate this item and create a new
        one.
      </p>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Name *</label>
        <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Description</label>
        <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Price *</label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.price}
            onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Currency</label>
          <Input value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value.toUpperCase() }))} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Duration (min)</label>
        <Input
          type="number"
          min={0}
          value={form.duration_minutes}
          onChange={(e) => setForm((p) => ({ ...p, duration_minutes: e.target.value }))}
          placeholder="Optional"
        />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : "Save Changes"}
        </Button>
      </div>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────

export default function AdminBillableItemsPage() {
  const [items, setItems] = useState<BillableItem[]>([]);
  const [devices, setDevices] = useState<DeviceRead[]>([]);
  const [clinics, setClinics] = useState<AdminClinic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | BillableItemCategory>("all");
  const [clinicFilter, setClinicFilter] = useState(""); // "" = every clinic's applicable price (default + all overrides)
  const [showInactive, setShowInactive] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<BillableItem | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setItems(await adminService.getBillableItems({ activeOnly: !showInactive, clinicId: clinicFilter || undefined }));
    } catch (err: any) {
      setLoadError(extractErrorMessage(err, "Failed to load billable items"));
    }
  }, [showInactive, clinicFilter]);

  useEffect(() => {
    treatmentProtocolService.listDevices({ activeOnly: true }).then(setDevices).catch(() => {});
    adminService.getClinics().then(setClinics).catch(() => {});
  }, []);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  async function handleToggleActive(item: BillableItem) {
    setTogglingId(item.item_id);
    try {
      await adminService.updateBillableItem(item.item_id, { is_active: !item.is_active });
      await load();
    } catch (err: any) {
      setLoadError(extractErrorMessage(err, "Failed to update item"));
    } finally {
      setTogglingId(null);
    }
  }

  const deviceNameById = new Map(devices.map((d) => [d.device_id, d.device_name]));
  const clinicNameById = new Map(clinics.map((c) => [c.clinic_id, c.clinic_name]));
  const knownAppointmentTypes = Array.from(
    new Set(items.filter((i) => i.category === "appointment" && i.appointment_type).map((i) => i.appointment_type as string))
  );
  const filtered = items.filter((i) => filter === "all" || i.category === filter);

  function clinicLabel(clinicId?: string | null): string {
    return clinicId ? (clinicNameById.get(clinicId) ?? "Unknown clinic") : "All clinics (default)";
  }

  if (isLoading) return <ItemsSkeleton />;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Billable Items</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Pricing catalog for appointments and device sessions — what patients get charged.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Item
        </Button>
      </div>

      {loadError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{loadError}</div>}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1">
          {(["all", "appointment", "device_session"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filter === f ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {f === "all" ? "All" : f === "appointment" ? "Appointments" : "Device Sessions"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={clinicFilter}
            onChange={(e) => setClinicFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-neutral-200 rounded-lg bg-white text-neutral-600"
          >
            <option value="">All clinics</option>
            {clinics.map((c) => (
              <option key={c.clinic_id} value={c.clinic_id}>
                {c.clinic_name}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded border-neutral-300"
            />
            Show inactive
          </label>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <DollarSign className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-600">No billable items yet</p>
            <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
              Nothing here is priced — bookings fall back to a placeholder amount until items are added.
            </p>
            <Button className="mt-4" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Item
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-neutral-100">
            {filtered.map((item) => (
              <div key={item.item_id} className="flex items-center justify-between px-6 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-neutral-800 truncate">{item.name}</p>
                    <Badge>
                      {item.category === "appointment" ? item.appointment_type : deviceNameById.get(item.device_id ?? "") ?? "Device"}
                    </Badge>
                    {item.clinic_id ? (
                      <span className="text-xs font-medium text-indigo-600 bg-indigo-50 rounded-full px-2 py-0.5">
                        {clinicLabel(item.clinic_id)}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-neutral-500 bg-neutral-100 rounded-full px-2 py-0.5">Default</span>
                    )}
                    {!item.is_active && (
                      <span className="text-xs font-medium text-neutral-500 bg-neutral-100 rounded-full px-2 py-0.5">Inactive</span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {item.item_code} · {item.currency} {item.price.toFixed(2)}
                    {item.duration_minutes ? ` · ${item.duration_minutes} min` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-4 flex-shrink-0">
                  <button
                    onClick={() => setEditItem(item)}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleToggleActive(item)}
                    disabled={togglingId === item.item_id}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors disabled:opacity-50"
                    title={item.is_active ? "Deactivate" : "Activate"}
                  >
                    {item.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Billable Item">
        <CreateItemForm
          devices={devices}
          clinics={clinics}
          knownAppointmentTypes={knownAppointmentTypes}
          onSubmit={async (data) => {
            const created = await adminService.createBillableItem(data);
            await load();
            return created;
          }}
          onClose={() => setShowCreate(false)}
        />
      </Modal>

      <Modal isOpen={!!editItem} onClose={() => setEditItem(null)} title="Edit Billable Item">
        {editItem && (
          <EditItemForm
            item={editItem}
            clinicName={clinicLabel(editItem.clinic_id)}
            onSubmit={async (data) => {
              const updated = await adminService.updateBillableItem(editItem.item_id, data);
              await load();
              return updated;
            }}
            onClose={() => setEditItem(null)}
          />
        )}
      </Modal>
    </div>
  );
}
