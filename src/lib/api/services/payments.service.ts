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

  // Dummy checkout — same two-step shape a real gateway would have, so this
  // can be swapped for a real Razorpay flow later without the checkout
  // screen changing shape. Step 1 creates (or resumes) an order; step 2 is
  // the "Pay Now" click.
  createMockOrder: async (appointmentId: string): Promise<Payment> => {
    const { data } = await apiClient.post(`/appointments/${appointmentId}/payments/mock-order`);
    return data;
  },

  confirmMockPayment: async (paymentId: string): Promise<Payment> => {
    const { data } = await apiClient.post(`/payments/${paymentId}/mock-confirm`);
    return data;
  },
};
