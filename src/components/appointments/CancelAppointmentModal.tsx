"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { Modal, Button } from "@/components/ui";
import { appointmentsService, type AppointmentPolicy } from "@/lib/api/services/appointments.service";
import { paymentsService, type Payment } from "@/lib/api/services/payments.service";
import type { Appointment } from "@/types/domain.types";

interface CancelAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment;
  onCancelled: (appointment: Appointment) => void;
}

type Tier = { min_hours_before: number; refund_percent: number };

/** Same rule as the backend's resolve_cancellation_refund_percent: tiers are
 * highest-threshold first, the first one the notice clears applies, below
 * every threshold the refund is 0. */
function refundPercent(tiers: Tier[], hoursUntil: number): number {
  const sorted = [...tiers].sort((a, b) => b.min_hours_before - a.min_hours_before);
  return sorted.find((t) => hoursUntil >= t.min_hours_before)?.refund_percent ?? 0;
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Cancels a booked appointment and shows, before confirming, what the
 * clinic's cancellation policy will refund for it. The refund itself is
 * computed and paid out by the backend (online: automatic Razorpay refund;
 * cash: at the counter) — the figure here is a preview. */
export function CancelAppointmentModal({ isOpen, onClose, appointment, onCancelled }: CancelAppointmentModalProps) {
  const [policy, setPolicy] = useState<AppointmentPolicy | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setReason("");
    setError(null);
    setLoading(true);
    Promise.all([
      appointmentsService.getPolicy().catch(() => null),
      paymentsService
        .myList()
        .then((rows) => rows.find((p) => p.appointment_id === appointment.appointment_id) ?? null)
        .catch(() => null),
    ])
      .then(([pol, pay]) => {
        setPolicy(pol);
        setPayment(pay);
      })
      .finally(() => setLoading(false));
  }, [isOpen, appointment.appointment_id]);

  const tiers =
    appointment.appointment_type === "device_session"
      ? policy?.values.refund_tiers_device_session
      : policy?.values.refund_tiers_appointment;
  const hoursUntil = (new Date(`${appointment.appointment_date}T${appointment.start_time || "00:00"}`).getTime() - Date.now()) / 3_600_000;
  const isPaid = payment?.status === "paid";
  const pct = tiers ? refundPercent(tiers, hoursUntil) : 0;
  const refund = isPaid && payment ? Math.round(payment.amount * pct) / 100 : 0;
  const cancellationPoints = policy?.sections.find((s) => s.key === "cancellation")?.points ?? [];

  async function handleConfirm() {
    if (!reason.trim()) {
      setError("Please tell us why you are cancelling.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      onCancelled(await appointmentsService.myCancel(appointment.appointment_id, reason.trim()));
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? e?.response?.data?.detail ?? "Could not cancel the appointment — please try again");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Cancel Appointment" className="max-w-md">
      {loading ? (
        <div className="flex items-center justify-center h-24">
          <div className="w-5 h-5 border-2 border-neutral-200 border-t-primary-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className={`rounded-lg border px-4 py-3 ${refund > 0 ? "border-success-100 bg-success-50" : "border-warning-100 bg-warning-50"}`}>
            {isPaid ? (
              refund > 0 ? (
                <p className="text-sm text-success-800">
                  Cancelling now refunds <span className="font-semibold">{inr(refund)}</span> ({pct}% of {inr(payment!.amount)}).
                </p>
              ) : (
                <p className="text-sm text-warning-800">Cancelling now is too close to the appointment for a refund. You will not get money back.</p>
              )
            ) : (
              <p className="text-sm text-warning-800">There is no completed payment on this appointment, so there is nothing to refund.</p>
            )}
          </div>

          {cancellationPoints.length > 0 && (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-neutral-700 mb-1.5">
                <Info className="h-3.5 w-3.5" /> Cancellation and refund policy
              </p>
              <ul className="space-y-1">
                {cancellationPoints.map((p) => (
                  <li key={p} className="text-xs text-neutral-600 leading-relaxed">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Reason for cancelling</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g. Unable to travel that day"
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            />
          </div>

          {error && <p className="text-xs text-danger-600 bg-danger-50 border border-danger-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
              Keep Appointment
            </Button>
            <Button variant="danger" size="sm" onClick={handleConfirm} isLoading={submitting}>
              Cancel Appointment
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
