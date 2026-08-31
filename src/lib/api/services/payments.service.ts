import apiClient from "../client";

export interface Payment {
  payment_id: string;
  session_id: string | null;
  order_id: string | null;
  appointment_id: string | null;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "waived" | "refunded";
  payment_method: string | null;
  razorpay_order_id: string | null;
  waived_by: string | null;
  waived_reason: string | null;
  created_at: string;
  /** Snapshot at order-creation time — null on store-order payments (no fee
   * breakdown for those) and on any payment created before this existed. */
  base_fee_amount: number | null;
  platform_fee_percent: number | null;
  platform_fee_amount: number | null;
  /** Filled in only once the linked appointment has been cancelled. Not a
   * gateway refund — the amount owed, not money actually moved back yet. */
  cancellation_refund_percent: number | null;
  cancellation_refund_amount: number | null;
}

/** Response from creating a real Razorpay order — carries the public key the
 * frontend needs to open Razorpay Checkout. */
export interface PaymentOrder extends Payment {
  razorpay_key_id: string | null;
}

/** Resolved price for display before checkout starts — no order/payment row
 * exists yet at this point. */
export interface PaymentAmount {
  appointment_id: string;
  amount: number;
  currency: string;
  item_name: string;
  /** Consultation/session fee before the platform fee is added. */
  base_fee_amount: number;
  platform_fee_percent: number;
  platform_fee_amount: number;
}

/** /me/payments — carries the appointment's type/date so the billing-history
 * screen needs no per-row follow-up fetch. */
export interface PaymentHistory extends Payment {
  appointment_type: string | null;
  appointment_date: string | null;
}

/** /payments/history — one row per payment, pre-joined so the payments-
 * history screens (super/regional/clinic admin + receptionist) need no
 * per-row follow-up fetch to show who/what/where. */
export interface PaymentHistoryDetail extends Payment {
  patient_id: string | null;
  patient_name: string | null;
  effective_clinic_id: string | null;
  clinic_name: string | null;
  doctor_name: string | null;
  purpose: string | null;
  appointment_date: string | null;
  appointment_start_time: string | null;
  appointment_status: string | null;
  appointment_completed_at: string | null;
}

export type RevenueGroupBy = "day" | "week" | "month" | "year";

export interface RevenueSummaryPoint {
  period: string;
  total: number;
  payment_count: number;
}

/** One row per (period, purpose) — appointment_type (initial/follow_up/
 * protocol_followup/device_session) or a store order_type. */
export interface RevenueByPurposePoint {
  period: string;
  purpose: string;
  total: number;
  payment_count: number;
}

export interface PatientRevenueTotal {
  patient_id: string;
  patient_name: string | null;
  total_paid: number;
  payment_count: number;
}

export interface PaymentHistoryParams {
  status?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

/** core.payment_logs — one row per payment *event* (order created, webhook
 * received, client-verify attempt, staff status change), not per payment.
 * This is where a failed payment's actual reason lives — core.payments
 * itself only ever shows current state. */
export interface PaymentLog {
  log_id: string;
  payment_id: string;
  status: "pending" | "paid" | "failed" | "waived" | "refunded";
  amount: number;
  currency: string;
  payment_method: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  failure_code: string | null;
  failure_reason: string | null;
  source: "order_created" | "razorpay_webhook" | "client_verify" | "staff_action";
  gateway_event: string | null;
  gateway_response: Record<string, unknown>;
  changed_by: string | null;
  changed_by_role: string | null;
  created_at: string;
}

/** /payments/logs — cross-payment listing, pre-joined so a "show me failed
 * payments" screen needs no per-row follow-up fetch. */
export interface PaymentLogDetail extends PaymentLog {
  patient_name: string | null;
  clinic_name: string | null;
}

export interface PaymentLogsParams {
  status?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export const paymentsService = {
  get: async (id: string): Promise<Payment> => {
    const { data } = await apiClient.get(`/payments/${id}`);
    return data;
  },

  list: async (params: { clinic_id: string }): Promise<Payment[]> => {
    const { data } = await apiClient.get("/payments", { params });
    return Array.isArray(data) ? data : [];
  },

  waive: async (id: string, reason?: string): Promise<Payment> => {
    const { data } = await apiClient.patch(`/payments/${id}/status`, {
      status: "waived", payment_method: "waived", waived_reason: reason,
    });
    return data;
  },

  // Real checkout, three steps: resolve the price for display, create a
  // real Razorpay order, then the webhook (server-side, not this client)
  // is the only thing that ever marks a payment paid.
  getAmount: async (appointmentId: string): Promise<PaymentAmount> => {
    const { data } = await apiClient.get(`/appointments/${appointmentId}/payments/amount`);
    return data;
  },

  createOrder: async (appointmentId: string): Promise<PaymentOrder> => {
    const { data } = await apiClient.post(`/appointments/${appointmentId}/payments/order`);
    return data;
  },

  // Client-callback confirmation — Razorpay Checkout's success handler
  // hands the browser these fields; forwarded here for a server-side
  // signature check. Runs alongside the webhook, not instead of it: both
  // are idempotent, whichever lands first marks the payment paid.
  verifyPayment: async (
    paymentId: string,
    body: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
  ): Promise<Payment> => {
    const { data } = await apiClient.post(`/payments/${paymentId}/verify`, body);
    return data;
  },

  myList: async (): Promise<PaymentHistory[]> => {
    const { data } = await apiClient.get("/me/payments");
    return Array.isArray(data) ? data : [];
  },

  downloadReceipt: async (appointmentId: string): Promise<Blob> => {
    const { data } = await apiClient.get(`/appointments/${appointmentId}/payments/receipt`, { responseType: "blob" });
    return data;
  },

  refund: async (id: string, reason?: string): Promise<Payment> => {
    // payment_method intentionally omitted — the allowed enum
    // (cash/card/upi/bank_transfer/waived) has no "refunded" value, and
    // sending one would overwrite the record of how it was actually paid.
    const { data } = await apiClient.patch(`/payments/${id}/status`, {
      status: "refunded", waived_reason: reason,
    });
    return data;
  },

  // ─── Payments history / revenue (super_admin, regional_admin, clinic_admin,
  // receptionist) — scope is resolved server-side from the caller's role,
  // there's no clinic_id param to widen it from here. ───
  getHistory: async (params?: PaymentHistoryParams): Promise<PaymentHistoryDetail[]> => {
    const { data } = await apiClient.get("/payments/history", { params });
    return Array.isArray(data) ? data : [];
  },

  getRevenueSummary: async (params: { group_by: RevenueGroupBy; date_from?: string; date_to?: string }): Promise<RevenueSummaryPoint[]> => {
    const { data } = await apiClient.get("/payments/revenue-summary", { params });
    return Array.isArray(data) ? data : [];
  },

  getRevenueSummaryByPurpose: async (params: { group_by: RevenueGroupBy; date_from?: string; date_to?: string }): Promise<RevenueByPurposePoint[]> => {
    const { data } = await apiClient.get("/payments/revenue-summary-by-purpose", { params });
    return Array.isArray(data) ? data : [];
  },

  getPatientTotals: async (params?: { date_from?: string; date_to?: string; limit?: number }): Promise<PatientRevenueTotal[]> => {
    const { data } = await apiClient.get("/payments/patient-totals", { params });
    return Array.isArray(data) ? data : [];
  },

  getLogs: async (params?: PaymentLogsParams): Promise<PaymentLogDetail[]> => {
    const { data } = await apiClient.get("/payments/logs", { params });
    return Array.isArray(data) ? data : [];
  },

  getLogsForPayment: async (paymentId: string): Promise<PaymentLog[]> => {
    const { data } = await apiClient.get(`/payments/${paymentId}/logs`);
    return Array.isArray(data) ? data : [];
  },
};

export function saveBlobAsFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
