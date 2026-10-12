"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Power, PowerOff, Cpu, Factory } from "lucide-react";
import { Card, CardContent, Button, Input, Select, Modal, Badge, Skeleton } from "@/components/ui";
import { treatmentProtocolService } from "@/lib/api/services/treatmentProtocol.service";
import {
  MODALITIES,
  type DeviceCompanyCreate,
  type DeviceCompanyRead,
  type DeviceCreate,
  type DeviceRead,
  type Modality,
} from "@/types/treatmentProtocol.types";

// Super admin's device catalogue — the registry every clinic picks FROM when
// adding a device to its own inventory (clinic-admin/settings/devices) and
// every prescription picks from. No delete: devices/companies are retired
// with is_active=false so historic protocols still name what delivered them.

function extractErrorMessage(err: any, fallback: string): string {
  return err?.response?.data?.error?.message || err?.response?.data?.detail || fallback;
}

// regulatory_ids is a {scheme: value} map; edited as one "scheme: value" per line.
function parseRegulatoryIds(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const idx = line.indexOf(":");
    if (idx <= 0) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key && val) out[key] = val;
  }
  return out;
}
function formatRegulatoryIds(ids?: Record<string, string>): string {
  return Object.entries(ids ?? {}).map(([k, v]) => `${k}: ${v}`).join("\n");
}

const PHASE_OPTIONS = [
  { value: "1", label: "1 — Selectable now" },
  { value: "2", label: "2 — Catalogued only (not yet prescribable)" },
];

// ─── Device form (create + edit) ──────────────────────────────────

function DeviceForm({
  device,
  companies,
  onSubmit,
  onClose,
}: {
  device?: DeviceRead;
  companies: DeviceCompanyRead[];
  onSubmit: (data: DeviceCreate) => Promise<unknown>;
  onClose: () => void;
}) {
  const isEdit = !!device;
  const [form, setForm] = useState({
    company_id: device?.company_id ?? "",
    device_code: device?.device_code ?? "",
    device_name: device?.device_name ?? "",
    model_number: device?.model_number ?? "",
    modality: (device?.modality as Modality) ?? MODALITIES[0],
    phase: String(device?.phase ?? 1),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (field: keyof typeof form, value: string) => setForm((p) => ({ ...p, [field]: value }));

  // Edit keeps the current company selectable even if it's since been deactivated.
  const companyOptions = companies
    .filter((c) => c.is_active || c.company_id === device?.company_id)
    .map((c) => ({ value: c.company_id, label: c.company_name }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_id) return setError("Select a manufacturer");
    if (!form.device_code.trim()) return setError("Device code is required");
    if (!form.device_name.trim()) return setError("Device name is required");
    setLoading(true);
    setError(null);
    try {
      await onSubmit({
        company_id: form.company_id,
        device_code: form.device_code.trim(),
        device_name: form.device_name.trim(),
        model_number: form.model_number.trim() || null,
        modality: form.modality,
        phase: Number(form.phase) as 1 | 2,
      });
      onClose();
    } catch (err: any) {
      setError(extractErrorMessage(err, isEdit ? "Failed to update device" : "Failed to create device"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isEdit && (
        <p className="text-xs text-neutral-500 bg-neutral-50 rounded-lg px-3 py-2">
          Code <strong>{device!.device_code}</strong> · {device!.modality} — fixed at creation. Wrong modality? Deactivate this
          device and create a new one (placements and dosing are stored per modality).
        </p>
      )}
      <Select
        label="Manufacturer *"
        value={form.company_id}
        onChange={(e) => set("company_id", e.target.value)}
        options={companyOptions}
        placeholder={companyOptions.length ? "Select a manufacturer" : "Add a manufacturer first"}
        required
      />
      {!isEdit && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Device Code *</label>
            <Input
              value={form.device_code}
              onChange={(e) => set("device_code", e.target.value.toUpperCase())}
              placeholder="e.g. BIO-001"
              required
            />
          </div>
          <Select
            label="Modality *"
            value={form.modality}
            onChange={(e) => set("modality", e.target.value)}
            options={MODALITIES.map((m) => ({ value: m, label: m }))}
            required
          />
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Device Name *</label>
        <Input value={form.device_name} onChange={(e) => set("device_name", e.target.value)} placeholder="e.g. Vagus One" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Model Number</label>
          <Input value={form.model_number} onChange={(e) => set("model_number", e.target.value)} placeholder="Optional" />
        </div>
        <Select label="Phase" value={form.phase} onChange={(e) => set("phase", e.target.value)} options={PHASE_OPTIONS} />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : isEdit ? "Save Changes" : "Create Device"}
        </Button>
      </div>
    </form>
  );
}

// ─── Company form (create + edit) ─────────────────────────────────

function CompanyForm({
  company,
  onSubmit,
  onClose,
}: {
  company?: DeviceCompanyRead;
  onSubmit: (data: DeviceCompanyCreate) => Promise<unknown>;
  onClose: () => void;
}) {
  const isEdit = !!company;
  const [form, setForm] = useState({
    company_code: company?.company_code ?? "",
    company_name: company?.company_name ?? "",
    country: company?.country ?? "",
    website: company?.website ?? "",
    support_email: company?.support_email ?? "",
    support_phone: company?.support_phone ?? "",
    regulatory_ids: formatRegulatoryIds(company?.regulatory_ids),
    notes: company?.notes ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (field: keyof typeof form, value: string) => setForm((p) => ({ ...p, [field]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.company_code.trim()) return setError("Company code is required");
    if (!form.company_name.trim()) return setError("Company name is required");
    setLoading(true);
    setError(null);
    try {
      await onSubmit({
        company_code: form.company_code.trim(),
        company_name: form.company_name.trim(),
        country: form.country.trim() || null,
        website: form.website.trim() || null,
        support_email: form.support_email.trim() || null,
        support_phone: form.support_phone.trim() || null,
        regulatory_ids: parseRegulatoryIds(form.regulatory_ids),
        notes: form.notes.trim() || null,
      });
      onClose();
    } catch (err: any) {
      setError(extractErrorMessage(err, isEdit ? "Failed to update manufacturer" : "Failed to create manufacturer"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Company Code *</label>
          <Input
            value={form.company_code}
            onChange={(e) => set("company_code", e.target.value.toUpperCase())}
            placeholder="e.g. BIOTHM"
            disabled={isEdit}
            required
          />
          {isEdit && <p className="mt-1 text-xs text-neutral-400">Fixed at creation.</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Company Name *</label>
          <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} placeholder="e.g. Biothm" required />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Country</label>
          <Input value={form.country} onChange={(e) => set("country", e.target.value)} placeholder="Optional" />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Website</label>
          <Input value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://…" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Support Email</label>
          <Input type="email" value={form.support_email} onChange={(e) => set("support_email", e.target.value)} placeholder="Optional" />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Support Phone</label>
          <Input value={form.support_phone} onChange={(e) => set("support_phone", e.target.value)} placeholder="Optional" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Regulatory IDs</label>
        <textarea
          rows={3}
          value={form.regulatory_ids}
          onChange={(e) => set("regulatory_ids", e.target.value)}
          placeholder={"One per line, e.g.\nCE: CE-2024-0011\nCDSCO: MD-12345"}
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Notes</label>
        <Input value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Optional" />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Saving…" : isEdit ? "Save Changes" : "Create Manufacturer"}
        </Button>
      </div>
    </form>
  );
}

// ─── Shared row ───────────────────────────────────────────────────

function Row({
  title,
  tags,
  subtitle,
  isActive,
  toggling,
  onEdit,
  onToggle,
}: {
  title: string;
  tags: React.ReactNode;
  subtitle: string;
  isActive: boolean;
  toggling: boolean;
  onEdit: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-neutral-800 truncate">{title}</p>
          {tags}
          {!isActive && <span className="text-xs font-medium text-neutral-500 bg-neutral-100 rounded-full px-2 py-0.5">Inactive</span>}
        </div>
        <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>
      </div>
      <div className="flex items-center gap-1 ml-4 flex-shrink-0">
        <button onClick={onEdit} className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors" title="Edit">
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={onToggle}
          disabled={toggling}
          className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors disabled:opacity-50"
          title={isActive ? "Deactivate" : "Activate"}
        >
          {isActive ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────

export default function AdminDeviceCatalogPage() {
  const [tab, setTab] = useState<"devices" | "companies">("devices");
  const [devices, setDevices] = useState<DeviceRead[]>([]);
  const [companies, setCompanies] = useState<DeviceCompanyRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [modalityFilter, setModalityFilter] = useState("");

  const [deviceModal, setDeviceModal] = useState<{ device?: DeviceRead } | null>(null);
  const [companyModal, setCompanyModal] = useState<{ company?: DeviceCompanyRead } | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Always load everything (incl. inactive); filter client-side so edit forms
  // can still resolve an inactive company by id.
  const load = useCallback(async () => {
    setError(null);
    try {
      const [d, c] = await Promise.all([
        treatmentProtocolService.listDevices({ activeOnly: false }),
        treatmentProtocolService.listDeviceCompanies(false),
      ]);
      setDevices(d);
      setCompanies(c);
    } catch (err: any) {
      setError(extractErrorMessage(err, "Failed to load device catalogue"));
    }
  }, []);

  useEffect(() => {
    load().finally(() => setIsLoading(false));
  }, [load]);

  async function toggle(id: string, run: () => Promise<unknown>) {
    setTogglingId(id);
    try {
      await run();
      await load();
    } catch (err: any) {
      setError(extractErrorMessage(err, "Failed to update"));
    } finally {
      setTogglingId(null);
    }
  }

  const visibleDevices = devices.filter((d) => (showInactive || d.is_active) && (!modalityFilter || d.modality === modalityFilter));
  const visibleCompanies = companies.filter((c) => showInactive || c.is_active);
  const deviceCountByCompany = devices.reduce<Record<string, number>>((acc, d) => {
    if (d.company_id) acc[d.company_id] = (acc[d.company_id] ?? 0) + 1;
    return acc;
  }, {});

  if (isLoading) {
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

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Device Catalog</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Platform-wide registry of manufacturers and device models. Clinics add devices to their own inventory from this list.
          </p>
        </div>
        <Button onClick={() => (tab === "devices" ? setDeviceModal({}) : setCompanyModal({}))}>
          <Plus className="h-4 w-4 mr-1.5" />
          {tab === "devices" ? "New Device" : "New Manufacturer"}
        </Button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1">
          {(["devices", "companies"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                tab === t ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
              }`}
            >
              {t === "devices" ? `Devices (${devices.length})` : `Manufacturers (${companies.length})`}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {tab === "devices" && (
            <select
              value={modalityFilter}
              onChange={(e) => setModalityFilter(e.target.value)}
              className="px-3 py-1.5 text-xs border border-neutral-200 rounded-lg bg-white text-neutral-600"
            >
              <option value="">All modalities</option>
              {MODALITIES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          )}
          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} className="rounded border-neutral-300" />
            Show inactive
          </label>
        </div>
      </div>

      {tab === "devices" ? (
        visibleDevices.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Cpu className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-neutral-600">No devices in the catalog</p>
              <p className="text-xs text-neutral-400 mt-1">
                {companies.some((c) => c.is_active) ? "Add the first device model." : "Add a manufacturer first, then its devices."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="divide-y divide-neutral-100">
              {visibleDevices.map((d) => (
                <Row
                  key={d.device_id}
                  title={d.device_name}
                  tags={
                    <>
                      <Badge>{d.modality}</Badge>
                      {d.phase === 2 && (
                        <span className="text-xs font-medium text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">Catalogued only</span>
                      )}
                    </>
                  }
                  subtitle={`${d.device_code}${d.model_number ? ` · ${d.model_number}` : ""} · ${d.company_name ?? "No manufacturer"}`}
                  isActive={d.is_active}
                  toggling={togglingId === d.device_id}
                  onEdit={() => setDeviceModal({ device: d })}
                  onToggle={() => toggle(d.device_id, () => treatmentProtocolService.updateDevice(d.device_id, { is_active: !d.is_active }))}
                />
              ))}
            </div>
          </Card>
        )
      ) : visibleCompanies.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Factory className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-600">No manufacturers yet</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-neutral-100">
            {visibleCompanies.map((c) => (
              <Row
                key={c.company_id}
                title={c.company_name}
                tags={<Badge>{c.company_code}</Badge>}
                subtitle={`${c.country ?? "—"} · ${deviceCountByCompany[c.company_id] ?? 0} device(s)${c.support_email ? ` · ${c.support_email}` : ""}`}
                isActive={c.is_active}
                toggling={togglingId === c.company_id}
                onEdit={() => setCompanyModal({ company: c })}
                onToggle={() =>
                  toggle(c.company_id, () => treatmentProtocolService.updateDeviceCompany(c.company_id, { is_active: !c.is_active }))
                }
              />
            ))}
          </div>
        </Card>
      )}

      <Modal isOpen={!!deviceModal} onClose={() => setDeviceModal(null)} title={deviceModal?.device ? "Edit Device" : "New Device"}>
        {deviceModal && (
          <DeviceForm
            device={deviceModal.device}
            companies={companies}
            onSubmit={async (data) => {
              if (deviceModal.device) {
                const { company_id, device_name, model_number, phase } = data;
                await treatmentProtocolService.updateDevice(deviceModal.device.device_id, { company_id, device_name, model_number, phase });
              } else {
                await treatmentProtocolService.createDevice(data);
              }
              await load();
            }}
            onClose={() => setDeviceModal(null)}
          />
        )}
      </Modal>

      <Modal
        isOpen={!!companyModal}
        onClose={() => setCompanyModal(null)}
        title={companyModal?.company ? "Edit Manufacturer" : "New Manufacturer"}
      >
        {companyModal && (
          <CompanyForm
            company={companyModal.company}
            onSubmit={async (data) => {
              if (companyModal.company) {
                const { company_code: _code, ...rest } = data;
                await treatmentProtocolService.updateDeviceCompany(companyModal.company.company_id, rest);
              } else {
                await treatmentProtocolService.createDeviceCompany(data);
              }
              await load();
            }}
            onClose={() => setCompanyModal(null)}
          />
        )}
      </Modal>
    </div>
  );
}
