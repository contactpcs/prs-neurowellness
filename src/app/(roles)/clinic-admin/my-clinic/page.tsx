"use client";

import { useEffect, useState } from "react";
import { Building2, Edit2, RefreshCw, Power, PowerOff, Clock } from "lucide-react";
import { useAuth } from "@/lib/hooks";
import { Card, CardContent, Button, Input, Skeleton, Modal, DetailFieldList, PageShell } from "@/components/ui";
import { adminService } from "@/lib/api/services/admin.service";
import type { AdminClinic, ClinicWeeklyHours, ClinicWeeklyHoursItem, CreateClinicPayload } from "@/types/admin.types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const STATUS_STYLES: Record<AdminClinic["status"], string> = {
  setup: "bg-amber-100 text-amber-700",
  active: "bg-green-100 text-green-700",
  pending_closure: "bg-orange-100 text-orange-700",
  closed: "bg-neutral-200 text-neutral-600",
};
const STATUS_LABELS: Record<AdminClinic["status"], string> = {
  setup: "Setup", active: "Active", pending_closure: "Closing", closed: "Closed",
};

function MyClinicSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <div className="bg-white rounded-xl border border-neutral-200/80 p-6 space-y-3">
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}

function EditClinicForm({ clinic, onSubmit, onClose }: {
  clinic: AdminClinic;
  onSubmit: (data: Partial<CreateClinicPayload>) => Promise<unknown>;
  onClose: () => void;
}) {
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

interface DayRow {
  enabled: boolean;
  start_time: string; // "HH:MM"
  end_time: string;
}

function toRows(hours: ClinicWeeklyHours[]): DayRow[] {
  const byDay = new Map(hours.map((h) => [h.day_of_week, h]));
  return DAY_NAMES.map((_, dow) => {
    const row = byDay.get(dow);
    return row
      ? { enabled: true, start_time: row.start_time.slice(0, 5), end_time: row.end_time.slice(0, 5) }
      : { enabled: false, start_time: "09:00", end_time: "18:00" };
  });
}

/** Weekly clinic operating hours — a day with `enabled: false` is simply
 * omitted from the saved set, which scheduling/service.py treats as closed
 * (once the clinic has ANY hours configured at all) rather than unset. */
function WeeklyHoursEditor({ clinicId, initialHours }: { clinicId: string; initialHours: ClinicWeeklyHours[] }) {
  const [rows, setRows] = useState<DayRow[]>(toRows(initialHours));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function updateRow(dow: number, patch: Partial<DayRow>) {
    setSaved(false);
    setRows((prev) => prev.map((r, i) => (i === dow ? { ...r, ...patch } : r)));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const items: ClinicWeeklyHoursItem[] = rows
        .map((r, dow) => ({ ...r, dow }))
        .filter((r) => r.enabled)
        .map((r) => ({ day_of_week: r.dow, start_time: `${r.start_time}:00`, end_time: `${r.end_time}:00` }));
      await adminService.replaceClinicHours(clinicId, items);
      setSaved(true);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.detail || "Failed to save hours");
    } finally {
      setSaving(false);
    }
  }

  const anyConfigured = rows.some((r) => r.enabled);

  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-700 flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> Weekly Operating Hours
          </h2>
          <Button size="sm" disabled={saving} onClick={handleSave}>{saving ? "Saving…" : "Save Hours"}</Button>
        </div>
        {!anyConfigured && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
            No hours configured yet — doctor schedules at this clinic aren&apos;t restricted to any hours until you save at least one day here.
          </p>
        )}
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        {saved && <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">Hours saved.</p>}
        <div className="space-y-2">
          {DAY_NAMES.map((name, dow) => {
            const row = rows[dow];
            return (
              <div key={dow} className="flex items-center gap-3">
                <label className="flex items-center gap-2 w-32 flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    onChange={(e) => updateRow(dow, { enabled: e.target.checked })}
                    className="rounded border-neutral-300"
                  />
                  <span className="text-sm text-neutral-700">{name}</span>
                </label>
                {row.enabled ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      value={row.start_time}
                      onChange={(e) => updateRow(dow, { start_time: e.target.value })}
                      className="px-2 py-1 text-sm border border-neutral-200 rounded-lg"
                    />
                    <span className="text-neutral-400 text-sm">to</span>
                    <input
                      type="time"
                      value={row.end_time}
                      onChange={(e) => updateRow(dow, { end_time: e.target.value })}
                      className="px-2 py-1 text-sm border border-neutral-200 rounded-lg"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-neutral-300">Closed</span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function ClinicAdminMyClinicPage() {
  const { user } = useAuth();
  const [clinic, setClinic] = useState<AdminClinic | null>(null);
  const [hours, setHours] = useState<ClinicWeeklyHours[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmingToggle, setConfirmingToggle] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  async function load() {
    if (!user?.clinic_id) return;
    setError(null);
    try {
      const [clinicRes, hoursRes] = await Promise.all([
        adminService.getClinic(user.clinic_id),
        adminService.getClinicHours(user.clinic_id),
      ]);
      setClinic(clinicRes);
      setHours(hoursRes);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Failed to load clinic");
    }
  }

  useEffect(() => { setIsLoading(true); load().finally(() => setIsLoading(false)); }, [user?.clinic_id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  async function handleUpdate(data: Partial<CreateClinicPayload>) {
    if (!user?.clinic_id) return;
    const updated = await adminService.updateClinic(user.clinic_id, data);
    setClinic(updated);
    return updated;
  }

  async function handleToggleOperational() {
    if (!user?.clinic_id || !clinic) return;
    setTogglingStatus(true);
    try {
      const updated = await adminService.setClinicOperationalStatus(user.clinic_id, !clinic.is_operational);
      setClinic(updated);
      setConfirmingToggle(false);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Failed to update clinic status");
    } finally {
      setTogglingStatus(false);
    }
  }

  if (isLoading) return <MyClinicSkeleton />;

  return (
    <PageShell
      title="My Clinic"
      root="Clinic Admin"
      actions={
        <>
          <button onClick={handleRefresh} disabled={refreshing} title="Refresh"
            className="p-2.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          {clinic && (
            <>
              <Button
                variant={clinic.is_operational ? "outline" : "primary"}
                onClick={() => setConfirmingToggle(true)}
              >
                {clinic.is_operational ? <PowerOff className="h-4 w-4 mr-1.5" /> : <Power className="h-4 w-4 mr-1.5" />}
                {clinic.is_operational ? "Close Clinic" : "Reopen Clinic"}
              </Button>
              <Button onClick={() => setShowEdit(true)}><Edit2 className="h-4 w-4 mr-1.5" />Edit Clinic</Button>
            </>
          )}
        </>
      }
    >
      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}

      {clinic && (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <Building2 className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-lg font-semibold text-neutral-900">{clinic.clinic_name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[clinic.status]}`}>{STATUS_LABELS[clinic.status]}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${clinic.is_operational ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                    {clinic.is_operational ? "Open" : "Closed"}
                  </span>
                </div>
              </div>
            </div>
            <DetailFieldList data={clinic} exclude={["is_active", "is_operational"]} />
          </CardContent>
        </Card>
      )}

      {clinic && <WeeklyHoursEditor key={clinic.clinic_id} clinicId={clinic.clinic_id} initialHours={hours} />}

      <Modal isOpen={confirmingToggle} onClose={() => setConfirmingToggle(false)} title={clinic?.is_operational ? "Close this clinic?" : "Reopen this clinic?"}>
        <div className="space-y-4">
          <p className="text-sm text-neutral-700">
            {clinic?.is_operational
              ? "While closed, doctors can't set new schedules and no new appointments — including device sessions — can be booked or claimed at this clinic. Existing bookings are unaffected."
              : "Reopening lets doctors set schedules and patients book appointments here again."}
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setConfirmingToggle(false)} disabled={togglingStatus}>Cancel</Button>
            <Button onClick={handleToggleOperational} disabled={togglingStatus}>
              {togglingStatus ? "Saving…" : clinic?.is_operational ? "Close Clinic" : "Reopen Clinic"}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit Clinic">
        {clinic && <EditClinicForm clinic={clinic} onSubmit={handleUpdate} onClose={() => setShowEdit(false)} />}
      </Modal>
    </PageShell>
  );
}
