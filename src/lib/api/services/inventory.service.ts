import apiClient from "../client";

export interface InventoryItem {
  inventory_id: string;
  product_id: string;
  clinic_id: string;
  quantity: number;
  updated_at: string;
}

export const inventoryService = {
  list: async (params: { clinic_id: string }): Promise<InventoryItem[]> => {
    const { data } = await apiClient.get("/inventory", { params });
    return Array.isArray(data) ? data : [];
  },
};
