"use client";

import { Check, X } from "lucide-react";
import type { Payment } from "@/lib/api/services/payments.service";

type StepState = "done" | "current" | "failed" | "upcoming";

interface Step {
  label: string;
  detail?: string | null;
  at?: string | null;
  state: StepState;
}

function fmtWhen(iso?: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });
}

/** Refund stages for one payment, from the backend's own fields:
 *   approved   refund_requested_at  (cancellation approved a refund)
 *   sent       refund_initiated_at  (online: refund created at Razorpay)
 *              — cash: handed back at the clinic counter instead
 *   refunded   refunded_at          (refund_status = processed)
 * A failed Razorpay refund stops at step 2 in red. */
function stepsFor(p: Payment, audience: "patient" | "staff"): Step[] {
  const online = (p.payment_method ?? "").startsWith("razorpay");
  const amount = `${p.currency} ${(p.cancellation_refund_amount ?? 0).toLocaleString("en-IN")}`;
  const processed = p.refund_status === "processed";
  const failed = p.refund_status === "failed";
  const patient = audience === "patient";

  const approved: Step = {
    label: "Refund approved",
    detail: p.cancellation_refund_percent != null ? `${amount} (${p.cancellation_refund_percent}%)` : amount,
    at: p.refund_requested_at,
    state: "done",
  };

  let middle: Step;
  if (online) {
    const sent = !!p.refund_initiated_at || processed;
    middle = {
      label: patient ? "Sent to your bank" : "Sent via Razorpay",
      detail: failed
        ? patient
          ? "Automatic refund failed — the clinic will refund you directly"
          : "Razorpay refused it — refund by hand, then confirm"
        : p.razorpay_refund_id
        ? `Ref ${p.razorpay_refund_id}`
        : sent ? null : "Starting shortly",
      at: p.refund_initiated_at,
      state: failed ? "failed" : sent ? "done" : "current",
    };
  } else {
    middle = {
      label: patient ? "Collect at the clinic" : "Hand back at counter",
      detail: processed ? null : patient ? "Ask at the front desk" : "Confirm once handed back",
      state: processed ? "done" : failed ? "failed" : "current",
    };
  }

  const done: Step = {
    label: "Refunded",
    detail: processed && online ? (patient ? "Banks can take 5–7 working days to show it" : null) : null,
    at: p.refunded_at,
    state: processed ? "done" : "upcoming",
  };
  return [approved, middle, done];
}

const DOT: Record<StepState, string> = {
  done: "bg-green-600 text-white border-green-600",
  current: "bg-white text-amber-600 border-amber-500",
  failed: "bg-red-600 text-white border-red-600",
  upcoming: "bg-white text-neutral-300 border-neutral-300",
};

const LINE: Record<StepState, string> = {
  done: "bg-green-600",
  current: "bg-neutral-200",
  failed: "bg-neutral-200",
  upcoming: "bg-neutral-200",
};

/** Horizontal refund tracker. Renders nothing when no refund is owed. A
 * cancellation too close to the visit (0 %) shows a one-line note instead. */
export function RefundProgress({
  payment,
  audience,
  compact = false,
}: {
  payment: Payment;
  audience: "patient" | "staff";
  compact?: boolean;
}) {
  if (payment.cancellation_refund_amount == null) return null;
  if (!payment.refund_status) {
    return (
      <p className="text-xs text-neutral-500">
        {audience === "patient" ? "Cancelled too close to the appointment for a refund." : "Cancelled inside the no-refund window — nothing owed."}
      </p>
    );
  }

  const steps = stepsFor(payment, audience);
  return (
    <div className={`flex items-start ${compact ? "gap-1" : "gap-2"}`} aria-label="Refund progress">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-start flex-1 min-w-0">
          <div className="flex flex-col items-center flex-shrink-0">
            <span
              className={`flex items-center justify-center rounded-full border-2 ${DOT[step.state]} ${compact ? "w-4 h-4" : "w-6 h-6"}`}
              aria-hidden
            >
              {step.state === "done" && <Check className={compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} strokeWidth={3} />}
              {step.state === "failed" && <X className={compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5"} strokeWidth={3} />}
              {step.state === "current" && <span className={`rounded-full bg-amber-500 animate-pulse ${compact ? "w-1.5 h-1.5" : "w-2 h-2"}`} />}
            </span>
          </div>
          <div className={`min-w-0 ${compact ? "ml-1" : "ml-2"} flex-1`}>
            <p className={`font-medium truncate ${compact ? "text-[10px]" : "text-xs"} ${step.state === "upcoming" ? "text-neutral-400" : step.state === "failed" ? "text-red-600" : "text-neutral-800"}`}>
              {step.label}
            </p>
            {!compact && step.detail && (
              <p className={`text-[11px] leading-snug ${step.state === "failed" ? "text-red-600" : "text-neutral-500"} break-words`}>{step.detail}</p>
            )}
            {fmtWhen(step.at) && <p className={`text-neutral-400 ${compact ? "text-[9px]" : "text-[10px]"}`}>{fmtWhen(step.at)}</p>}
          </div>
          {i < steps.length - 1 && <span className={`h-0.5 flex-1 mt-2 mx-1 rounded ${LINE[step.state]} ${compact ? "min-w-[8px]" : "min-w-[16px]"}`} />}
        </div>
      ))}
    </div>
  );
}
