"use client";

import { useEffect, useState } from "react";
import { ClipboardList, Check, X, RefreshCw } from "lucide-react";
import { useClinicRequests, useAdminRegions, useAdminClinics } from "@/lib/hooks";
import { Card, CardContent, Button, Skeleton, Modal, DetailFieldList, PageShell } from "@/components/ui";
import type { ClinicRequest } from "@/lib/api/services/clinicRequests.service";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
  withdrawn: "bg-neutral-200 text-neutral-600",
};

const REQUEST_TYPE_LABELS: Record<string, string> = {
  create_clinic: "Create Clinic",
  close_clinic: "Close Clinic",
  change_admin: "Change Clinic Admin",
  change_main_branch: "Change Main Branch",
};

function ClinicRequestsSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <div className="bg-white rounded-xl border border-neutral-200/80 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-neutral-100 last:border-0">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DecisionModal({ request, decision, onConfirm, onClose }: {
  request: ClinicRequest;
  decision: "approved" | "rejected";
  onConfirm: (notes?: string) => Promise<void>;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setLoading(true);
    setError(null);
    try {
      await onConfirm(notes || undefined);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.detail || "Failed to submit decision");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-700">
        {decision === "approved" ? "Approve" : "Reject"} the <strong>{REQUEST_TYPE_LABELS[request.request_type]}</strong> request?
      </p>
      {decision === "approved" && request.request_type === "create_clinic" && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
          Approving does not create the clinic automatically — go to Clinics afterward to create it using these details.
        </p>
      )}
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Review Notes {decision === "rejected" ? "" : "(optional)"}</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="button" disabled={loading} variant={decision === "approved" ? "primary" : "danger"} onClick={confirm}>
          {loading ? "Submitting…" : decision === "approved" ? "Approve" : "Reject"}
        </Button>
      </div>
    </div>
  );
}

export default function AdminClinicRequestsPage() {
  const { requests, isLoading, error, fetch, decideRequest } = useClinicRequests();
  const { regions, fetch: fetchRegions } = useAdminRegions();
  const { clinics, fetch: fetchClinics } = useAdminClinics();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [decisionTarget, setDecisionTarget] = useState<{ request: ClinicRequest; decision: "approved" | "rejected" } | null>(null);
  const [detailRequest, setDetailRequest] = useState<ClinicRequest | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetch(statusFilter === "all" ? undefined : { status: statusFilter });
    fetchRegions();
    fetchClinics();
  }, [fetch, fetchRegions, fetchClinics, statusFilter]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await Promise.all([fetch(statusFilter === "all" ? undefined : { status: statusFilter }), fetchRegions(), fetchClinics()]); } finally { setRefreshing(false); }
  }

  const regionNameById = new Map(regions.map((r) => [r.region_id, r.region_name]));
  const clinicNameById = new Map(clinics.map((c) => [c.clinic_id, c.clinic_name]));

  if (isLoading) return <ClinicRequestsSkeleton />;

  return (
    <PageShell
      title="Clinic Requests"
      root="Admin"
      actions={
        <>
          <button onClick={handleRefresh} disabled={refreshing} title="Refresh"
            className="p-2.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg border border-neutral-200 transition-colors disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white">
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="withdrawn">Withdrawn</option>
            <option value="all">All</option>
          </select>
        </>
      }
    >
      <p className="text-sm text-neutral-500 -mt-3">{requests.length} request{requests.length !== 1 ? "s" : ""}</p>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>}

      <Card>
        {requests.length === 0 ? (
          <CardContent className="py-16 text-center">
            <ClipboardList className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-600">No requests found</p>
          </CardContent>
        ) : (
          <div className="divide-y divide-neutral-100">
            {requests.map((r) => (
              <div key={r.request_id} className="flex items-center justify-between px-6 py-4 gap-4 hover:bg-neutral-50/60 transition-colors cursor-pointer" onClick={() => setDetailRequest(r)}>
                <div>
                  <p className="text-sm font-medium text-neutral-900 underline decoration-dotted decoration-neutral-300 underline-offset-2">{REQUEST_TYPE_LABELS[r.request_type] ?? r.request_type}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Region: {regionNameById.get(r.region_id) ?? r.region_id}
                    {r.clinic_id && <> · Clinic: {clinicNameById.get(r.clinic_id) ?? r.clinic_id}</>}
                    {r.clinic_type && <> · Type: {r.clinic_type}</>}
                  </p>
                  <p className="text-xs text-neutral-400 mt-0.5">{new Date(r.created_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[r.status] ?? "bg-neutral-100 text-neutral-600"}`}>
                    {r.status}
                  </span>
                  {r.status === "pending" && (
                    <>
                      <button onClick={() => setDecisionTarget({ request: r, decision: "approved" })}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors">
                        <Check className="h-3.5 w-3.5" />Approve
                      </button>
                      <button onClick={() => setDecisionTarget({ request: r, decision: "rejected" })}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors">
                        <X className="h-3.5 w-3.5" />Reject
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal isOpen={!!decisionTarget} onClose={() => setDecisionTarget(null)} title={decisionTarget?.decision === "approved" ? "Approve Request" : "Reject Request"}>
        {decisionTarget && (
          <DecisionModal
            request={decisionTarget.request}
            decision={decisionTarget.decision}
            onConfirm={async (notes) => { await decideRequest(decisionTarget.request.request_id, decisionTarget.decision, notes); }}
            onClose={() => setDecisionTarget(null)}
          />
        )}
      </Modal>

      <Modal isOpen={!!detailRequest} onClose={() => setDetailRequest(null)} title="Clinic Request Details" className="max-w-3xl">
        {detailRequest && <DetailFieldList data={detailRequest} />}
      </Modal>
    </PageShell>
  );
}
