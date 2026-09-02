"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Power, PowerOff } from "lucide-react";
import { Button, Input, Skeleton } from "@/components/ui";
import { clinicDevicesService } from "@/lib/api/services/clinicDevices.service";
import type { DeviceUnitRead } from "@/types/treatmentProtocol.types";

function extractErrorMessage(err: any, fallback: string): string {
  return err?.response?.data?.error?.message || err?.response?.data?.detail || fallback;
}

/** Serial-numbered physical units under one clinic_device row. Optional —
 * a clinic can keep using quantity alone with no units listed here. Lets a
 * clinic admin register serials so a protocol can later pin a specific
 * unit (Step 1 of the protocol wizard), letting device_sessions auto-fetch
 * the serial at session start instead of a CA typing one. */
export function DeviceUnitsManager({ clinicId, clinicDeviceId }: { clinicId: string; clinicDeviceId: string }) {
  const [units, setUnits] = useState<DeviceUnitRead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showRetired, setShowRetired] = useState(false);
  const [serial, setSerial] = useState("");
  const [notes, setNotes] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setUnits(await clinicDevicesService.listUnits(clinicId, clinicDeviceId, !showRetired));
    } catch (err: any) {
      setError(extractErrorMessage(err, "Failed to load units"));
    }
  }, [clinicId, clinicDeviceId, showRetired]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serial.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const unit = await clinicDevicesService.addUnit(clinicId, clinicDeviceId, {
        serial_number: serial.trim(),
        notes: notes || null,
      });
      setUnits((prev) => [unit, ...prev]);
      setSerial("");
      setNotes("");
    } catch (err: any) {
      setError(extractErrorMessage(err, "Failed to add unit"));
    } finally {
      setAdding(false);
    }
  };

  const handleToggleStatus = async (unit: DeviceUnitRead) => {
    try {
      const updated = await clinicDevicesService.updateUnit(clinicId, clinicDeviceId, unit.device_unit_id, {
        status: unit.status === "active" ? "retired" : "active",
      });
      setUnits((prev) => prev.map((u) => (u.device_unit_id === updated.device_unit_id ? updated : u)));
    } catch (err: any) {
      setError(extractErrorMessage(err, "Failed to update unit"));
    }
  };

  const handleRemove = async (unit: DeviceUnitRead) => {
    try {
      await clinicDevicesService.removeUnit(clinicId, clinicDeviceId, unit.device_unit_id);
      setUnits((prev) => prev.filter((u) => u.device_unit_id !== unit.device_unit_id));
    } catch (err: any) {
      setError(extractErrorMessage(err, "Failed to remove unit"));
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-500">
        Optional. Register the serial number of each physical unit so a doctor can pin one when prescribing —
        the clinical assistant then sees it pre-filled at session start instead of typing it.
      </p>

      <form onSubmit={handleAdd} className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Serial number</label>
          <Input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="e.g. SN-00231" />
        </div>
        <div className="flex-1">
          <label className="block text-sm font-medium text-neutral-700 mb-1.5">Notes</label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </div>
        <Button type="submit" disabled={adding || !serial.trim()}>
          <Plus className="h-4 w-4 mr-1.5" />
          {adding ? "Adding…" : "Add"}
        </Button>
      </form>

      {error && <p className="text-xs text-danger-600">{error}</p>}

      <label className="flex items-center gap-2 text-sm text-neutral-600">
        <input
          type="checkbox"
          checked={showRetired}
          onChange={(e) => setShowRetired(e.target.checked)}
          className="rounded border-neutral-300"
        />
        Show retired units
      </label>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : units.length === 0 ? (
        <p className="text-sm text-neutral-400">No units registered yet.</p>
      ) : (
        <div className="divide-y divide-neutral-100 border border-neutral-200/80 rounded-xl">
          {units.map((unit) => (
            <div key={unit.device_unit_id} className="flex items-center justify-between px-4 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-800 truncate">{unit.serial_number}</p>
                <p className="text-xs text-neutral-500">
                  {unit.status === "retired" ? "Retired" : "Active"}
                  {unit.notes ? ` · ${unit.notes}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-1 ml-4 flex-shrink-0">
                <button
                  onClick={() => handleToggleStatus(unit)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
                  title={unit.status === "active" ? "Retire" : "Reactivate"}
                >
                  {unit.status === "active" ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => handleRemove(unit)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
