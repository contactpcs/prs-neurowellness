"use client";

import { useEffect, useState } from "react";
import { Plus, ClipboardList } from "lucide-react";
import { useAuth, useStaffRequests } from "@/lib/hooks";
import { Card, CardContent, Button, Input, Skeleton, Modal, DetailFieldList, PageShell } from "@/components/ui";
import type { CreateStaffRequestPayload, StaffRequest } from "@/lib/api/services/staffRequests.service";

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

function NewRequestForm({ clinicId, onSubmit, onClose }: {
  clinicId: string;
  onSubmit: (data: CreateStaffRequestPayload) => Promise<unknown>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    request_type: "open_position" as CreateStaffRequestPayload["request_type"],
    position_role: "doctor" as CreateStaffRequestPayload["position_role"],
    candidate_name: "", candidate_email: "", candidate_phone: "", target_staff_id: "",
    specialization: "", license_number: "", hospital_affiliation: "", qualification: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const credentials: Record<string, string> = {};
      if (form.position_role === "doctor") {
        if (form.specialization) credentials.specialization = form.specialization;
        if (form.license_number) credentials.license_number = form.license_number;
        if (form.hospital_affiliation) credentials.hospital_affiliation = form.hospital_affiliation;
      } else if (form.position_role === "clinical_assistant") {
        if (form.qualification) credentials.qualification = form.qualification;
      }
      await onSubmit({
        clinic_id: clinicId,
        request_type: form.request_type,
        position_role: form.position_role,
        candidate_name: form.candidate_name || undefined,
        candidate_email: form.candidate_email || undefined,
        candidate_phone: form.candidate_phone || undefined,
        target_staff_id: form.target_staff_id || undefined,
        candidate_credentials: Object.keys(credentials).length ? credentials : undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.detail || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Request Type *</label>
        <select
          value={form.request_type}
          onChange={(e) => setForm((p) => ({ ...p, request_type: e.target.value as typeof form.request_type }))}
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white"
        >
          <option value="open_position">Open Position</option>
          <option value="candidate_referral">Candidate Referral</option>
          <option value="staff_removal">Staff Removal</option>
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-neutral-600 mb-1">Position Role *</label>
        <select
          value={form.position_role}
          onChange={(e) => setForm((p) => ({ ...p, position_role: e.target.value as typeof form.position_role }))}
          className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white"
        >
          <option value="doctor">Doctor</option>
          <option value="clinical_assistant">Clinical Assistant</option>
          <option value="receptionist">Receptionist</option>
        </select>
      </div>

      {form.request_type === "candidate_referral" && (
        <>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Candidate Name</label>
            <Input value={form.candidate_name} onChange={(e) => setForm((p) => ({ ...p, candidate_name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Candidate Email</label>
              <Input type="email" value={form.candidate_email} onChange={(e) => setForm((p) => ({ ...p, candidate_email: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Candidate Phone</label>
              <Input value={form.candidate_phone} onChange={(e) => setForm((p) => ({ ...p, candidate_phone: e.target.value }))} />
            </div>
          </div>

          {form.position_role === "doctor" && (
            <>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Specialization</label>
                <Input value={form.specialization} onChange={(e) => setForm((p) => ({ ...p, specialization: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">License Number</label>
                  <Input value={form.license_number} onChange={(e) => setForm((p) => ({ ...p, license_number: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Hospital Affiliation</label>
                  <Input value={form.hospital_affiliation} onChange={(e) => setForm((p) => ({ ...p, hospital_affiliation: e.target.value }))} />
                </div>
              </div>
            </>
          )}

          {form.position_role === "clinical_assistant" && (
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Qualification</label>
              <Input value={form.qualification} onChange={(e) => setForm((p) => ({ ...p, qualification: e.target.value }))} />
            </div>
          )}
        </>
      )}

      {form.request_type === "staff_removal" && (
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Staff Member ID (UUID) *</label>
          <Input value={form.target_staff_id} onChange={(e) => setForm((p) => ({ ...p, target_staff_id: e.target.value }))} required />
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button type="submit" disabled={loading}>{loading ? "Submitting…" : "Submit Request"}</Button>
      </div>
    </form>
  );
}

export default function ClinicAdminStaffRequestsPage() {
  const { user } = useAuth();
  const { requests, isLoading, error, fetch, createRequest } = useStaffRequests();
  const [showCreate, setShowCreate] = useState(false);
  const [detailRequest, setDetailRequest] = useState<StaffRequest | null>(null);

  useEffect(() => {
    if (user?.clinic_id) fetch({ clinic_id: user.clinic_id });
  }, [fetch, user?.clinic_id]);

  return (
    <PageShell
      title="Staff Requests"
      root="Clinic Admin"
      actions={
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1.5" />New Request
        </Button>
      }
    >
      <p className="text-sm text-neutral-500 -mt-3">{requests.length} request{requests.length !== 1 ? "s" : ""} for your clinic</p>

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
              <ClipboardList className="h-10 w-10 text-neutral-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-neutral-600">No staff requests yet</p>
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
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${STATUS_STYLES[r.status]}`}>
                    {r.status.replace(/_/g, " ")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="New Staff Request">
        {user?.clinic_id && (
          <NewRequestForm clinicId={user.clinic_id} onSubmit={createRequest} onClose={() => setShowCreate(false)} />
        )}
      </Modal>

      <Modal isOpen={!!detailRequest} onClose={() => setDetailRequest(null)} title="Staff Request Details" className="max-w-3xl">
        {detailRequest && <DetailFieldList data={detailRequest} />}
      </Modal>
    </PageShell>
  );
}
