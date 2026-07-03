import apiClient from "../client";

export interface Payment {
  payment_id: string;
  session_id: string | null;
  order_id: string | null;
  amount: number;
  currency: string;
  status: "pending" | "paid" | "failed" | "waived" | "refunded";
  payment_method: string | null;
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
};
