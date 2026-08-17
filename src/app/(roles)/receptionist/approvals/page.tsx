"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, CheckCircle, XCircle, Loader2, ClipboardList } from "lucide-react";
import { receptionService } from "@/lib/api/services/reception.service";
import { useAuth } from "@/lib/hooks";
import { PageLoader } from "@/components/ui";
import type { PatientListItem } from "@/types/domain.types";

function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

export default function ReceptionistApprovalsPage() {
  const { user } = useAuth();
  const [patients, setPatients]           = useState<PatientListItem[]>([]);
  const [search, setSearch]               = useState("");
  const [isLoading, setIsLoading]         = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal]     = useState<{ id: string; name: string } | null>(null);
  const [rejectReason, setRejectReason]   = useState("");
  const [toast, setToast]                 = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchPending = useCallback(() => {
    setIsLoading(true);
    receptionService
      .getPendingPatients()
      .then(({ patients: p }) => setPatients(p))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const handleApprove = async (patientId: string) => {
    setActionLoading(patientId);
    try {
      await receptionService.approvePatient(patientId);
      setPatients((prev) => prev.filter((p) => p.id !== patientId));
      showToast("Patient approved successfully.", true);
    } catch {
      showToast("Failed to approve. Please try again.", false);
    }
    setActionLoading(null);
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal.id);
    try {
      // Real endpoint has no rejection-reason field — the reason text
      // entered above isn't transmitted (see reception.service.ts).
      await receptionService.rejectPatient(rejectModal.id);
      setPatients((prev) => prev.filter((p) => p.id !== rejectModal.id));
      setRejectModal(null);
      setRejectReason("");
      showToast("Registration rejected.", true);
    } catch {
      showToast("Failed to reject. Please try again.", false);
    }
    setActionLoading(null);
  };

  const filtered = patients.filter((p) =>
    `${p.full_name} ${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-5">
      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-dropdown text-sm font-medium text-white ${toast.ok ? "bg-success-500" : "bg-danger-500"}`}>
          {toast.ok ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          {toast.msg}
        </div>
      )}

      {/* Breadcrumb + header */}
      <div>
        <nav className="flex items-center gap-1.5 mb-1.5 text-xs">
          <span className="text-neutral-700 font-medium">Approvals</span>
        </nav>
        <h1 className="text-2xl font-bold text-neutral-900">Approvals</h1>
        {user?.clinic_name && (
          <p className="text-xs font-medium text-primary-600 mt-0.5">{user.clinic_name}</p>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-[340px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400 pointer-events-none" />
        <input
          placeholder="Search name, contact…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-[38px] pl-8 pr-3 rounded-lg border border-neutral-300 bg-white text-sm outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-neutral-200/80 shadow-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <ClipboardList className="h-9 w-9 text-neutral-200 mb-3" />
            <p className="text-sm font-medium text-neutral-600">No registrations to review</p>
            <p className="text-xs text-neutral-400 mt-1">Self-registrations submitted by patients will appear here for approval.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div style={{ minWidth: 820 }}>
              <div className="grid gap-3 px-5 py-2.5 bg-neutral-50 border-b border-neutral-100" style={{ gridTemplateColumns: "1.5fr 1.6fr 1.1fr 1fr 190px" }}>
                {["Patient", "Phone / Email", "Submitted", "Status", "Actions"].map((h) => (
                  <span key={h} className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wide">{h}</span>
                ))}
              </div>
              {filtered.map((p) => {
                const name = p.full_name || `${p.first_name} ${p.last_name}`.trim() || "Unknown Patient";
                const initials = (p.first_name?.[0] || p.full_name?.[0] || "?").toUpperCase() +
                                 (p.last_name?.[0] || p.full_name?.split(" ")[1]?.[0] || "").toUpperCase();
                const isActioning = actionLoading === p.id;
                return (
                  <div key={p.id} className="grid gap-3 items-center px-5 py-3 border-b border-neutral-100 last:border-0" style={{ gridTemplateColumns: "1.5fr 1.6fr 1.1fr 1fr 190px" }}>
                    <Link href={`/receptionist/patients/${p.id}`} className="flex items-center gap-2.5 min-w-0 group">
                      <div className="w-[30px] h-[30px] rounded-full bg-primary-100 flex items-center justify-center text-[11px] font-semibold text-primary-700 flex-shrink-0">
                        {initials}
                      </div>
                      <span className="text-sm font-medium text-neutral-900 group-hover:text-primary-700 truncate">{name}</span>
                    </Link>
                    <span className="text-xs text-neutral-600 truncate">{p.email || p.phone || "—"}</span>
                    <span className="text-xs text-neutral-500">{fmtDate(p.registered_at ?? p.created_at)}</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-warning-50 text-warning-700 w-fit">
                      Pending
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleApprove(p.id)}
                        disabled={isActioning}
                        className="h-7 px-2.5 rounded-md bg-success-500 text-white text-xs font-medium hover:bg-success-700 disabled:opacity-50 transition-colors flex items-center gap-1"
                      >
                        {isActioning ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                        Approve
                      </button>
                      <button
                        onClick={() => setRejectModal({ id: p.id, name })}
                        disabled={isActioning}
                        className="h-7 px-2.5 rounded-md border border-danger-100 bg-white text-danger-700 text-xs font-medium hover:bg-danger-50 disabled:opacity-50 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-dropdown max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-neutral-900">Reject Registration</h3>
            <p className="text-sm text-neutral-500">
              Rejecting will notify{" "}
              <span className="font-medium text-neutral-800">{rejectModal.name}</span>{" "}
              that their registration was not approved.
            </p>
            <div>
              <label className="text-xs font-medium text-neutral-700 block mb-1.5">
                Reason <span className="text-neutral-400">(optional)</span>
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Provide a reason to help the patient understand…"
                rows={3}
                className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-danger-300 transition"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setRejectModal(null); setRejectReason(""); }}
                className="flex-1 px-4 py-2 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={!!actionLoading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-danger-500 text-white text-sm font-medium hover:bg-danger-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
