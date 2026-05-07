"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, MapPin, UserPlus, X, ChevronRight, Loader2, Users } from "lucide-react";
import { staffService } from "@/lib/api/services/staff.service";
import type { RegisterPatientPayload } from "@/lib/api/services/staff.service";
import { useStaffPatients, useClinics } from "@/lib/hooks";
import { Input, Card, PageLoader, Button } from "@/components/ui";
import type { PatientListItem } from "@/types/domain.types";

const STATUS_FILTERS = ["all", "approved", "pending", "rejected"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const EMPTY_FORM: RegisterPatientPayload = {
  full_name: "",
  email: "",
  password: "",
  phone: "",
  date_of_birth: "",
  gender: "",
  medical_history: "",
  emergency_contact: "",
};

function getStatusStyle(status?: string) {
  switch (status) {
    case "approved": return "bg-green-50 text-green-700";
    case "pending":  return "bg-amber-50 text-amber-700";
    case "rejected": return "bg-red-50 text-red-600";
    default:         return "bg-neutral-100 text-neutral-500";
  }
}

// ─── Register Patient Modal ───────────────────────────────────────────────────
function RegisterModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (p: PatientListItem) => void;
}) {
  const [form, setForm] = useState<RegisterPatientPayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (field: keyof RegisterPatientPayload, val: string) =>
    setForm((f) => ({ ...f, [field]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.full_name.trim() || !form.email.trim() || !form.password.trim()) {
      setErr("Full name, email, and password are required.");
      return;
    }
    if (form.password.length < 8) {
      setErr("Password must be at least 8 characters.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const patient = await staffService.registerPatient({
        full_name:         form.full_name.trim(),
        email:             form.email.trim(),
        password:          form.password,
        phone:             form.phone             || undefined,
        date_of_birth:     form.date_of_birth     || undefined,
        gender:            form.gender            || undefined,
        medical_history:   form.medical_history   || undefined,
        emergency_contact: form.emergency_contact || undefined,
      });
      onSuccess(patient);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || "Failed to register patient. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <h2 className="text-lg font-semibold text-neutral-900">Register New Patient</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-500 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {err && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g. Rahul Sharma"
                value={form.full_name}
                onChange={(e) => set("full_name", e.target.value)}
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                Email Address <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                placeholder="patient@example.com"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">
                Initial Password <span className="text-red-500">*</span>
              </label>
              <Input
                type="password"
                placeholder="Minimum 8 characters"
                value={form.password}
                onChange={(e) => set("password", e.target.value)}
                minLength={8}
                required
              />
              <p className="text-xs text-neutral-500 mt-1">Share this securely with the patient — they can change it after first login.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">Phone</label>
              <Input
                type="tel"
                placeholder="+91 98765 43210"
                value={form.phone ?? ""}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">Date of Birth</label>
              <Input
                type="date"
                value={form.date_of_birth ?? ""}
                onChange={(e) => set("date_of_birth", e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">Gender</label>
              <select
                value={form.gender ?? ""}
                onChange={(e) => set("gender", e.target.value)}
                className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-neutral-700"
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="prefer_not_to_say">Prefer not to say</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">Emergency Contact</label>
              <Input
                placeholder="Name and phone, e.g. Anjali Sharma — +91 98765 12345"
                value={form.emergency_contact ?? ""}
                onChange={(e) => set("emergency_contact", e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-neutral-700 mb-1.5">Medical History</label>
              <textarea
                rows={3}
                placeholder="Existing conditions, allergies, medications, prior diagnoses…"
                value={form.medical_history ?? ""}
                onChange={(e) => set("medical_history", e.target.value)}
                className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white text-neutral-700 resize-y"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-neutral-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {saving ? "Registering…" : "Register Patient"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ReceptionistPatientsPage() {
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showModal, setShowModal]       = useState(false);
  const { patients, isLoading: patientsLoading } = useStaffPatients();
  const { clinics, isLoading: clinicsLoading } = useClinics();

  const isLoading = patientsLoading || clinicsLoading;

  function clinicName(clinicId?: string): string | null {
    if (!clinicId) return null;
    const c = clinics.find((x) => x.clinic_id === clinicId);
    return c?.clinic_name || c?.city || null;
  }

  const filtered = patients.filter((p) => {
    const clinic = clinicName(p.clinic_id) ?? p.clinic_name ?? p.clinic_city ?? "";
    const haystack = `${p.full_name} ${p.email} ${p.phone ?? ""} ${p.mrn ?? ""} ${clinic}`.toLowerCase();
    const matchSearch = haystack.includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleRegistered = (newPatient: PatientListItem) => {
    setShowModal(false);
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">All Patients</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{patients.length} registered patients</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <UserPlus className="h-4 w-4 mr-1.5" />Register Patient
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            placeholder="Search by name, email, phone or clinic…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                statusFilter === s ? "bg-blue-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Patient list */}
      <Card>
        {/* Table header */}
        <div className="hidden md:grid grid-cols-[2.5fr_2fr_1.5fr_1fr_1fr_auto] gap-4 px-6 py-3 border-b border-neutral-100 bg-neutral-50 rounded-t-xl">
          {["Patient", "Contact", "Clinic", "Registered", "Status", ""].map((h) => (
            <span key={h} className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{h}</span>
          ))}
        </div>

        <div className="divide-y divide-neutral-100">
          {filtered.map((p) => {
            const name    = p.full_name || `${p.first_name} ${p.last_name}`.trim() || "Unknown Patient";
            const initials =
              ((p.first_name?.[0] || p.full_name?.[0] || "?") +
               (p.last_name?.[0]  || p.full_name?.split(" ")[1]?.[0] || "")).toUpperCase();
            const clinic  = clinicName(p.clinic_id) ?? p.clinic_name ?? p.clinic_city;
            const regDate = p.registered_at || p.created_at;

            return (
              <Link
                key={p.id}
                href={`/receptionist/patients/${p.id}`}
                className="grid md:grid-cols-[2.5fr_2fr_1.5fr_1fr_1fr_auto] gap-4 items-center px-6 py-4 hover:bg-blue-50/40 transition-colors group"
              >
                {/* Patient name + gender */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm flex-shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate group-hover:text-blue-700">{name}</p>
                    {p.gender && (
                      <p className="text-xs text-neutral-400 capitalize mt-0.5">{p.gender}</p>
                    )}
                  </div>
                </div>

                {/* Contact */}
                <div className="min-w-0">
                  <p className="text-xs text-neutral-700 truncate">{p.email || "—"}</p>
                  {p.phone && <p className="text-xs text-neutral-400 mt-0.5">{p.phone}</p>}
                </div>

                {/* Clinic */}
                <div>
                  {clinic ? (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                      <MapPin className="h-3 w-3 flex-shrink-0" />{clinic}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-300">—</span>
                  )}
                </div>

                {/* Registered date */}
                <div>
                  {regDate ? (
                    <span className="text-xs text-neutral-500">
                      {new Date(regDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-300">—</span>
                  )}
                </div>

                {/* Status */}
                <div>
                  {p.status ? (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusStyle(p.status)}`}>
                      {p.status}
                    </span>
                  ) : (
                    <span className="text-xs text-neutral-300">—</span>
                  )}
                </div>

                {/* Arrow */}
                <div className="flex justify-end">
                  <ChevronRight className="h-4 w-4 text-neutral-300 group-hover:text-blue-500 transition-colors" />
                </div>
              </Link>
            );
          })}

          {filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center text-neutral-400">
              <Users className="h-8 w-8 text-neutral-200" />
              <p className="text-sm">
                {patients.length === 0 ? "No patients registered yet." : "No patients match your search."}
              </p>
            </div>
          )}
        </div>
      </Card>

      {showModal && (
        <RegisterModal onClose={() => setShowModal(false)} onSuccess={handleRegistered} />
      )}
    </div>
  );
}
