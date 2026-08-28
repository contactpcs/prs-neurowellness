"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Percent } from "lucide-react";
import { Card, CardContent, Button, Input, Select, Modal, Badge, Skeleton, PageShell } from "@/components/ui";
import { adminService } from "@/lib/api/services/admin.service";
import type {
  AdminClinic,
  CancellationPolicyTier,
  CancellationPolicyTierCreatePayload,
  CancellationPolicyTierUpdatePayload,
  PlatformFeeConfig,
  SessionType,
} from "@/types/admin.types";

function extractErrorMessage(err: any, fallback: string): string {
  return err?.response?.data?.error?.message || err?.response?.data?.detail || fallback;
}

const SESSION_TYPE_LABEL: Record<SessionType, string> = {
  appointment: "Appointment (Consultation)",
  device_session: "Device Session",
};

function FeeConfigSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1].map((i) => (
        <div key={i} className="bg-white rounded-xl border border-neutral-200/80 p-4">
          <Skeleton className="h-4 w-48 mb-2" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

// ─── Platform fee — two rows, global percent, inline edit ─────────────────

function PlatformFeeRow({
  config,
  onSave,
}: {
  config: PlatformFeeConfig;
  onSave: (feePercent: number) => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(config.fee_percent));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const pct = parseFloat(value);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setError("Must be between 0 and 100");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(pct);
      setEditing(false);
    } catch (err: any) {
      setError(extractErrorMessage(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div>
        <p className="text-sm font-medium text-neutral-800">{SESSION_TYPE_LABEL[config.session_type]}</p>
        <p className="text-xs text-neutral-400 mt-0.5">Same percentage for every clinic — charged on top of the base fee</p>
      </div>
      {editing ? (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={100}
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-24"
          />
          <span className="text-sm text-neutral-500">%</span>
          {error && <span className="text-xs text-red-600">{error}</span>}
          <Button size="sm" disabled={saving} onClick={handleSave}>{saving ? "Saving…" : "Save"}</Button>
          <Button
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() => {
              setEditing(false);
              setValue(String(config.fee_percent));
              setError(null);
            }}
          >
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-neutral-900">{config.fee_percent}%</span>
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Cancellation tier create/edit form ────────────────────────────────────

function TierForm({
  sessionType,
  clinics,
  existing,
  onSubmit,
  onClose,
}: {
  sessionType: SessionType;
  clinics: AdminClinic[];
  existing?: CancellationPolicyTier;
  onSubmit: (data: CancellationPolicyTierCreatePayload | CancellationPolicyTierUpdatePayload) => Promise<unknown>;
  onClose: () => void;
}) {
  const [clinicId, setClinicId] = useState(existing?.clinic_id ?? "");
  const [minHours, setMinHours] = useState(existing ? String(existing.min_hours_before) : "");
  const [refundPercent, setRefundPercent] = useState(existing ? String(existing.refund_percent) : "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const hours = parseFloat(minHours);
    const pct = parseFloat(refundPercent);
    if (!Number.isFinite(hours) || hours < 0) {
      setError("Hours before appointment must be 0 or more");
      return;
    }
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      setError("Refund percent must be between 0 and 100");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (existing) {
        await onSubmit({ min_hours_before: hours, refund_percent: pct });
      } else {
        await onSubmit({
          clinic_id: clinicId || null,
          session_type: sessionType,
          min_hours_before: hours,
          refund_percent: pct,
        });
      }
      onClose();
    } catch (err: any) {
      setError(extractErrorMessage(err, "Failed to save tier"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!existing && (
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Clinic</label>
          <Select
            value={clinicId}
            onChange={(e) => setClinicId(e.target.value)}
            options={clinics.map((c) => ({ value: c.clinic_id, label: c.clinic_name }))}
            placeholder="Platform default (all clinics)"
          />
          <p className="mt-1 text-xs text-neutral-400">
            Leave blank for the default tier set every clinic uses. Pick a clinic to give it its own complete tier set instead —
            any one tier for that clinic replaces the whole default set for it, not just this threshold.
          </p>
        </div>
      )}
      {existing && (
        <p className="text-xs text-neutral-500 bg-neutral-50 rounded-lg px-3 py-2">
          {SESSION_TYPE_LABEL[existing.session_type]} ·{" "}
          {existing.clinic_id ? clinics.find((c) => c.clinic_id === existing.clinic_id)?.clinic_name ?? "This clinic" : "All clinics (default)"}
          {" "}— fixed at creation. To move a tier to a different clinic/session type, delete and re-create it.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Hours before appointment *</label>
          <Input type="number" min={0} step="0.5" value={minHours} onChange={(e) => setMinHours(e.target.value)} placeholder="e.g. 12" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Refund % *</label>
          <Input type="number" min={0} max={100} step="1" value={refundPercent} onChange={(e) => setRefundPercent(e.target.value)} placeholder="e.g. 100" required />
        </div>
      </div>
      <p className="text-xs text-neutral-400">
        A patient cancelling at least this many hours before their appointment gets this refund percentage. Below every
        configured threshold, refund is 0%.
      </p>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? "Saving…" : existing ? "Save Changes" : "Add Tier"}</Button>
      </div>
    </form>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────

export default function AdminFeeConfigPage() {
  const [feeConfig, setFeeConfig] = useState<PlatformFeeConfig[]>([]);
  const [tiers, setTiers] = useState<CancellationPolicyTier[]>([]);
  const [clinics, setClinics] = useState<AdminClinic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [sessionTypeFilter, setSessionTypeFilter] = useState<SessionType>("appointment");
  const [clinicFilter, setClinicFilter] = useState(""); // "" = default + every override

  const [showCreate, setShowCreate] = useState(false);
  const [editTier, setEditTier] = useState<CancellationPolicyTier | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadTiers = useCallback(async () => {
    setLoadError(null);
    try {
      setTiers(await adminService.getCancellationPolicyTiers({ sessionType: sessionTypeFilter, clinicId: clinicFilter || undefined }));
    } catch (err: any) {
      setLoadError(extractErrorMessage(err, "Failed to load cancellation tiers"));
    }
  }, [sessionTypeFilter, clinicFilter]);

  useEffect(() => {
    adminService.getClinics().then(setClinics).catch(() => {});
    adminService.getPlatformFeeConfig().then(setFeeConfig).catch((err) => setLoadError(extractErrorMessage(err, "Failed to load platform fee config")));
  }, []);

  useEffect(() => {
    setIsLoading(true);
    loadTiers().finally(() => setIsLoading(false));
  }, [loadTiers]);

  async function handleSaveFee(sessionType: SessionType, feePercent: number) {
    const updated = await adminService.updatePlatformFeeConfig(sessionType, { fee_percent: feePercent });
    setFeeConfig((prev) => prev.map((f) => (f.session_type === sessionType ? updated : f)));
  }

  async function handleDeleteTier(tier: CancellationPolicyTier) {
    if (!confirm(`Remove the ${tier.min_hours_before}h / ${tier.refund_percent}% tier?`)) return;
    setDeletingId(tier.tier_id);
    try {
      await adminService.deleteCancellationPolicyTier(tier.tier_id);
      await loadTiers();
    } catch (err: any) {
      setLoadError(extractErrorMessage(err, "Failed to delete tier"));
    } finally {
      setDeletingId(null);
    }
  }

  function clinicLabel(clinicId?: string | null): string {
    return clinicId ? (clinics.find((c) => c.clinic_id === clinicId)?.clinic_name ?? "Unknown clinic") : "All clinics (default)";
  }

  const sortedTiers = [...tiers].sort((a, b) => b.min_hours_before - a.min_hours_before);

  return (
    <PageShell title="Fees & Cancellation Policy" root="Admin">
      <div className="space-y-6 max-w-4xl -mt-3">
      <p className="text-sm text-neutral-500">
        What patients pay on top of the base fee, and how much they get back when they cancel.
      </p>

      {loadError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{loadError}</div>}

      {/* Platform / convenience fee */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-700 mb-2 flex items-center gap-1.5">
          <Percent className="h-4 w-4" /> Platform &amp; Convenience Fee
        </h2>
        {feeConfig.length === 0 ? (
          <FeeConfigSkeleton />
        ) : (
          <Card>
            <div className="divide-y divide-neutral-100">
              {feeConfig.map((f) => (
                <PlatformFeeRow key={f.session_type} config={f} onSave={(pct) => handleSaveFee(f.session_type, pct)} />
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* Cancellation policy tiers */}
      <div>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
          <h2 className="text-sm font-semibold text-neutral-700">Cancellation Refund Tiers</h2>
          <Button size="sm" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Add Tier
          </Button>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1">
            {(["appointment", "device_session"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setSessionTypeFilter(t)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  sessionTypeFilter === t ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                }`}
              >
                {SESSION_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          <select
            value={clinicFilter}
            onChange={(e) => setClinicFilter(e.target.value)}
            className="px-3 py-1.5 text-xs border border-neutral-200 rounded-lg bg-white text-neutral-600"
          >
            <option value="">All clinics</option>
            {clinics.map((c) => (
              <option key={c.clinic_id} value={c.clinic_id}>{c.clinic_name}</option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <FeeConfigSkeleton />
        ) : sortedTiers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm font-medium text-neutral-600">No tiers configured for {SESSION_TYPE_LABEL[sessionTypeFilter]}</p>
              <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                Until a tier is added, every cancellation of this type refunds 0% — free cancellation must be configured
                explicitly, it&apos;s never assumed.
              </p>
              <Button className="mt-4" size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add Tier
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <div className="divide-y divide-neutral-100">
              {sortedTiers.map((tier) => (
                <div key={tier.tier_id} className="flex items-center justify-between px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-neutral-800">
                      {tier.min_hours_before}h+ before &rarr; {tier.refund_percent}% refund
                    </span>
                    {tier.clinic_id ? (
                      <span className="text-xs font-medium text-indigo-600 bg-indigo-50 rounded-full px-2 py-0.5">{clinicLabel(tier.clinic_id)}</span>
                    ) : (
                      <Badge>Default</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditTier(tier)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTier(tier)}
                      disabled={deletingId === tier.tier_id}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Add Cancellation Tier">
        <TierForm
          sessionType={sessionTypeFilter}
          clinics={clinics}
          onSubmit={async (data) => {
            const created = await adminService.createCancellationPolicyTier(data as CancellationPolicyTierCreatePayload);
            await loadTiers();
            return created;
          }}
          onClose={() => setShowCreate(false)}
        />
      </Modal>

      <Modal isOpen={!!editTier} onClose={() => setEditTier(null)} title="Edit Cancellation Tier">
        {editTier && (
          <TierForm
            sessionType={editTier.session_type}
            clinics={clinics}
            existing={editTier}
            onSubmit={async (data) => {
              const updated = await adminService.updateCancellationPolicyTier(editTier.tier_id, data as CancellationPolicyTierUpdatePayload);
              await loadTiers();
              return updated;
            }}
            onClose={() => setEditTier(null)}
          />
        )}
      </Modal>
      </div>
    </PageShell>
  );
}
