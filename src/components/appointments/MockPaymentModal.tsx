"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Lock, Loader2, CheckCircle2 } from "lucide-react";
import { Modal, Button } from "@/components/ui";
import { paymentsService, type Payment } from "@/lib/api/services/payments.service";

interface MockPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  /** Called once the payment is confirmed and the appointment has flipped to 'paid'. */
  onPaid: () => void;
}

type Stage = "loading" | "ready" | "processing" | "success" | "error";

/**
 * Dummy checkout screen styled like a real Razorpay panel — same two-step
 * shape (create order, then confirm) a real gateway integration would use,
 * so swapping in the real thing later doesn't change this component's
 * contract, only what confirmMockPayment does under the hood.
 */
export function MockPaymentModal({ isOpen, onClose, appointmentId, onPaid }: MockPaymentModalProps) {
  const [stage, setStage] = useState<Stage>("loading");
  const [order, setOrder] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStage("loading");
    setError(null);
    paymentsService
      .createMockOrder(appointmentId)
      .then((p) => {
        setOrder(p);
        setStage(p.status === "paid" ? "success" : "ready");
      })
      .catch((e) => {
        setError(e?.response?.data?.detail ?? "Could not start checkout");
        setStage("error");
      });
  }, [isOpen, appointmentId]);

  async function handlePay() {
    if (!order) return;
    setStage("processing");
    try {
      await paymentsService.confirmMockPayment(order.payment_id);
      setStage("success");
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Payment failed — please try again");
      setStage("error");
    }
  }

  function handleClose() {
    if (stage === "success") onPaid();
    onClose();
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-md">
      <div className="-mx-4 -my-3 sm:-mx-6 sm:-my-4 overflow-hidden rounded-xl">
        {/* Header, styled like a gateway checkout panel */}
        <div className="bg-brand-gradient px-6 py-5 text-white">
          <div className="flex items-center gap-2 text-sm font-medium opacity-90">
            <ShieldCheck className="h-4 w-4" />
            Secure Checkout
          </div>
          <div className="mt-1 text-lg font-semibold">Anava Clinic</div>
        </div>

        <div className="px-6 py-5">
          {stage === "loading" && (
            <div className="flex flex-col items-center gap-3 py-8 text-neutral-500">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Preparing your order…</span>
            </div>
          )}

          {stage === "error" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm text-danger-700">{error}</p>
              <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
            </div>
          )}

          {(stage === "ready" || stage === "processing") && order && (
            <>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-neutral-500">Amount payable</span>
                  <span className="text-2xl font-semibold text-neutral-900">
                    ₹{order.amount.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="mt-1 text-xs text-neutral-400">Order {order.razorpay_order_id}</div>
              </div>

              <Button
                variant="primary"
                className="mt-4 w-full"
                isLoading={stage === "processing"}
                onClick={handlePay}
              >
                {stage === "processing" ? "Processing…" : `Pay ₹${order.amount.toLocaleString("en-IN")}`}
              </Button>

              <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-neutral-400">
                <Lock className="h-3 w-3" />
                Payments are encrypted and secure
              </div>
            </>
          )}

          {stage === "success" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-success-500" />
              <div className="text-base font-semibold text-neutral-900">Payment Successful</div>
              <p className="text-sm text-neutral-500">Your appointment is confirmed.</p>
              <Button variant="primary" size="sm" className="mt-2" onClick={handleClose}>Done</Button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
