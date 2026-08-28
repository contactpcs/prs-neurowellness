"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, RefreshCw, Mail, Phone, Building2, Power, PowerOff, X } from "lucide-react";
import { useAdminAccounts } from "@/lib/hooks";
import { Card, CardContent, Skeleton, Modal, DetailFieldList, PageShell } from "@/components/ui";
import type { AdminAccount } from "@/types/admin.types";

function ClinicAdminsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <div className="bg-white rounded-xl border border-neutral-200/80 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
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

export default function RegionalAdminClinicAdminsPage() {
  // Backend clamps this list to the caller's own region regardless of any
  // region_id passed — see admin/router.py::list_admins — so this is
  // already scoped, no client-side filtering needed.
  const { admins, isLoading, error, fetch, updateAdmin } = useAdminAccounts();
  const [viewAdmin, setViewAdmin] = useState<AdminAccount | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => { fetch({ admin_type: "clinic_admin" }); }, [fetch]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await fetch({ admin_type: "clinic_admin" }); } finally { setRefreshing(false); }
  }

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

  const initials = (a: AdminAccount) => [a.first_name?.[0], a.last_name?.[0]].filter(Boolean).join("").toUpperCase() || "?";

  if (isLoading) return <ClinicAdminsSkeleton />;

  return (
    <PageShell
      title="Clinic Admins"
      root="Regional Admin"
      actions={
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          title="Refresh"
          className="p-2.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      }
    >
      <p className="text-sm text-neutral-500 -mt-4">{admins.length} clinic admin{admins.length !== 1 ? "s" : ""} in your region</p>

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
            <p className="text-sm font-medium text-neutral-600">No clinic admins found</p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Admin</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Clinic</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Onboarding</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {admins.map((admin) => (
                  <tr key={admin.admin_id} className="hover:bg-neutral-50/60 transition-colors">
                    <td className="px-6 py-3.5">
                      <button onClick={() => setViewAdmin(admin)} className="flex items-center gap-3 text-left hover:opacity-75 transition-opacity">
                        <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-semibold text-xs flex-shrink-0">
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
                      <span className="flex items-center gap-1.5 text-xs text-neutral-600">
                        <Building2 className="h-3.5 w-3.5 text-neutral-400" />{admin.clinic_name ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        admin.is_active ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                      }`}>
                        {admin.is_active ? "Active" : "Pending Consent"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal isOpen={!!viewAdmin} onClose={() => setViewAdmin(null)} title="Clinic Admin Details" className="max-w-3xl">
        {viewAdmin && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-semibold flex-shrink-0">
                {initials(viewAdmin)}
              </div>
              <div>
                <p className="font-semibold text-neutral-900">{viewAdmin.first_name} {viewAdmin.last_name}</p>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  viewAdmin.is_active ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                }`}>
                  {viewAdmin.is_active ? "Onboarding complete" : "Pending consent — not yet active"}
                </span>
              </div>
            </div>
            <DetailFieldList data={viewAdmin} />
          </div>
        )}
      </Modal>
    </PageShell>
  );
}
