"use client";

import { useEffect, useRef, useState } from "react";
import { Banknote, Smartphone, CreditCard, Loader2, CheckCircle2, Download, Lock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui";
import { appointmentsService } from "@/lib/api/services/appointments.service";
import { paymentsService, saveBlobAsFile, type PaymentAmount } from "@/lib/api/services/payments.service";
import { loadRazorpayScript } from "@/components/appointments/MockPaymentModal";
import type { Appointment } from "@/types/domain.types";

type Method = "cash" | "upi" | "card";
type Stage = "loading" | "choose" | "cash_confirm" | "processing" | "confirming" | "success" | "error";

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120000;

interface RazorpayCheckoutResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

function fmt12(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function fmtDate(d: string): string {
  return d ? new Date(d + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" }) : "";
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

const METHODS: { value: Method; label: string; hint: string; icon: typeof Banknote }[] = [
  { value: "cash", label: "Cash",  hint: "Collected at the counter", icon: Banknote },
  { value: "upi",  label: "UPI",   hint: "Pay via Razorpay",          icon: Smartphone },
  { value: "card", label: "Card",  hint: "Debit / credit via Razorpay", icon: CreditCard },
];

/**
 * Front-desk checkout for one appointment awaiting payment. Cash is
 * recorded straight to the backend (POST .../payments/cash); UPI and card go
 * through the same Razorpay flow the patient app uses — real order, Razorpay
 * Checkout, signature-verified confirm racing the webhook, poll as fallback.
 * Nothing here marks a payment paid on its own say-so.
 */
export function StaffPaymentPanel({
  appointmentId, onDone, onCancel,
}: {
  appointmentId: string;
  /** Payment settled (or already was) — parent refreshes/closes. */
  onDone: () => void;
  /** Leave without paying — the appointment stays Awaiting Payment. */
  onCancel: () => void;
}) {
  const [stage, setStage] = useState<Stage>("loading");
  const [appt, setAppt] = useState<Appointment | null>(null);
  const [priced, setPriced] = useState<PaymentAmount | null>(null);
  const [method, setMethod] = useState<Method>("cash");
  const [paidVia, setPaidVia] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const pollHandle = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStage("loading");
    Promise.all([appointmentsService.getById(appointmentId), paymentsService.getAmount(appointmentId)])
      .then(([a, p]) => {
        if (cancelled) return;
        setAppt(a);
        setPriced(p);
        setStage(a.status === "paid" ? "success" : "choose");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e?.response?.data?.error?.message ?? "Could not load the amount for this appointment");
        setStage("error");
      });
    return () => { cancelled = true; };
  }, [appointmentId]);

  useEffect(() => () => { if (pollHandle.current) clearInterval(pollHandle.current); }, []);

  const failBackToChoose = (msg: string) => {
    if (pollHandle.current) clearInterval(pollHandle.current);
    setError(msg);
    setStage("choose");
  };

  async function failureReason(paymentId: string): Promise<string> {
    try {
      const logs = await paymentsService.getLogsForPayment(paymentId);
      const f = logs.filter((l) => l.status === "failed" && l.failure_reason).pop();
      if (f?.failure_reason) return f.failure_reason;
    } catch { /* generic below */ }
    return "Payment failed — try again or choose another method.";
  }

  function pollUntilPaid(paymentId: string) {
    setStage("confirming");
    const startedAt = Date.now();
    pollHandle.current = setInterval(async () => {
      try {
        const p = await paymentsService.get(paymentId);
        if (p.status === "paid") {
          if (pollHandle.current) clearInterval(pollHandle.current);
          setStage("success");
          return;
        }
        if (p.status === "failed") {
          failBackToChoose(await failureReason(paymentId));
          return;
        }
      } catch { /* transient — keep polling */ }
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        if (pollHandle.current) clearInterval(pollHandle.current);
        setError("Payment is still confirming — check the appointment's status on the Appointments page shortly.");
        setStage("error");
      }
    }, POLL_INTERVAL_MS);
  }

  async function payCash() {
    setStage("processing");
    setError(null);
    try {
      await paymentsService.recordCash(appointmentId);
      setPaidVia("Cash");
      setStage("success");
    } catch (e: any) {
      failBackToChoose(e?.response?.data?.error?.message ?? "Could not record the cash payment");
    }
  }

  async function payOnline(m: Exclude<Method, "cash">) {
    if (!priced) return;
    setStage("processing");
    setError(null);
    try {
      await loadRazorpayScript();
      const order = await paymentsService.createOrder(appointmentId);
      if (order.status === "paid") { setPaidVia(m.toUpperCase()); setStage("success"); return; }
      if (!order.razorpay_key_id || !order.razorpay_order_id) {
        throw new Error("Online payment gateway is not configured — collect cash or contact the clinic admin");
      }
      const checkout = new window.Razorpay({
        key: order.razorpay_key_id,
        order_id: order.razorpay_order_id,
        amount: Math.round(order.amount * 100),
        currency: order.currency,
        name: "Anava Clinic",
        description: priced.item_name,
        // Opens Checkout on the method the receptionist picked; the patient
        // can still switch inside Razorpay.
        prefill: { method: m },
        handler: (response: unknown) => {
          const r = response as RazorpayCheckoutResponse;
          setPaidVia(m.toUpperCase());
          paymentsService
            .verifyPayment(order.payment_id, {
              razorpay_order_id: r.razorpay_order_id,
              razorpay_payment_id: r.razorpay_payment_id,
              razorpay_signature: r.razorpay_signature,
            })
            .then((p) => (p.status === "paid" ? setStage("success") : pollUntilPaid(order.payment_id)))
            .catch(() => pollUntilPaid(order.payment_id));
        },
        modal: {
          // Closing Checkout: the webhook may already have settled it.
          ondismiss: async () => {
            try {
              const p = await paymentsService.get(order.payment_id);
              if (p.status === "paid") { setPaidVia(m.toUpperCase()); setStage("success"); return; }
              if (p.status === "failed") { failBackToChoose(await failureReason(order.payment_id)); return; }
            } catch { /* fall through */ }
            setStage("choose");
          },
        },
        theme: { color: "#0f172a" },
      });
      checkout.on("payment.failed", async () => failBackToChoose(await failureReason(order.payment_id)));
      checkout.open();
    } catch (e: any) {
      failBackToChoose(e?.response?.data?.error?.message ?? e?.message ?? "Could not start online payment");
    }
  }

  const proceed = () => (method === "cash" ? setStage("cash_confirm") : payOnline(method));

  async function downloadReceipt() {
    setDownloading(true);
    try {
      saveBlobAsFile(await paymentsService.downloadReceipt(appointmentId), `receipt-${appointmentId}.pdf`);
    } catch {
      setError("Could not download the receipt — try again from the Appointments page.");
    } finally {
      setDownloading(false);
    }
  }

  if (stage === "loading") {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-neutral-500">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm">Loading amount…</span>
      </div>
    );
  }

  if (stage === "error") {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-danger-700">{error}</p>
        <Button variant="outline" size="sm" onClick={onCancel}>Close</Button>
      </div>
    );
  }

  if (stage === "success") {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-success-500" />
        <div className="text-base font-semibold text-neutral-900">Payment received</div>
        <p className="text-sm text-neutral-500">
          {priced ? `${inr(priced.amount)} ` : ""}{paidVia ? `via ${paidVia}` : ""} — the appointment is confirmed.
        </p>
        {error && <p className="text-xs text-danger-600">{error}</p>}
        <div className="flex gap-2 mt-1">
          <Button variant="outline" size="sm" isLoading={downloading} onClick={downloadReceipt}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Receipt
          </Button>
          <Button variant="primary" size="sm" onClick={onDone}>Done</Button>
        </div>
      </div>
    );
  }

  if (stage === "processing" || stage === "confirming") {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-neutral-500">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm">
          {stage === "confirming" ? "Confirming payment…" : method === "cash" ? "Recording cash payment…" : "Opening Razorpay…"}
        </span>
      </div>
    );
  }

  // choose / cash_confirm
  return (
    <div className="space-y-4">
      {appt && priced && (
        <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg overflow-hidden text-sm">
          <Row label="Patient" value={appt.patient_name ?? "—"} />
          <Row
            label={appt.appointment_type === "device_session" ? "Device" : "Doctor"}
            value={appt.appointment_type === "device_session" ? (appt.device_name ?? "—") : appt.doctor_name ? `Dr. ${appt.doctor_name}` : "—"}
          />
          <Row label="Date & Time" value={`${fmtDate(appt.appointment_date)} · ${fmt12(appt.start_time)}`} />
          <Row label={priced.item_name} value={inr(priced.base_fee_amount)} />
          {priced.platform_fee_amount > 0 && (
            <Row label={`Platform fee (${priced.platform_fee_percent}%)`} value={inr(priced.platform_fee_amount)} />
          )}
          <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-50">
            <span className="text-neutral-600 font-medium">Total</span>
            <span className="text-neutral-900 font-semibold">{inr(priced.amount)}</span>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

      {stage === "cash_confirm" && priced ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Confirm you have received <strong>{inr(priced.amount)}</strong> in cash from the patient.
          </div>
          <div className="flex justify-between gap-2">
            <Button variant="outline" size="sm" onClick={() => setStage("choose")}>
              <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Back
            </Button>
            <Button variant="primary" size="sm" onClick={payCash}>Cash received — confirm</Button>
          </div>
        </div>
      ) : (
        <>
          <div>
            <p className="block text-xs font-medium text-neutral-700 mb-1.5">Payment method</p>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map(({ value, label, hint, icon: Icon }) => {
                const active = method === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setMethod(value); setError(null); }}
                    className={`flex flex-col items-center gap-1 rounded-lg border px-2 py-3 transition-colors ${
                      active ? "border-primary-500 bg-primary-50 ring-2 ring-primary-500/20" : "border-neutral-200 hover:bg-neutral-50"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${active ? "text-primary-600" : "text-neutral-500"}`} />
                    <span className={`text-sm font-semibold ${active ? "text-primary-700" : "text-neutral-800"}`}>{label}</span>
                    <span className="text-[10px] text-neutral-400 text-center leading-tight">{hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-100">
            <button onClick={onCancel} className="text-xs text-neutral-500 hover:text-neutral-700 hover:underline">
              Pay later (stays Awaiting Payment)
            </button>
            <Button variant="primary" size="sm" onClick={proceed} disabled={!priced}>
              {method === "cash" ? "Record cash payment" : `Pay ${priced ? inr(priced.amount) : ""} via ${method.toUpperCase()}`}
            </Button>
          </div>
          {method !== "cash" && (
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-neutral-400">
              <Lock className="h-3 w-3" /> Opens Razorpay secure checkout
            </p>
          )}
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 gap-4">
      <span className="text-neutral-500">{label}</span>
      <span className="text-neutral-800 font-medium text-right">{value}</span>
    </div>
  );
}
