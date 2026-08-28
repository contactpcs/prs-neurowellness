"use client";

import { useEffect, useState } from "react";
import { Check, X, ClipboardCheck } from "lucide-react";
import { useStaffRequests } from "@/lib/hooks";
import { Card, CardContent, Button, Skeleton, Modal, DetailFieldList, PageShell } from "@/components/ui";
import type { StaffRequest } from "@/lib/api/services/staffRequests.service";

const STATUS_STYLES: Record<StaffRequest["status"], string> = {
  pending: "bg-amber-100 text-amber-700",
  under_review: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
  withdrawn: "bg-neutral-200 text-neutral-600",
};

const REQUEST_TYPE_LABELS: Record<StaffRequest["request_type"], string> = {
  open_position: "Open Position",
  candidate_referral: "Candidate Referral",
  staff_removal: "Staff Removal",
};

function DecisionModal({ request, decision, onConfirm, onClose }: {
  request: StaffRequest;
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
        {decision === "approved" ? "Approve" : "Reject"} the {REQUEST_TYPE_LABELS[request.request_type]} request for{" "}
        <strong className="capitalize">{request.position_role.replace(/_/g, " ")}</strong>?
      </p>
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
        <Button
          type="button"
          disabled={loading}
          variant={decision === "approved" ? "primary" : "danger"}
          onClick={confirm}
        >
          {loading ? "Submitting…" : decision === "approved" ? "Approve" : "Reject"}
        </Button>
      </div>
    </div>
  );
}

export default function RegionalAdminStaffApprovalsPage() {
  const { requests, isLoading, error, fetch, decideRequest } = useStaffRequests();
  const [statusFilter, setStatusFilter] = useState("pending");
  const [decisionTarget, setDecisionTarget] = useState<{ request: StaffRequest; decision: "approved" | "rejected" } | null>(null);
  const [detailRequest, setDetailRequest] = useState<StaffRequest | null>(null);

  useEffect(() => {
    fetch(statusFilter === "all" ? undefined : { status: statusFilter });
  }, [fetch, statusFilter]);

  return (
    <PageShell
      title="Staff Approvals"
      root="Regional Admin"
      actions={
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="pending">Pending</option>
          <option value="under_review">Under Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="all">All</option>
        </select>
      }
    >
      <p className="text-sm text-neutral-500 -mt-4">{requests.length} request{requests.length !== 1 ? "s" : ""} in your region</p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
        </div>
      ) : (
        <Card>
          {requests.length === 0 ? (
            <CardContent className="py-16 text-center">
              <ClipboardCheck className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-neutral-600">No requests found</p>
            </CardContent>
          ) : (
            <div className="divide-y divide-neutral-100">
              {requests.map((r) => (
                <div key={r.request_id} className="flex items-center justify-between px-6 py-4 hover:bg-neutral-50/60 transition-colors cursor-pointer" onClick={() => setDetailRequest(r)}>
                  <div>
                    <p className="text-sm font-medium text-neutral-900 underline decoration-dotted decoration-neutral-300 underline-offset-2">
                      {REQUEST_TYPE_LABELS[r.request_type]} — <span className="capitalize">{r.position_role.replace(/_/g, " ")}</span>
                    </p>
                    {r.candidate_name && <p className="text-xs text-neutral-500 mt-0.5">{r.candidate_name} ({r.candidate_email})</p>}
                    <p className="text-xs text-neutral-400 mt-0.5">{new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[r.status]}`}>
                      {r.status.replace(/_/g, " ")}
                    </span>
                    {(r.status === "pending" || r.status === "under_review") && (
                      <>
                        <button
                          onClick={() => setDecisionTarget({ request: r, decision: "approved" })}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg border border-green-200 transition-colors"
                        >
                          <Check className="h-3.5 w-3.5" />Approve
                        </button>
                        <button
                          onClick={() => setDecisionTarget({ request: r, decision: "rejected" })}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 transition-colors"
                        >
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
      )}

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

      <Modal isOpen={!!detailRequest} onClose={() => setDetailRequest(null)} title="Staff Request Details" className="max-w-3xl">
        {detailRequest && <DetailFieldList data={detailRequest} />}
      </Modal>
    </PageShell>
  );
}
