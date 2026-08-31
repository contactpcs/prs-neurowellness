"use client";

import { useState } from "react";
import { Receipt, Search } from "lucide-react";
import { Card, CardContent, Button, Input, Modal } from "@/components/ui";
import { paymentsService, type Payment } from "@/lib/api/services/payments.service";
import { PaymentsHistorySection } from "@/components/payments/PaymentsHistorySection";

const STATUS_STYLES: Record<Payment["status"], string> = {
  pending: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-600",
  waived: "bg-blue-100 text-blue-700",
  refunded: "bg-neutral-200 text-neutral-600",
};

function WaiveModal({ payment, onConfirm, onClose }: {
  payment: Payment;
  onConfirm: (reason?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setLoading(true);
    setError(null);
    try {
      await onConfirm(reason || undefined);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.detail || "Failed to waive payment");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-700">
        Waive this payment of <strong>{payment.currency} {payment.amount}</strong>? This cannot be undone.
      </p>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Reason (optional)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="button" disabled={loading} onClick={confirm}>{loading ? "Waiving…" : "Waive Payment"}</Button>
      </div>
    </div>
  );
}

function RefundModal({ payment, onConfirm, onClose }: {
  payment: Payment;
  onConfirm: (reason?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setLoading(true);
    setError(null);
    try {
      await onConfirm(reason || undefined);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.detail || "Failed to refund payment");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-700">
        Mark this payment of <strong>{payment.currency} {payment.amount}</strong> as refunded? This only updates
        the record — it does not move money. Refund the patient separately before confirming.
      </p>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Reason (optional)</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="button" disabled={loading} onClick={confirm}>{loading ? "Refunding…" : "Mark as Refunded"}</Button>
      </div>
    </div>
  );
}

export default function ClinicAdminPaymentsPage() {
  const [paymentId, setPaymentId] = useState("");
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWaive, setShowWaive] = useState(false);
  const [showRefund, setShowRefund] = useState(false);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    if (!paymentId.trim()) return;
    setLoading(true);
    setError(null);
    setPayment(null);
    try {
      setPayment(await paymentsService.get(paymentId.trim()));
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Payment not found");
    } finally {
      setLoading(false);
    }
  }

  async function handleWaive(reason?: string) {
    if (!payment) return;
    const updated = await paymentsService.waive(payment.payment_id, reason);
    setPayment(updated);
  }

  async function handleRefund(reason?: string) {
    if (!payment) return;
    const updated = await paymentsService.refund(payment.payment_id, reason);
    setPayment(updated);
  }

  const canWaive = payment && (payment.status === "pending" || payment.status === "failed");
  // Distinct from canWaive: refund reverses a *completed* payment, waive
  // writes off one that was never collected — only one ever applies.
  const canRefund = payment && payment.status === "paid";

  return (
    <div className="space-y-8">
      <PaymentsHistorySection />

      <div className="pt-4 border-t border-neutral-200">
        <h2 className="text-lg font-bold text-neutral-900">Look Up a Specific Payment</h2>
        <p className="text-sm text-neutral-500 mt-0.5">Paste a payment ID to waive or refund it directly.</p>
      </div>

      <Card>
        <CardContent className="p-5">
          <form onSubmit={handleLookup} className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-neutral-600 mb-1">Payment ID</label>
              <Input value={paymentId} onChange={(e) => setPaymentId(e.target.value)} placeholder="Paste a payment UUID…" />
            </div>
            <Button type="submit" disabled={loading}>
              <Search className="h-4 w-4 mr-1.5" />{loading ? "Looking up…" : "Look Up"}
            </Button>
          </form>
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-3">{error}</p>}
        </CardContent>
      </Card>

      {payment && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <Receipt className="h-5 w-5 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-neutral-900">{payment.currency} {payment.amount}</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[payment.status]}`}>{payment.status}</span>
              </div>
            </div>
            <div className="divide-y divide-neutral-100 border border-neutral-100 rounded-lg overflow-hidden text-sm">
              {payment.base_fee_amount != null && (
                <div className="flex items-center justify-between px-4 py-2.5"><span className="text-neutral-500">Base Fee</span><span className="text-neutral-800 font-medium">{payment.currency} {payment.base_fee_amount.toLocaleString("en-IN")}</span></div>
              )}
              {payment.platform_fee_amount != null && (
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-neutral-500">Platform &amp; Convenience Fee{payment.platform_fee_percent != null ? ` (${payment.platform_fee_percent}%)` : ""}</span>
                  <span className="text-neutral-800 font-medium">{payment.currency} {payment.platform_fee_amount.toLocaleString("en-IN")}</span>
                </div>
              )}
              <div className="flex items-center justify-between px-4 py-2.5"><span className="text-neutral-500">Payment Method</span><span className="text-neutral-800 font-medium">{payment.payment_method ?? "—"}</span></div>
              <div className="flex items-center justify-between px-4 py-2.5"><span className="text-neutral-500">Session ID</span><span className="text-neutral-800 font-medium">{payment.session_id ?? "—"}</span></div>
              <div className="flex items-center justify-between px-4 py-2.5"><span className="text-neutral-500">Order ID</span><span className="text-neutral-800 font-medium">{payment.order_id ?? "—"}</span></div>
              {payment.cancellation_refund_amount != null && (
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-neutral-500">Cancellation Refund Due</span>
                  <span className="text-neutral-800 font-medium">{payment.currency} {payment.cancellation_refund_amount.toLocaleString("en-IN")} ({payment.cancellation_refund_percent}%)</span>
                </div>
              )}
              {payment.waived_reason && (
                <div className="flex items-center justify-between px-4 py-2.5"><span className="text-neutral-500">Waived Reason</span><span className="text-neutral-800 font-medium">{payment.waived_reason}</span></div>
              )}
            </div>
            <div className="flex gap-2">
              {canWaive && (
                <Button onClick={() => setShowWaive(true)}>Waive Payment</Button>
              )}
              {canRefund && (
                <Button variant="outline" onClick={() => setShowRefund(true)}>Refund Payment</Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Modal isOpen={showWaive} onClose={() => setShowWaive(false)} title="Waive Payment">
        {payment && <WaiveModal payment={payment} onConfirm={handleWaive} onClose={() => setShowWaive(false)} />}
      </Modal>

      <Modal isOpen={showRefund} onClose={() => setShowRefund(false)} title="Refund Payment">
        {payment && <RefundModal payment={payment} onConfirm={handleRefund} onClose={() => setShowRefund(false)} />}
      </Modal>
    </div>
  );
}
