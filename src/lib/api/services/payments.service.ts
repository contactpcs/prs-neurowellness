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
};

export function saveBlobAsFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
