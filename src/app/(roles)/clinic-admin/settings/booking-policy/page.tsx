"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Trash2, RotateCcw, Ban, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/lib/hooks";
import { Card, CardContent, Button, Skeleton } from "@/components/ui";
import { adminService } from "@/lib/api/services/admin.service";
import type { BookingPolicy, RefundTier, SessionType } from "@/types/admin.types";

const SESSION_TYPES: { key: SessionType; label: string; hint: string }[] = [
  { key: "appointment", label: "Consultations", hint: "Initial visits, follow-ups and protocol follow-ups" },
  { key: "device_session", label: "Device sessions", hint: "Neuromodulation sessions from a treatment protocol" },
];
const MAX_ROWS = 10;

type Draft = { custom: boolean; rows: { hours: string; percent: string }[] };

function errorText(err: any, fallback: string): string {
  return err?.response?.data?.error?.message || err?.response?.data?.detail || fallback;
}

const h = (n: number) => `${n} hour${n === 1 ? "" : "s"}`;

/** Same wording the patient sees before booking (backend scheduling/policy.py). */
function describe(tiers: RefundTier[]): string[] {
  const sorted = [...tiers].sort((a, b) => b.min_hours_before - a.min_hours_before);
  if (!sorted.length) return ["Cancellations are not refunded."];
  const lines: string[] = [];
  let upper: number | null = null;
  for (const t of sorted) {
    const when =
      upper === null
        ? t.min_hours_before === 0 ? "Cancelled any time before the start" : `Cancelled ${h(t.min_hours_before)} or more before the start`
        : t.min_hours_before === 0 ? `Cancelled less than ${h(upper)} before the start` : `Cancelled between ${t.min_hours_before} and ${h(upper)} before the start`;
    lines.push(`${when}: ${t.refund_percent ? `${t.refund_percent}% refund` : "no refund"}`);
    upper = t.min_hours_before;
  }
  const lowest = sorted[sorted.length - 1].min_hours_before;
  if (lowest > 0) lines.push(`Cancelled less than ${h(lowest)} before the start: no refund`);
  return lines;
}

/** Client-side copy of the backend's validate_tier_set, so mistakes show
 * before saving. The server checks again. */
function parseRows(draft: Draft): { tiers: RefundTier[]; error: string | null } {
  const tiers: RefundTier[] = [];
  for (const r of draft.rows) {
    const hours = Number(r.hours);
    const percent = Number(r.percent);
    if (r.hours.trim() === "" || !Number.isFinite(hours) || hours < 0 || hours > 720) return { tiers, error: "Hours must be between 0 and 720" };
    if (r.percent.trim() === "" || !Number.isFinite(percent) || percent < 0 || percent > 100) return { tiers, error: "Refund must be between 0% and 100%" };
    tiers.push({ min_hours_before: hours, refund_percent: percent });
  }
  if (draft.custom && tiers.length === 0) return { tiers, error: "Add at least one row, or use the platform default" };
  const sorted = [...tiers].sort((a, b) => b.min_hours_before - a.min_hours_before);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].min_hours_before === sorted[i - 1].min_hours_before) return { tiers, error: "Two rows have the same number of hours" };
    if (sorted[i].refund_percent > sorted[i - 1].refund_percent)
      return { tiers, error: `Cancelling ${h(sorted[i].min_hours_before)} before cannot refund more than ${h(sorted[i - 1].min_hours_before)} before` };
  }
  return { tiers: sorted, error: null };
}

function toDraft(policy: BookingPolicy, type: SessionType): Draft {
  const rule = policy.refund_rules[type];
  return {
    custom: !rule.uses_default,
    rows: rule.tiers.map((t) => ({ hours: String(t.min_hours_before), percent: String(t.refund_percent) })),
  };
}

export default function BookingPolicyPage() {
  const { user } = useAuth();
  const clinicId = user?.clinic_id;

  const [policy, setPolicy] = useState<BookingPolicy | null>(null);
  const [drafts, setDrafts] = useState<Record<SessionType, Draft> | null>(null);
  const [customReschedule, setCustomReschedule] = useState(false);
  const [rescheduleHours, setRescheduleHours] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function hydrate(p: BookingPolicy) {
    setPolicy(p);
    setDrafts({ appointment: toDraft(p, "appointment"), device_session: toDraft(p, "device_session") });
    setCustomReschedule(p.reschedule_min_hours !== null);
    setRescheduleHours(String(p.effective_reschedule_min_hours));
  }

  useEffect(() => {
    if (!clinicId) return;
    adminService.getBookingPolicy(clinicId).then(hydrate).catch((e) => setLoadError(errorText(e, "Could not load the booking policy")));
  }, [clinicId]);

  const parsed = useMemo(
    () => (drafts ? { appointment: parseRows(drafts.appointment), device_session: parseRows(drafts.device_session) } : null),
    [drafts]
  );
  const rescheduleError = customReschedule
    ? rescheduleHours.trim() === "" || !(Number(rescheduleHours) >= 0 && Number(rescheduleHours) <= 720) ? "Hours must be between 0 and 720" : null
    : null;
  const hasErrors = !parsed || !!parsed.appointment.error || !!parsed.device_session.error || !!rescheduleError;

  function updateDraft(type: SessionType, fn: (d: Draft) => Draft) {
    setSaved(false);
    setDrafts((prev) => (prev ? { ...prev, [type]: fn(prev[type]) } : prev));
  }

  async function save() {
    if (!clinicId || !parsed || hasErrors) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await adminService.saveBookingPolicy(clinicId, {
        reschedule_min_hours: customReschedule ? Number(rescheduleHours) : null,
        refund_rules: {
          appointment: drafts!.appointment.custom ? parsed.appointment.tiers : [],
          device_session: drafts!.device_session.custom ? parsed.device_session.tiers : [],
        },
      });
      hydrate(updated);
      setSaved(true);
    } catch (e) {
      setSaveError(errorText(e, "Could not save the booking policy"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <Link href="/clinic-admin/settings" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-700 mb-2">
          <ArrowLeft className="h-4 w-4" /> Settings
        </Link>
        <h1 className="text-2xl font-bold text-neutral-900">Booking Policy</h1>
        <p className="text-sm text-neutral-500 mt-0.5">
          How much patients get back when they cancel a paid booking, and how close to the visit they can still reschedule.
          Patients see these rules before they book.
        </p>
      </div>

      {loadError && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{loadError}</div>}

      {!policy || !drafts || !parsed ? (
        !loadError && (
          <div className="space-y-4">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        )
      ) : (
        <>
          <Card>
            <CardContent className="p-6 space-y-6">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                  <Ban className="h-4.5 w-4.5 text-red-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-neutral-900">Refund on cancellation</h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Each row means “cancelled at least this many hours before the visit → this much of the amount paid comes back”.
                    Cancelling closer than the smallest row gets no refund. Only paid bookings are refunded.
                  </p>
                </div>
              </div>

              {SESSION_TYPES.map(({ key, label, hint }) => {
                const draft = drafts[key];
                const rule = policy.refund_rules[key];
                const { tiers, error } = parsed[key];
                return (
                  <div key={key} className="border border-neutral-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-sm font-semibold text-neutral-800">{label}</p>
                        <p className="text-xs text-neutral-500">{hint}</p>
                      </div>
                      <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1">
                        {[
                          { custom: false, text: "Platform default" },
                          { custom: true, text: "Custom for this clinic" },
                        ].map((o) => (
                          <button
                            key={o.text}
                            type="button"
                            onClick={() =>
                              updateDraft(key, (d) => ({
                                custom: o.custom,
                                // Starting a custom set from the default is the common case: tweak, don't retype.
                                rows: o.custom && d.rows.length === 0
                                  ? rule.default_tiers.map((t) => ({ hours: String(t.min_hours_before), percent: String(t.refund_percent) }))
                                  : o.custom ? d.rows : rule.default_tiers.map((t) => ({ hours: String(t.min_hours_before), percent: String(t.refund_percent) })),
                              }))
                            }
                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                              draft.custom === o.custom ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                            }`}
                          >
                            {o.text}
                          </button>
                        ))}
                      </div>
                    </div>

                    {draft.custom ? (
                      <div className="space-y-2">
                        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">
                          <span>Cancelled at least (hours before)</span>
                          <span>Refund (% of amount paid)</span>
                          <span className="w-8" />
                        </div>
                        {draft.rows.map((r, i) => (
                          <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                            <input
                              type="number"
                              min={0}
                              max={720}
                              value={r.hours}
                              onChange={(e) => updateDraft(key, (d) => ({ ...d, rows: d.rows.map((x, j) => (j === i ? { ...x, hours: e.target.value } : x)) }))}
                              className="px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={r.percent}
                              onChange={(e) => updateDraft(key, (d) => ({ ...d, rows: d.rows.map((x, j) => (j === i ? { ...x, percent: e.target.value } : x)) }))}
                              className="px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            />
                            <button
                              type="button"
                              title="Remove row"
                              onClick={() => updateDraft(key, (d) => ({ ...d, rows: d.rows.filter((_, j) => j !== i) }))}
                              className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          disabled={draft.rows.length >= MAX_ROWS}
                          onClick={() => updateDraft(key, (d) => ({ ...d, rows: [...d.rows, { hours: "", percent: "" }] }))}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-40"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add row
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-neutral-500">This clinic follows the platform default set by the super admin.</p>
                    )}

                    {error ? (
                      <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
                    ) : (
                      <ul className="bg-neutral-50 border border-neutral-100 rounded-lg px-3 py-2 space-y-0.5">
                        {describe(draft.custom ? tiers : rule.default_tiers).map((line) => (
                          <li key={line} className="text-xs text-neutral-700">{line}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <RotateCcw className="h-4.5 w-4.5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-neutral-900">Rescheduling</h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    How many hours before a booked visit a patient can still move it themselves. Front desk can always reschedule.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-neutral-100 rounded-lg p-1 w-fit">
                {[
                  { custom: false, text: `Platform default (${policy.default_reschedule_min_hours} hours)` },
                  { custom: true, text: "Custom for this clinic" },
                ].map((o) => (
                  <button
                    key={o.text}
                    type="button"
                    onClick={() => {
                      setSaved(false);
                      setCustomReschedule(o.custom);
                      if (!o.custom) setRescheduleHours(String(policy.default_reschedule_min_hours));
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      customReschedule === o.custom ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                    }`}
                  >
                    {o.text}
                  </button>
                ))}
              </div>
              {customReschedule && (
                <label className="flex items-center gap-2 text-sm text-neutral-700">
                  Patients can reschedule up to
                  <input
                    type="number"
                    min={0}
                    max={720}
                    value={rescheduleHours}
                    onChange={(e) => {
                      setSaved(false);
                      setRescheduleHours(e.target.value);
                    }}
                    className="w-24 px-3 py-1.5 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                  hours before the visit
                </label>
              )}
              {rescheduleError && <p className="text-xs text-red-600">{rescheduleError}</p>}
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-3">
            {saved && (
              <span className="inline-flex items-center gap-1 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4" /> Saved — new bookings and cancellations use this now
              </span>
            )}
            {saveError && <span className="text-sm text-red-600">{saveError}</span>}
            <Button variant="outline" onClick={() => hydrate(policy)} disabled={saving}>
              Discard changes
            </Button>
            <Button onClick={save} disabled={saving || hasErrors}>
              {saving ? "Saving…" : "Save policy"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
