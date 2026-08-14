"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Cpu, Plus, Pencil, Trash2, PowerOff, Power } from "lucide-react";
import { useAuth } from "@/lib/hooks";
import { Card, CardContent, Button, Input, Select, Modal, Badge, Skeleton } from "@/components/ui";
import { clinicDevicesService } from "@/lib/api/services/clinicDevices.service";
import { treatmentProtocolService } from "@/lib/api/services/treatmentProtocol.service";
import type { ClinicDeviceRead, DeviceRead } from "@/types/treatmentProtocol.types";

function extractErrorMessage(err: any, fallback: string): string {
  return err?.response?.data?.error?.message || err?.response?.data?.detail || fallback;
}

function DevicesSkeleton() {
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

// Step 1 of the protocol wizard offers only what this list contains — a device
// missing here is a device a doctor at this clinic cannot prescribe on, even if
// it exists in the platform-wide catalogue.
function AddDeviceForm({
  clinicId,
  existingDeviceIds,
  onAdded,
  onClose,
}: {
  clinicId: string;
  existingDeviceIds: Set<string>;
  onAdded: (row: ClinicDeviceRead) => void;
  onClose: () => void;
}) {
  const [catalogue, setCatalogue] = useState<DeviceRead[]>([]);
  const [catalogueLoading, setCatalogueLoading] = useState(true);
  const [deviceId, setDeviceId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [acquiredOn, setAcquiredOn] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Unfiltered catalogue — the superadmin's full device registry, not this
    // clinic's inventory. That's what an admin picks FROM when adding one.
    treatmentProtocolService
      .listDevices({ activeOnly: true })
      .then(setCatalogue)
      .finally(() => setCatalogueLoading(false));
  }, []);

  const options = catalogue
    .filter((d) => !existingDeviceIds.has(d.device_id))
    .map((d) => ({
      value: d.device_id,
      label: `${d.device_name}${d.company_name ? ` — ${d.company_name}` : ""}${d.phase === 2 ? " (Phase 2)" : ""}`,
    }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!deviceId) {
      setError("Select a device");
      return;
    }
    const qty = parseInt(quantity, 10);
    if (!Number.isFinite(qty) || qty < 1) {
      setError("Quantity must be at least 1");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const row = await clinicDevicesService.add(clinicId, {
        device_id: deviceId,
        quantity: qty,
        acquired_on: acquiredOn || null,
        notes: notes || null,
      });
      onAdded(row);
      onClose();
    } catch (err: any) {
      setError(extractErrorMessage(err, "Failed to add device"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {catalogueLoading ? (
        <Skeleton className="h-10 w-full" />
      ) : options.length === 0 ? (
        <p className="text-sm text-neutral-500">
          Every catalogue device is already listed for this clinic.
        </p>
      ) : (
        <Select
          label="Device *"
          value={deviceId}
          onChange={(e) => setDeviceId(e.target.value)}
          options={options}
          placeholder="Select a device"
          required
        />
      )}
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Quantity *</label>
        <Input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
        />
        <p className="mt-1 text-xs text-neutral-500">
          Units this clinic owns — separate from how many sessions can run at once.
        </p>
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Acquired on</label>
        <Input type="date" value={acquiredOn} onChange={(e) => setAcquiredOn(e.target.value)} />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Notes</label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </div>
      {error && <p className="text-xs text-danger-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting || options.length === 0}>
          {submitting ? "Adding…" : "Add Device"}
        </Button>
      </div>
    </form>
  );
}

function EditQuantityForm({
  row,
  clinicId,
  onSaved,
  onClose,
}: {
  row: ClinicDeviceRead;
  clinicId: string;
  onSaved: (row: ClinicDeviceRead) => void;
  onClose: () => void;
}) {
  const [quantity, setQuantity] = useState(String(row.quantity));
  const [notes, setNotes] = useState(row.notes ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const qty = parseInt(quantity, 10);
    if (!Number.isFinite(qty) || qty < 1) {
      setError("Quantity must be at least 1");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const updated = await clinicDevicesService.update(clinicId, row.clinic_device_id, {
        quantity: qty,
        notes: notes || null,
      });
      onSaved(updated);
      onClose();
    } catch (err: any) {
      setError(extractErrorMessage(err, "Failed to update"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Quantity *</label>
        <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
      </div>
      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Notes</label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
      </div>
      {error && <p className="text-xs text-danger-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save"}
        </Button>
      </div>
    </form>
  );
}

export default function ClinicDevicesPage() {
  const { user } = useAuth();
  const clinicId = user?.clinic_id;

  const [rows, setRows] = useState<ClinicDeviceRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [editRow, setEditRow] = useState<ClinicDeviceRead | null>(null);
  const [deleteRow, setDeleteRow] = useState<ClinicDeviceRead | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clinicId) return;
    setLoadError(null);
    try {
      setRows(await clinicDevicesService.list(clinicId, !showInactive));
    } catch (err: any) {
      setLoadError(extractErrorMessage(err, "Failed to load clinic devices"));
    }
  }, [clinicId, showInactive]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  async function handleToggleActive(row: ClinicDeviceRead) {
    if (!clinicId) return;
    setToggling(row.clinic_device_id);
    try {
      const updated = await clinicDevicesService.update(clinicId, row.clinic_device_id, {
        is_active: !row.is_active,
      });
      setRows((prev) => prev.map((r) => (r.clinic_device_id === updated.clinic_device_id ? updated : r)));
    } catch (err: any) {
      setLoadError(extractErrorMessage(err, "Failed to update device"));
    } finally {
      setToggling(null);
    }
  }

  async function handleDelete() {
    if (!clinicId || !deleteRow) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await clinicDevicesService.remove(clinicId, deleteRow.clinic_device_id);
      setRows((prev) => prev.filter((r) => r.clinic_device_id !== deleteRow.clinic_device_id));
      setDeleteRow(null);
    } catch (err: any) {
      // CLINIC_DEVICE_IN_USE (409): a protocol has prescribed this device.
      // Surface the server's own message rather than a generic one — it
      // already says to deactivate instead.
      setDeleteError(extractErrorMessage(err, "Failed to remove device"));
    } finally {
      setDeleting(false);
    }
  }

  if (!user?.clinic_id) {
    return (
      <div className="max-w-2xl">
        <p className="text-sm text-neutral-500">No clinic is associated with your account.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/clinic-admin/settings"
            className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 mb-2"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Settings
          </Link>
          <h1 className="text-2xl font-bold text-neutral-900">Clinic Devices</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            Which neuromodulation devices this clinic owns. Gates what a doctor can prescribe here.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Device
        </Button>
      </div>

      <label className="flex items-center gap-2 text-sm text-neutral-600">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
          className="rounded border-neutral-300"
        />
        Show retired devices
      </label>

      {loadError && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {loadError}
        </div>
      )}

      {isLoading ? (
        <DevicesSkeleton />
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Cpu className="h-8 w-8 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-700">No devices configured</p>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
              Doctors at this clinic cannot prescribe any device until at least one is added here.
            </p>
            <Button className="mt-4" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Device
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <div className="divide-y divide-neutral-100">
            {rows.map((row) => (
              <div key={row.clinic_device_id} className="flex items-center justify-between px-6 py-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-neutral-800 truncate">
                      {row.device_name ?? "Unknown device"}
                    </p>
                    {row.modality && (
                      <Badge>{row.modality}</Badge>
                    )}
                    {!row.is_active && (
                      <span className="text-xs font-medium text-neutral-500 bg-neutral-100 rounded-full px-2 py-0.5">
                        Retired
                      </span>
                    )}
                    {row.phase === 2 && (
                      <span className="text-xs font-medium text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
                        Phase 2 — not yet prescribable
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {row.company_name ? `${row.company_name} · ` : ""}
                    Qty {row.quantity}
                    {row.notes ? ` · ${row.notes}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 ml-4 flex-shrink-0">
                  <button
                    onClick={() => setEditRow(row)}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
                    title="Edit quantity"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleToggleActive(row)}
                    disabled={toggling === row.clinic_device_id}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors disabled:opacity-50"
                    title={row.is_active ? "Retire" : "Reactivate"}
                  >
                    {row.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => {
                      setDeleteRow(row);
                      setDeleteError(null);
                    }}
                    className="p-1.5 rounded-lg text-neutral-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="Add Device">
        {clinicId && (
          <AddDeviceForm
            clinicId={clinicId}
            existingDeviceIds={new Set(rows.map((r) => r.device_id))}
            onAdded={(row) => setRows((prev) => [row, ...prev])}
            onClose={() => setAddOpen(false)}
          />
        )}
      </Modal>

      <Modal isOpen={!!editRow} onClose={() => setEditRow(null)} title="Edit Device">
        {clinicId && editRow && (
          <EditQuantityForm
            row={editRow}
            clinicId={clinicId}
            onSaved={(updated) =>
              setRows((prev) => prev.map((r) => (r.clinic_device_id === updated.clinic_device_id ? updated : r)))
            }
            onClose={() => setEditRow(null)}
          />
        )}
      </Modal>

      <Modal isOpen={!!deleteRow} onClose={() => setDeleteRow(null)} title="Remove Device">
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Remove <strong>{deleteRow?.device_name}</strong> from this clinic&apos;s inventory?
            This is only for correcting a mistaken entry — if the device has ever been
            prescribed here, retire it instead.
          </p>
          {deleteError && (
            <div className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700">
              {deleteError}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteRow(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Removing…" : "Remove"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
