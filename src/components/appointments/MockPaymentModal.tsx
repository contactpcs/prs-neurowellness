"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Lock, Loader2, CheckCircle2, Download } from "lucide-react";
import { Modal, Button } from "@/components/ui";
import { appointmentsService } from "@/lib/api/services/appointments.service";
import type { Appointment } from "@/types/domain.types";
import {
  paymentsService,
  saveBlobAsFile,
  type PaymentAmount,
  type PaymentOrder,
} from "@/lib/api/services/payments.service";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (response: unknown) => void) => void;
    };
  }
}

let razorpayScriptPromise: Promise<void> | null = null;
function loadRazorpayScript(): Promise<void> {
  if (typeof window !== "undefined" && window.Razorpay) return Promise.resolve();
  if (!razorpayScriptPromise) {
    razorpayScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Could not load the payment gateway"));
      document.body.appendChild(script);
    });
  }
  return razorpayScriptPromise;
}

function fmt12(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function fmtDate(d: string): string {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

interface MockPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointmentId: string;
  /** Called once the payment is confirmed and the appointment has flipped to 'paid'. */
  onPaid: () => void;
}

type Stage = "loading" | "review" | "cancelling" | "ready" | "processing" | "confirming" | "success" | "error";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120000;

interface RazorpayCheckoutResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

/**
 * Review the appointment (patient/doctor/date/amount) before checkout, with
 * a way to back out via Cancel. Then real Razorpay checkout: resolve the
 * price from billable_items, create a real order, open Razorpay Checkout,
 * then poll for the webhook (server-side) to flip the payment to 'paid' —
 * this component never marks anything paid itself. After success, the
 * receipt is a real PDF pulled from the backend, not generated client-side.
 */
export function MockPaymentModal({ isOpen, onClose, appointmentId, onPaid }: MockPaymentModalProps) {
  const [stage, setStage] = useState<Stage>("loading");
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [priced, setPriced] = useState<PaymentAmount | null>(null);
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
  const pollHandle = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setStage("loading");
    setError(null);
    setOrder(null);
    setShowCancelForm(false);
    Promise.all([appointmentsService.getById(appointmentId), paymentsService.getAmount(appointmentId)])
      .then(([appointment, info]) => {
        setAppt(appointment);
        setPriced(info);
        setStage("review");
      })
      .catch((e) => {
        setError(e?.response?.data?.error?.message ?? "Could not load appointment details");
        setStage("error");
      });
  }, [isOpen, appointmentId]);

  useEffect(() => {
    return () => {
      if (pollHandle.current) clearInterval(pollHandle.current);
    };
  }, []);

  function pollUntilPaid(paymentId: string) {
    setStage("confirming");
    const startedAt = Date.now();
    pollHandle.current = setInterval(async () => {
      try {
        const payment = await paymentsService.get(paymentId);
        if (payment.status === "paid") {
          if (pollHandle.current) clearInterval(pollHandle.current);
          setStage("success");
          return;
        }
      } catch {
        // transient read failure — keep polling until the timeout below
      }
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        if (pollHandle.current) clearInterval(pollHandle.current);
        setError("Payment is still confirming — check your appointment status shortly.");
        setStage("error");
      }
    }, POLL_INTERVAL_MS);
  }

  async function handleCancelAppointment() {
    setStage("cancelling");
    setError(null);
    try {
      await appointmentsService.myCancel(appointmentId, cancelReason || "Cancelled by patient before payment");
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? "Could not cancel the appointment");
      setStage("error");
    }
  }

  async function handlePay() {
    if (!priced) return;
    setStage("processing");
    setError(null);
    try {
      await loadRazorpayScript();
      const created = await paymentsService.createOrder(appointmentId);
      setOrder(created);

      if (created.status === "paid") {
        setStage("success");
        return;
      }
      if (!created.razorpay_key_id || !created.razorpay_order_id) {
        throw new Error("Payment gateway is not configured yet — contact the clinic");
      }

      const checkout = new window.Razorpay({
        key: created.razorpay_key_id,
        order_id: created.razorpay_order_id,
        amount: Math.round(created.amount * 100),
        currency: created.currency,
        name: "Anava Clinic",
        description: priced.item_name,
        handler: (response: unknown) => {
          const r = response as RazorpayCheckoutResponse;
          paymentsService
            .verifyPayment(created.payment_id, {
              razorpay_order_id: r.razorpay_order_id,
              razorpay_payment_id: r.razorpay_payment_id,
              razorpay_signature: r.razorpay_signature,
            })
            .then((confirmed) => {
              if (confirmed.status === "paid") setStage("success");
              else pollUntilPaid(created.payment_id);
            })
            // Verify call itself failed (network blip, etc) — the webhook
            // may still land independently, fall back to polling instead
            // of surfacing a hard error for what could be a transient miss.
            .catch(() => pollUntilPaid(created.payment_id));
        },
        modal: { ondismiss: () => setStage("ready") },
        theme: { color: "#0f172a" },
      });
      checkout.on("payment.failed", () => {
        setError("Payment failed — please try again");
        setStage("error");
      });
      checkout.open();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? e?.message ?? "Could not start checkout");
      setStage("error");
    }
  }

  async function handleDownloadReceipt() {
    setDownloadingReceipt(true);
    try {
      const blob = await paymentsService.downloadReceipt(appointmentId);
      saveBlobAsFile(blob, `receipt-${appointmentId}.pdf`);
    } catch {
      setError("Could not download the receipt — try again from Payments & Bills.");
    } finally {
      setDownloadingReceipt(false);
    }
  }

  function handleClose() {
    if (stage === "success") onPaid();
    if (pollHandle.current) clearInterval(pollHandle.current);
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
              <span className="text-sm">Loading appointment details…</span>
            </div>
          )}

          {stage === "error" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <p className="text-sm text-danger-700">{error}</p>
              <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
            </div>
          )}

          {stage === "review" && appt && priced && !showCancelForm && (
            <>
              <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg overflow-hidden text-sm">
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-neutral-500">Patient</span>
                  <span className="text-neutral-800 font-medium">{appt.patient_name ?? "—"}</span>
                </div>
                {appt.doctor_name && (
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-neutral-500">Doctor</span>
                    <span className="text-neutral-800 font-medium">{appt.doctor_name}</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-neutral-500">Date &amp; Time</span>
                  <span className="text-neutral-800 font-medium">
                    {fmtDate(appt.appointment_date)} · {fmt12(appt.start_time)}
                  </span>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-neutral-500">{priced.item_name}</span>
                  <span className="text-neutral-900 font-semibold">
                    ₹{priced.amount.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowCancelForm(true)}>
                  Cancel Appointment
                </Button>
                <Button variant="primary" className="flex-1" onClick={() => setStage("ready")}>
                  Proceed to Pay
                </Button>
              </div>
            </>
          )}

          {stage === "review" && showCancelForm && (
            <div className="space-y-3">
              <p className="text-sm text-neutral-700">Cancel this appointment before paying?</p>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason (optional)"
                rows={3}
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowCancelForm(false)}>Back</Button>
                <Button size="sm" onClick={handleCancelAppointment}>Confirm Cancel</Button>
              </div>
            </div>
          )}

          {stage === "cancelling" && (
            <div className="flex flex-col items-center gap-3 py-8 text-neutral-500">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Cancelling…</span>
            </div>
          )}

          {(stage === "ready" || stage === "processing") && priced && (
            <>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-neutral-500">{priced.item_name}</span>
                  <span className="text-2xl font-semibold text-neutral-900">
                    ₹{priced.amount.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="mt-1 text-xs text-neutral-400">{priced.currency}</div>
              </div>

              <Button
                variant="primary"
                className="mt-4 w-full"
                isLoading={stage === "processing"}
                onClick={handlePay}
              >
                {stage === "processing" ? "Opening checkout…" : `Pay ₹${priced.amount.toLocaleString("en-IN")}`}
              </Button>

              <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-neutral-400">
                <Lock className="h-3 w-3" />
                Payments are encrypted and secure
              </div>
            </>
          )}

          {stage === "confirming" && (
            <div className="flex flex-col items-center gap-3 py-8 text-neutral-500">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="text-sm">Confirming your payment…</span>
            </div>
          )}

          {stage === "success" && (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 className="h-10 w-10 text-success-500" />
              <div className="text-base font-semibold text-neutral-900">Payment Successful</div>
              <p className="text-sm text-neutral-500">Your appointment is confirmed.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                isLoading={downloadingReceipt}
                onClick={handleDownloadReceipt}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download Receipt
              </Button>
              <Button variant="primary" size="sm" onClick={handleClose}>Done</Button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
