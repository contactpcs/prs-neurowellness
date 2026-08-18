"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Plus, Trash2, CalendarX, Cpu, ChevronDown, ChevronUp } from "lucide-react";
import { useAuth } from "@/lib/hooks";
import { Card, CardContent, Button, Input, Select, Modal, Skeleton, Badge } from "@/components/ui";
import { extractErrorMessage } from "@/lib/api/errors";
import { treatmentProtocolService } from "@/lib/api/services/treatmentProtocol.service";
import type {
  ClinicDeviceScheduleOverview, DeviceScheduleRead, DeviceOverrideRead, DeviceScheduleItem,
} from "@/types/treatmentProtocol.types";

// DB: Sun=0, Mon=1, ..., Sat=6 — same convention as clinic_device_schedules
// and the doctor weekly schedule this screen mirrors.
const DISPLAY_DAYS = [
  { label: "Monday",    short: "Mon", dow: 1 },
  { label: "Tuesday",   short: "Tue", dow: 2 },
  { label: "Wednesday", short: "Wed", dow: 3 },
  { label: "Thursday",  short: "Thu", dow: 4 },
  { label: "Friday",    short: "Fri", dow: 5 },
  { label: "Saturday",  short: "Sat", dow: 6 },
  { label: "Sunday",    short: "Sun", dow: 0 },
];

const SLOT_DURATIONS = [15, 20, 30, 45, 60].map((d) => ({ value: String(d), label: `${d} min` }));

function toHHMM(t: string | null | undefined): string {
  return t ? t.slice(0, 5) : "";
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Working minutes in a day, minus any break — the ingredient for the
// suggested-capacity hint. Pure arithmetic, mirrors the note in backend
// SQL/v1/41_device_capacity_per_device.sql: capacity stays admin-typed,
// this is only ever a shown default, never enforced.
function suggestedCapacity(
  quantity: number, startTime: string, endTime: string, slotMinutes: number, breakStart: string, breakEnd: string
): number | null {
  if (!startTime || !endTime || !slotMinutes) return null;
  const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
  let windowMin = toMin(endTime) - toMin(startTime);
  if (windowMin <= 0) return null;
  if (breakStart && breakEnd) {
    const b = toMin(breakEnd) - toMin(breakStart);
    if (b > 0) windowMin -= b;
  }
  const slotsPerDevice = Math.floor(windowMin / slotMinutes);
  return Math.max(0, quantity * slotsPerDevice);
}

function ScheduleSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1].map((i) => (
        <div key={i} className="bg-white rounded-xl border border-neutral-200/80 p-4">
          <Skeleton className="h-4 w-40 mb-2" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

// ─── Edit one device's weekly schedule ─────────────────────────────────────

interface DayCfg {
  enabled: boolean;
  start_time: string;
  end_time: string;
  slot_duration_minutes: string;
  break_start: string;
  break_end: string;
  capacity: string;
}

function EditWeeklyScheduleForm({
  clinicId,
  clinicDeviceId,
  quantity,
  existing,
  onSaved,
  onClose,
}: {
  clinicId: string;
  clinicDeviceId: string;
  quantity: number;
  existing: DeviceScheduleRead[];
  onSaved: (rows: DeviceScheduleRead[]) => void;
  onClose: () => void;
}) {
  const [cfg, setCfg] = useState<Record<number, DayCfg>>(() => {
    const init: Record<number, DayCfg> = {};
    for (const dd of DISPLAY_DAYS) {
      const row = existing.find((w) => w.day_of_week === dd.dow && w.is_active);
      init[dd.dow] = {
        enabled: !!row,
        start_time: toHHMM(row?.start_time) || "08:00",
        end_time: toHHMM(row?.end_time) || "17:00",
        slot_duration_minutes: String(row?.slot_duration_minutes ?? 30),
        break_start: toHHMM(row?.break_start),
        break_end: toHHMM(row?.break_end),
        capacity: row ? String(row.capacity) : "",
      };
    }
    return init;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (dow: number, p: Partial<DayCfg>) =>
    setCfg((c) => ({ ...c, [dow]: { ...c[dow], ...p } }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const enabledDays = DISPLAY_DAYS.filter((dd) => cfg[dd.dow]?.enabled);
    for (const dd of enabledDays) {
      const c = cfg[dd.dow];
      const cap = parseInt(c.capacity, 10);
      if (!Number.isFinite(cap) || cap < 1) {
        setError(`${dd.label}: capacity must be at least 1`);
        return;
      }
    }
    const items: DeviceScheduleItem[] = enabledDays.map((dd) => {
      const c = cfg[dd.dow];
      return {
        day_of_week: dd.dow,
        start_time: c.start_time + ":00",
        end_time: c.end_time + ":00",
        slot_duration_minutes: Number(c.slot_duration_minutes),
        break_start: c.break_start ? c.break_start + ":00" : null,
        break_end: c.break_end ? c.break_end + ":00" : null,
        capacity: parseInt(c.capacity, 10),
        is_active: true,
      };
    });
    setSubmitting(true);
    setError(null);
    try {
      const rows = await treatmentProtocolService.replaceDeviceSchedule(clinicId, clinicDeviceId, { items });
      onSaved(rows);
      onClose();
    } catch (err: any) {
      setError(extractErrorMessage(err, "Failed to save schedule"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="max-h-[55vh] overflow-y-auto space-y-3 pr-1">
        {DISPLAY_DAYS.map((dd) => {
          const c = cfg[dd.dow];
          const suggested = suggestedCapacity(
            quantity, c.start_time, c.end_time, Number(c.slot_duration_minutes) || 0, c.break_start, c.break_end
          );
          return (
            <div
              key={dd.dow}
              className={`rounded-xl border p-4 transition-colors ${
                c.enabled ? "border-blue-200 bg-blue-50/30" : "border-neutral-200 bg-neutral-50"
              }`}
            >
              <label className="flex items-center gap-3 cursor-pointer select-none mb-3">
                <input
                  type="checkbox"
                  checked={c.enabled}
                  onChange={(e) => patch(dd.dow, { enabled: e.target.checked, capacity: e.target.checked && !c.capacity && suggested ? String(suggested) : c.capacity })}
                  className="rounded border-neutral-300"
                />
                <span className={`text-sm font-semibold ${c.enabled ? "text-neutral-900" : "text-neutral-400"}`}>
                  {dd.label}
                </span>
              </label>

              {c.enabled && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 ml-7">
                  <Input
                    label="Start time"
                    type="time"
                    value={c.start_time}
                    onChange={(e) => patch(dd.dow, { start_time: e.target.value })}
                    required
                  />
                  <Input
                    label="End time"
                    type="time"
                    value={c.end_time}
                    onChange={(e) => patch(dd.dow, { end_time: e.target.value })}
                    required
                  />
                  <Select
                    label="Slot duration"
                    value={c.slot_duration_minutes}
                    onChange={(e) => patch(dd.dow, { slot_duration_minutes: e.target.value })}
                    options={SLOT_DURATIONS}
                  />
                  <div>
                    <Input
                      label="Capacity *"
                      type="number"
                      min={1}
                      value={c.capacity}
                      onChange={(e) => patch(dd.dow, { capacity: e.target.value })}
                      required
                    />
                    {suggested !== null && (
                      <button
                        type="button"
                        onClick={() => patch(dd.dow, { capacity: String(suggested) })}
                        className="mt-1 text-[11px] text-blue-600 hover:underline"
                      >
                        Suggested: {suggested} ({quantity} device{quantity === 1 ? "" : "s"} × hours ÷ slot)
                      </button>
                    )}
                  </div>
                  <Input
                    label="Break start (opt)"
                    type="time"
                    value={c.break_start}
                    onChange={(e) => patch(dd.dow, { break_start: e.target.value })}
                  />
                  <Input
                    label="Break end (opt)"
                    type="time"
                    value={c.break_end}
                    onChange={(e) => patch(dd.dow, { break_end: e.target.value })}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="text-xs text-danger-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save Schedule"}
        </Button>
      </div>
    </form>
  );
}

// ─── Add override ───────────────────────────────────────────────────────────

function AddOverrideForm({
  clinicId,
  clinicDeviceId,
  onAdded,
  onClose,
}: {
  clinicId: string;
  clinicDeviceId: string;
  onAdded: (row: DeviceOverrideRead) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState(todayStr());
  const [isAvailable, setIsAvailable] = useState(false);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("17:00");
  const [capacity, setCapacity] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (capacity && (!Number.isFinite(parseInt(capacity, 10)) || parseInt(capacity, 10) < 1)) {
      setError("Capacity must be at least 1, or left blank to inherit the weekly template");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const row = await treatmentProtocolService.addDeviceOverride(clinicId, clinicDeviceId, {
        override_date: date,
        is_available: isAvailable,
        start_time: isAvailable ? startTime + ":00" : null,
        end_time: isAvailable ? endTime + ":00" : null,
        capacity: capacity ? parseInt(capacity, 10) : null,
        reason: reason || null,
      });
      onAdded(row);
      onClose();
    } catch (err: any) {
      setError(extractErrorMessage(err, "Failed to add override"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Date *" type="date" min={todayStr()} value={date} onChange={(e) => setDate(e.target.value)} required />

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Type</label>
        <div className="flex rounded-lg overflow-hidden border border-neutral-200 text-sm font-medium">
          <button
            type="button"
            onClick={() => setIsAvailable(false)}
            className={`flex-1 py-2 transition-colors ${!isAvailable ? "bg-danger-600 text-white" : "bg-white text-neutral-600"}`}
          >
            Closed
          </button>
          <button
            type="button"
            onClick={() => setIsAvailable(true)}
            className={`flex-1 py-2 transition-colors border-l border-neutral-200 ${isAvailable ? "bg-blue-600 text-white" : "bg-white text-neutral-600"}`}
          >
            Custom Hours
          </button>
        </div>
      </div>

      {isAvailable && (
        <div className="grid grid-cols-2 gap-3">
          <Input label="Start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <Input label="End" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Capacity override</label>
        <Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Leave blank to inherit weekly capacity" />
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-700 mb-1.5">Reason</label>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. device maintenance, assistant on leave" />
      </div>

      {error && <p className="text-xs text-danger-600">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Add Override"}
        </Button>
      </div>
    </form>
  );
}

// ─── One device's card ──────────────────────────────────────────────────────

function DeviceCard({
  clinicId,
  device,
  onWeekSaved,
}: {
  clinicId: string;
  device: ClinicDeviceScheduleOverview;
  onWeekSaved: (clinicDeviceId: string, week: DeviceScheduleRead[]) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overrides, setOverrides] = useState<DeviceOverrideRead[] | null>(null);
  const [overridesError, setOverridesError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [addOverrideOpen, setAddOverrideOpen] = useState(false);
  const [deleteRow, setDeleteRow] = useState<DeviceOverrideRead | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadOverrides = useCallback(async () => {
    try {
      setOverrides(await treatmentProtocolService.listDeviceOverrides(clinicId, device.clinic_device_id, todayStr()));
      setOverridesError(null);
    } catch (err: any) {
      setOverridesError(extractErrorMessage(err, "Failed to load overrides"));
    }
  }, [clinicId, device.clinic_device_id]);

  useEffect(() => {
    if (expanded && overrides === null) loadOverrides();
  }, [expanded, overrides, loadOverrides]);

  async function handleDelete() {
    if (!deleteRow) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await treatmentProtocolService.deleteDeviceOverride(clinicId, device.clinic_device_id, deleteRow.override_id);
      setOverrides((prev) => (prev ?? []).filter((o) => o.override_id !== deleteRow.override_id));
      setDeleteRow(null);
    } catch (err: any) {
      setDeleteError(extractErrorMessage(err, "Failed to remove override"));
    } finally {
      setDeleting(false);
    }
  }

  const activeDays = device.week.filter((w) => w.is_active);

  return (
    <Card>
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Cpu className="h-4.5 w-4.5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium text-neutral-800 truncate">{device.device_name ?? "Unknown device"}</p>
              {device.modality && <Badge>{device.modality}</Badge>}
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Owns {device.quantity} · {activeDays.length === 0 ? "no schedule set" : `${activeDays.length} day${activeDays.length === 1 ? "" : "s"}/week`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
            {activeDays.length === 0 ? "Set Up Schedule" : "Edit Schedule"}
          </Button>
          <button
            onClick={() => setExpanded((e) => !e)}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
            title={expanded ? "Hide details" : "Show details"}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-neutral-100">
          {activeDays.length > 0 && (
            <div className="divide-y divide-neutral-100">
              {DISPLAY_DAYS.map((dd) => {
                const row = device.week.find((w) => w.day_of_week === dd.dow && w.is_active);
                if (!row) return null;
                return (
                  <div key={dd.dow} className="flex items-center justify-between px-6 py-2.5 text-sm">
                    <span className="w-10 font-semibold text-neutral-700">{dd.short}</span>
                    <span className="text-neutral-500 flex-1">
                      {toHHMM(row.start_time)}–{toHHMM(row.end_time)}
                      {row.break_start && row.break_end && (
                        <span className="text-neutral-400 text-xs ml-2">break {toHHMM(row.break_start)}–{toHHMM(row.break_end)}</span>
                      )}
                    </span>
                    <span className="text-neutral-400 text-xs mr-4">{row.slot_duration_minutes}m slots</span>
                    <span className="text-xs font-medium text-blue-700 bg-blue-50 rounded-full px-2 py-0.5">capacity {row.capacity}</span>
                  </div>
                );
              })}
            </div>
          )}

          <div className="px-6 py-4 border-t border-neutral-100">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">Date Overrides</h3>
              <Button size="sm" variant="outline" onClick={() => setAddOverrideOpen(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add
              </Button>
            </div>
            {overridesError && <p className="text-xs text-danger-600 mb-2">{overridesError}</p>}
            {overrides === null ? (
              <Skeleton className="h-8 w-full" />
            ) : overrides.length === 0 ? (
              <p className="text-xs text-neutral-400 text-center py-3">No upcoming overrides</p>
            ) : (
              <div className="space-y-2">
                {overrides.map((ov) => (
                  <div key={ov.override_id} className="flex items-start gap-3 group">
                    <CalendarX className="h-4 w-4 mt-0.5 flex-shrink-0 text-danger-400" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-neutral-800">
                          {new Date(ov.override_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <span className={`text-xs font-semibold rounded-full px-2 py-0.5 ${ov.is_available ? "bg-blue-100 text-blue-700" : "bg-danger-100 text-danger-700"}`}>
                          {ov.is_available ? "Custom hours" : "Closed"}
                        </span>
                        {ov.capacity != null && (
                          <span className="text-xs font-medium text-neutral-500 bg-neutral-100 rounded-full px-2 py-0.5">capacity {ov.capacity}</span>
                        )}
                      </div>
                      {ov.is_available && ov.start_time && ov.end_time && (
                        <p className="text-xs text-neutral-500 mt-0.5">{toHHMM(ov.start_time)}–{toHHMM(ov.end_time)}</p>
                      )}
                      {ov.reason && <p className="text-xs text-neutral-400 mt-0.5">{ov.reason}</p>}
                    </div>
                    <button
                      onClick={() => { setDeleteRow(ov); setDeleteError(null); }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-400 hover:text-danger-600 flex-shrink-0"
                      title="Remove override"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title={`Edit Schedule — ${device.device_name ?? "Device"}`} className="max-w-2xl">
        <EditWeeklyScheduleForm
          clinicId={clinicId}
          clinicDeviceId={device.clinic_device_id}
          quantity={device.quantity}
          existing={device.week}
          onSaved={(week) => onWeekSaved(device.clinic_device_id, week)}
          onClose={() => setEditOpen(false)}
        />
      </Modal>

      <Modal isOpen={addOverrideOpen} onClose={() => setAddOverrideOpen(false)} title={`Add Override — ${device.device_name ?? "Device"}`}>
        <AddOverrideForm
          clinicId={clinicId}
          clinicDeviceId={device.clinic_device_id}
          onAdded={(row) => setOverrides((prev) => [row, ...(prev ?? [])].sort((a, b) => a.override_date.localeCompare(b.override_date)))}
          onClose={() => setAddOverrideOpen(false)}
        />
      </Modal>

      <Modal isOpen={!!deleteRow} onClose={() => setDeleteRow(null)} title="Remove Override">
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Remove the override for{" "}
            <strong>{deleteRow ? new Date(deleteRow.override_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}</strong>?
            The weekly template applies again for that date.
          </p>
          {deleteError && (
            <div className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700">{deleteError}</div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteRow(null)} disabled={deleting}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>{deleting ? "Removing…" : "Remove"}</Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export default function DeviceSchedulesPage() {
  const { user } = useAuth();
  const clinicId = user?.clinic_id;

  const [devices, setDevices] = useState<ClinicDeviceScheduleOverview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clinicId) return;
    setLoadError(null);
    try {
      setDevices(await treatmentProtocolService.listDeviceScheduleOverview(clinicId));
    } catch (err: any) {
      setLoadError(extractErrorMessage(err, "Failed to load device schedules"));
    }
  }, [clinicId]);

  useEffect(() => {
    setIsLoading(true);
    load().finally(() => setIsLoading(false));
  }, [load]);

  function handleWeekSaved(clinicDeviceId: string, week: DeviceScheduleRead[]) {
    setDevices((prev) => prev.map((d) => (d.clinic_device_id === clinicDeviceId ? { ...d, week } : d)));
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
      <div>
        <Link
          href="/clinic-admin/settings"
          className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 mb-2"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Settings
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900">Device Schedule</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          When each device can run sessions, and how many at once — one pool per device, not one shared number for the clinic.
          Doctor calendars are separate and untouched by this.
        </p>
      </div>

      {loadError && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{loadError}</div>
      )}

      {isLoading ? (
        <ScheduleSkeleton />
      ) : devices.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Clock className="h-8 w-8 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-700">No devices in inventory</p>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
              Add a device under Settings → Clinic Devices first — a schedule needs a device to belong to.
            </p>
            <Link href="/clinic-admin/settings/devices">
              <Button className="mt-4">Go to Clinic Devices</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {devices.map((d) => (
            <DeviceCard key={d.clinic_device_id} clinicId={clinicId!} device={d} onWeekSaved={handleWeekSaved} />
          ))}
        </div>
      )}
    </div>
  );
}
