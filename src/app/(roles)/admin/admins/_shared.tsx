"use client";

import { useState } from "react";
import { ShieldCheck, RefreshCw, X, Mail, Phone, MapPin, Building2, Edit2, Power, PowerOff } from "lucide-react";
import { Card, CardContent, Button, Input, Skeleton, Modal, DetailFieldList, PageShell } from "@/components/ui";
import type { AdminAccount } from "@/types/admin.types";

export const TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  super_admin: { bg: "bg-rose-100", text: "text-rose-700", label: "Super Admin" },
  regional_admin: { bg: "bg-blue-100", text: "text-blue-700", label: "Regional Admin" },
  clinic_admin: { bg: "bg-purple-100", text: "text-purple-700", label: "Clinic Admin" },
};

export function AdminsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="bg-white rounded-xl border border-neutral-200/80 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-neutral-100 last:border-0">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EditAdminForm({ admin, onSubmit, onClose }: {
  admin: AdminAccount;
  onSubmit: (data: { first_name?: string; last_name?: string; email?: string; phone?: string }) => Promise<unknown>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({ first_name: admin.first_name, last_name: admin.last_name, email: admin.email, phone: admin.phone ?? "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) { setError("First name, last name, and email are required"); return; }
    setLoading(true);
    setError(null);
    try {
      await onSubmit(form);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.detail || "Failed to update admin");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">First Name *</label>
          <Input value={form.first_name} onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Last Name *</label>
          <Input value={form.last_name} onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))} required />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Email *</label>
        <Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required />
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Phone</label>
        <Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? "Saving…" : "Save Changes"}</Button>
      </div>
    </form>
  );
}

/** Single-type admin list (regional-only or clinic-only) — the "all admins,
 * one table with a Type column" shape moved to two scoped pages, each of
 * which already knows its own type from the route, so the Type column
 * (redundant once the page title says which type) is dropped here. */
export function AdminAccountsSection({
  title, subtitle, admins, isLoading, error, refreshing, onRefresh, updateAdmin, headerAction, emptyLabel,
}: {
  title: string;
  subtitle: string;
  admins: AdminAccount[];
  isLoading: boolean;
  error: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  updateAdmin: (id: string, data: { first_name?: string; last_name?: string; email?: string; phone?: string; is_active?: boolean }) => Promise<unknown>;
  headerAction?: React.ReactNode;
  emptyLabel: string;
}) {
  const [viewAdmin, setViewAdmin] = useState<AdminAccount | null>(null);
  const [editAdmin, setEditAdmin] = useState<AdminAccount | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const initials = (a: AdminAccount) => [a.first_name?.[0], a.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "?";

  async function handleToggle(admin: AdminAccount) {
    setTogglingId(admin.admin_id);
    setActionError(null);
    try {
      await updateAdmin(admin.admin_id, { is_active: !admin.is_active });
    } catch (e: any) {
      setActionError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Failed to update admin status");
    } finally {
      setTogglingId(null);
    }
  }

  if (isLoading) return <AdminsSkeleton />;

  return (
    <PageShell
      title={title}
      root="Admin"
      actions={
        <>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            title="Refresh"
            className="p-2.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          {headerAction}
        </>
      }
    >
      <p className="text-sm text-neutral-500 -mt-3">{subtitle}</p>

      {(error || actionError) && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center justify-between">
          <span>{error || actionError}</span>
          <button onClick={() => setActionError(null)}><X className="h-4 w-4" /></button>
        </div>
      )}

      <Card>
        {admins.length === 0 ? (
          <CardContent className="py-16 text-center">
            <ShieldCheck className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-600">{emptyLabel}</p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Admin</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Scope</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Status</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {admins.map((admin) => (
                  <tr key={admin.admin_id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="px-6 py-3.5">
                      <button onClick={() => setViewAdmin(admin)} className="flex items-center gap-3 text-left hover:opacity-75 transition-opacity">
                        <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-xs flex-shrink-0">
                          {initials(admin)}
                        </div>
                        <div>
                          <p className="font-medium text-neutral-900 underline decoration-dotted decoration-neutral-300 underline-offset-2">{admin.first_name} {admin.last_name}</p>
                          <p className="text-xs text-neutral-500 flex items-center gap-1 mt-0.5">
                            <Mail className="h-3 w-3" />{admin.email}
                          </p>
                          {admin.phone && (
                            <p className="text-xs text-neutral-400 flex items-center gap-1">
                              <Phone className="h-3 w-3" />{admin.phone}
                            </p>
                          )}
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5 text-xs text-neutral-600">
                        {admin.region_name && (
                          <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-neutral-400" />{admin.region_name}</span>
                        )}
                        {admin.clinic_name && (
                          <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5 text-neutral-400" />{admin.clinic_name}</span>
                        )}
                        {!admin.region_name && !admin.clinic_name && "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        admin.is_active ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-500"
                      }`}>
                        {admin.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setEditAdmin(admin)}
                          title="Edit"
                          className="p-1.5 text-neutral-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleToggle(admin)}
                          disabled={togglingId === admin.admin_id}
                          title={admin.is_active ? "Deactivate" : "Reactivate"}
                          className={`p-1.5 rounded-lg transition-colors ${
                            admin.is_active
                              ? "text-amber-500 hover:text-amber-700 hover:bg-amber-50"
                              : "text-green-500 hover:text-green-700 hover:bg-green-50"
                          }`}
                        >
                          {admin.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={!!viewAdmin} onClose={() => setViewAdmin(null)} title="Admin Details" className="max-w-3xl">
        {viewAdmin && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold flex-shrink-0">
                {initials(viewAdmin)}
              </div>
              <div>
                <p className="font-semibold text-neutral-900">{viewAdmin.first_name} {viewAdmin.last_name}</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${TYPE_STYLES[viewAdmin.admin_type].bg} ${TYPE_STYLES[viewAdmin.admin_type].text}`}>
                  {TYPE_STYLES[viewAdmin.admin_type].label}
                </span>
              </div>
            </div>
            <DetailFieldList data={viewAdmin} />
          </div>
        )}
      </Modal>

      <Modal isOpen={!!editAdmin} onClose={() => setEditAdmin(null)} title="Edit Admin">
        {editAdmin && (
          <EditAdminForm
            admin={editAdmin}
            onSubmit={(data) => updateAdmin(editAdmin.admin_id, data)}
            onClose={() => setEditAdmin(null)}
          />
        )}
      </Modal>
    </PageShell>
  );
}
