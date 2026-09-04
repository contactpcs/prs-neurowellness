"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, UserPlus, Users } from "lucide-react";
import { useReceptionPatients } from "@/lib/hooks";
import { Input, Card, PageLoader, Button } from "@/components/ui";
import type { PatientListItem } from "@/types/domain.types";
import RegisterPatientModal from "./RegisterPatientModal";

const PAGE_SIZE = 10;

const COLUMNS = ["Patient", "Age", "Gender", "Contact", "Assigned Doctor", "Last Visit", "Next Appt", "Actions"];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ReceptionistPatientsPage() {
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState("");
  const [doctor, setDoctor] = useState("");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const { patients, isLoading } = useReceptionPatients();

  const doctorOptions = Array.from(new Set(patients.map((p) => p.doctor_name).filter(Boolean))) as string[];

  const filtered = patients.filter((p) => {
    const haystack = `${p.full_name} ${p.phone ?? ""} ${p.doctor_name ?? ""}`.toLowerCase();
    if (!haystack.includes(search.toLowerCase())) return false;
    if (gender && (p.gender || "").toLowerCase() !== gender.toLowerCase()) return false;
    if (doctor && p.doctor_name !== doctor) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageItems = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, gender, doctor]);

  const handleRegistered = (_patient: PatientListItem) => {
    setShowModal(false);
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">All Patients</h1>
            <p className="text-sm text-neutral-500 mt-0.5">{patients.length} registered patients</p>
          </div>
          <Button onClick={() => setShowModal(true)} className="flex-shrink-0">
            <UserPlus className="h-4 w-4 mr-1.5" /><span className="hidden sm:inline">Register Patient</span><span className="sm:hidden">Register</span>
          </Button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="relative flex-[0_1_300px] min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <Input
            placeholder="Search by name, phone or doctor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={gender}
          onChange={(e) => setGender(e.target.value)}
          className="h-[38px] px-3 rounded-lg border border-neutral-300 bg-white text-sm text-neutral-700"
        >
          <option value="">All Genders</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
        <select
          value={doctor}
          onChange={(e) => setDoctor(e.target.value)}
          className="h-[38px] px-3 rounded-lg border border-neutral-300 bg-white text-sm text-neutral-700"
        >
          <option value="">All Doctors</option>
          {doctorOptions.map((d) => (
            <option key={d} value={d}>{d.startsWith("Dr.") ? d : `Dr. ${d}`}</option>
          ))}
        </select>
      </div>

      {/* Patient list */}
      <Card className="overflow-x-auto">
        {/* Table header */}
        <div className="hidden md:grid md:grid-cols-[2fr_0.6fr_0.9fr_1.2fr_1.4fr_1fr_1.1fr_auto] gap-4 px-6 py-3 border-b border-neutral-100 bg-neutral-50 rounded-t-xl min-w-[860px]">
          {COLUMNS.map((h) => (
            <span key={h} className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{h}</span>
          ))}
        </div>

        <div className="divide-y divide-neutral-100 min-w-[860px]">
          {pageItems.map((p) => {
            const name = p.full_name || `${p.first_name} ${p.last_name}`.trim() || "Unknown Patient";
            const initials =
              ((p.first_name?.[0] || p.full_name?.[0] || "?") +
               (p.last_name?.[0]  || p.full_name?.split(" ")[1]?.[0] || "")).toUpperCase();
            const doctorLabel = p.doctor_name ? (p.doctor_name.startsWith("Dr.") ? p.doctor_name : `Dr. ${p.doctor_name}`) : null;

            return (
              <div
                key={p.id}
                className="grid md:grid-cols-[2fr_0.6fr_0.9fr_1.2fr_1.4fr_1fr_1.1fr_auto] gap-4 items-center px-6 py-4 hover:bg-blue-50/40 transition-colors"
              >
                {/* Patient */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold text-sm flex-shrink-0">
                    {initials}
                  </div>
                  <p className="text-sm font-medium text-neutral-900 truncate">{name}</p>
                </div>

                {/* Age */}
                <div className="text-sm text-neutral-700">{p.age ?? "—"}</div>

                {/* Gender */}
                <div className="text-sm text-neutral-700 capitalize">{p.gender || "—"}</div>

                {/* Contact — whichever channel the patient registered with. The
                    reception patient-list endpoint only returns phone today;
                    email is read too in case that ever changes. */}
                <div className="text-sm text-neutral-700 truncate">{p.phone || p.email || "—"}</div>

                {/* Assigned Doctor */}
                <div className="text-sm">
                  {doctorLabel ? (
                    <span className="text-blue-700 font-medium">{doctorLabel}</span>
                  ) : (
                    <span className="text-neutral-300">—</span>
                  )}
                </div>

                {/* Last Visit — depends on the appointments module, not built yet; always a placeholder */}
                <div className="text-sm text-neutral-400">—</div>

                {/* Next Appt — same as above */}
                <div className="text-sm text-neutral-400">—</div>

                {/* Actions */}
                <div className="flex justify-end">
                  <Link
                    href={`/receptionist/patients/${p.id}`}
                    className="px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
                  >
                    View
                  </Link>
                </div>
              </div>
            );
          })}

          {pageItems.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-6 py-14 text-center text-neutral-400">
              <Users className="h-8 w-8 text-neutral-200" />
              <p className="text-sm">
                {patients.length === 0 ? "No patients registered yet." : "No patients match your search."}
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-t border-neutral-100">
            <p className="text-xs text-neutral-500">
              Showing page {pageSafe} of {totalPages} · {filtered.length} records
            </p>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={pageSafe === 1}
                className="px-3 py-1 rounded-lg text-xs font-medium text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              >
                Prev
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                    n === pageSafe ? "bg-brand-gradient text-white" : "text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={pageSafe === totalPages}
                className="px-3 py-1 rounded-lg text-xs font-medium text-neutral-500 hover:bg-neutral-100 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </Card>

      {showModal && (
        <RegisterPatientModal onClose={() => setShowModal(false)} onSuccess={handleRegistered} />
      )}
    </div>
  );
}
