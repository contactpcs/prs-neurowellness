"use client";

import { useEffect, useState } from "react";
import { ShoppingBag, Plus, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/hooks";
import { Card, CardContent, Button, Skeleton, Modal, DetailFieldList, PageShell } from "@/components/ui";
import { adminService } from "@/lib/api/services/admin.service";
import { storeService, type Product, type StoreOrder, type CreateStoreOrderPayload } from "@/lib/api/services/store.service";
import type { AdminPatient } from "@/types/admin.types";

const STATUS_STYLES: Record<string, string> = {
  pending_doctor_approval: "bg-amber-100 text-amber-700",
  doctor_approved: "bg-blue-100 text-blue-700",
  pending_dispatch: "bg-amber-100 text-amber-700",
  dispatched_to_clinic: "bg-indigo-100 text-indigo-700",
  received_at_clinic: "bg-teal-100 text-teal-700",
  collected_by_patient: "bg-green-100 text-green-700",
  cancelled: "bg-neutral-200 text-neutral-600",
};

function OrdersSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <div className="bg-white rounded-xl border border-neutral-200/80 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-neutral-100 last:border-0">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function NewOrderForm({ clinicId, patients, products, onSubmit, onClose }: {
  clinicId: string;
  patients: AdminPatient[];
  products: Product[];
  onSubmit: (data: CreateStoreOrderPayload) => Promise<unknown>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ patient_id: "", order_type: "accessory" as "device" | "accessory", product_id: "", quantity: 1 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredProducts = products.filter((p) => p.category === form.order_type);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.patient_id) { setError("Select a patient"); return; }
    if (!form.product_id) { setError("Select a product"); return; }
    setLoading(true);
    setError(null);
    try {
      await onSubmit({
        patient_id: form.patient_id, clinic_id: clinicId, order_type: form.order_type,
        items: [{ product_id: form.product_id, quantity: form.quantity }],
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.detail || "Failed to create order");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Patient *</label>
        <select value={form.patient_id} onChange={(e) => setForm((p) => ({ ...p, patient_id: e.target.value }))} className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white">
          <option value="">Select patient…</option>
          {patients.map((p) => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Order Type *</label>
        <select
          value={form.order_type}
          onChange={(e) => setForm((p) => ({ ...p, order_type: e.target.value as "device" | "accessory", product_id: "" }))}
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white"
        >
          <option value="accessory">Accessory</option>
          <option value="device">Device</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Product *</label>
        <select value={form.product_id} onChange={(e) => setForm((p) => ({ ...p, product_id: e.target.value }))} className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white">
          <option value="">Select product…</option>
          {filteredProducts.map((p) => <option key={p.product_id} value={p.product_id}>{p.name} — {p.price}</option>)}
        </select>
        {filteredProducts.length === 0 && <p className="text-xs text-neutral-400 mt-1">No {form.order_type} products available.</p>}
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Quantity</label>
        <input type="number" min={1} value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: Number(e.target.value) || 1 }))}
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white" />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? "Submitting…" : "Create Order"}</Button>
      </div>
    </form>
  );
}

export default function ClinicAdminStoreOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [patients, setPatients] = useState<AdminPatient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [detailOrder, setDetailOrder] = useState<StoreOrder | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!user?.clinic_id) return;
    setError(null);
    try {
      const [ordersRes, patientsRes, productsRes] = await Promise.all([
        storeService.listOrders({ clinic_id: user.clinic_id }),
        adminService.getPatients({ clinic_id: user.clinic_id }),
        storeService.listProducts(),
      ]);
      setOrders(ordersRes);
      setPatients(patientsRes.patients);
      setProducts(productsRes);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Failed to load store orders");
    }
  }

  useEffect(() => { setIsLoading(true); load().finally(() => setIsLoading(false)); }, [user?.clinic_id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleRefresh() {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  }

  async function handleCreate(data: CreateStoreOrderPayload) {
    const created = await storeService.createOrder(data);
    setOrders((prev) => [created, ...prev]);
    return created;
  }

  const patientNameById = new Map(patients.map((p) => [p.id, `${p.first_name} ${p.last_name}`]));

  if (isLoading) return <OrdersSkeleton />;

  return (
    <PageShell
      title="Store Orders"
      root="Clinic Admin"
      actions={
        <>
          <button onClick={handleRefresh} disabled={refreshing} title="Refresh"
            className="p-2.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <Button onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1.5" />New Order</Button>
        </>
      }
    >
      <p className="text-sm text-neutral-500 -mt-3">{orders.length} order{orders.length !== 1 ? "s" : ""} for your clinic</p>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}

      <Card>
        {orders.length === 0 ? (
          <CardContent className="py-16 text-center">
            <ShoppingBag className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-600">No store orders yet</p>
          </CardContent>
        ) : (
          <div className="divide-y divide-neutral-100">
            {orders.map((o) => (
              <div key={o.order_id} className="flex items-center justify-between px-6 py-4 hover:bg-neutral-50/60 transition-colors cursor-pointer" onClick={() => setDetailOrder(o)}>
                <div>
                  <p className="text-sm font-medium text-neutral-900 capitalize underline decoration-dotted decoration-neutral-300 underline-offset-2">{o.order_type} order — {patientNameById.get(o.patient_id) ?? o.patient_id}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">{new Date(o.created_at).toLocaleDateString()}{o.total_amount != null && <> · {o.total_amount}</>}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[o.status] ?? "bg-neutral-100 text-neutral-600"}`}>
                  {o.status.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal isOpen={showNew} onClose={() => setShowNew(false)} title="New Store Order">
        {user?.clinic_id && (
          <NewOrderForm clinicId={user.clinic_id} patients={patients} products={products} onSubmit={handleCreate} onClose={() => setShowNew(false)} />
        )}
      </Modal>

      <Modal isOpen={!!detailOrder} onClose={() => setDetailOrder(null)} title="Store Order Details" className="max-w-3xl">
        {detailOrder && <DetailFieldList data={detailOrder} />}
      </Modal>
    </PageShell>
  );
}
