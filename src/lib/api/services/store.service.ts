import apiClient from "../client";

export interface Product {
  product_id: string;
  name: string;
  category: "device" | "accessory";
  price: number;
  sku: string | null;
  is_active: boolean;
}

export interface StoreOrder {
  order_id: string;
  patient_id: string;
  clinic_id: string;
  order_type: "device" | "accessory";
  status: string;
  total_amount: number | null;
  created_at: string;
}

export interface CreateStoreOrderPayload {
  patient_id: string;
  clinic_id: string;
  order_type: "device" | "accessory";
  items: { product_id: string; quantity: number }[];
}

export const storeService = {
  listProducts: async (category?: string): Promise<Product[]> => {
    const { data } = await apiClient.get("/products", { params: { category } });
    return Array.isArray(data) ? data : [];
  },

  listOrders: async (params: { clinic_id?: string; patient_id?: string; status?: string }): Promise<StoreOrder[]> => {
    const { data } = await apiClient.get("/store-orders", { params });
    return Array.isArray(data) ? data : [];
  },

  createOrder: async (payload: CreateStoreOrderPayload): Promise<StoreOrder> => {
    const { data } = await apiClient.post("/store-orders", payload);
    return data;
  },
};
