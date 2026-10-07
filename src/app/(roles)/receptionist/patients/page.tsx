"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, UserPlus, Users } from "lucide-react";
import { useReceptionPatients } from "@/lib/hooks";
import { receptionService } from "@/lib/api/services/reception.service";
import { Input, Card, PatientListSkeleton, Button } from "@/components/ui";
import type { PatientListItem } from "@/types/domain.types";
import RegisterPatientModal from "./RegisterPatientModal";

const PAGE_SIZE = 10;

/** "YYYY-MM-DD[THH:MM]" -> "28 Sep 2026" (date part only). */
function fmtVisitDate(v?: string | null): string {
  if (!v) return "—";
  return new Date(v.slice(0, 10) + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function fmt12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

const COLUMNS = ["Patient", "Age", "Gender", "Contact", "Assigned Doctor", "Last Visit", "Next Appt", "Actions"];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ReceptionistPatientsPage() {
  const [search, setSearch] = useState("");
  const [gender, setGender] = useState("");
  const [doctor, setDoctor] = useState("");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  // Server-side page + search/filters (API audit F-020/F-021) — used to
  // download every patient and filter/page in the browser.
  const { patients: pageItems, total, totalPages, isLoading } = useReceptionPatients({
    page, pageSize: PAGE_SIZE, search, gender, doctor,
  });
  const pageSafe = Math.min(page, totalPages);
  const everLoaded = useRef(false);
  if (!isLoading) everLoaded.current = true;

  // Header count = all patients, captured whenever no filter is applied.
  const [allTotal, setAllTotal] = useState(0);
  useEffect(() => {
    if (!isLoading && !search && !gender && !doctor) setAllTotal(total);
  }, [isLoading, search, gender, doctor, total]);

  const [doctorOptions, setDoctorOptions] = useState<string[]>([]);
  useEffect(() => {
    receptionService.getDoctors()
      .then(({ doctors }) => setDoctorOptions(doctors.map((d) => `${d.first_name} ${d.last_name}`.trim()).filter(Boolean)))
      .catch(() => {});
  }, []);

  useEffect(() => { setPage(1); }, [search, gender, doctor]);

  const handleRegistered = (_patient: PatientListItem) => {
    setShowModal(false);
  };

  // Skeleton only for the very first load — a search/page change keeps the
  // inputs mounted (and focused) while the next page loads.
  if (!everLoaded.current) return <PatientListSkeleton />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">All Patients</h1>
            <p className="text-sm text-neutral-500 mt-0.5">{allTotal} registered patients</p>
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

                {/* Last Visit — latest completed appointment */}
                <div className={`text-sm ${p.last_visit ? "text-neutral-700" : "text-neutral-300"}`}>
                  {fmtVisitDate(p.last_visit)}
                </div>

                {/* Next Appt — soonest upcoming active appointment */}
                <div className="text-sm">
                  {p.next_appointment ? (
                    <>
                      <p className="text-neutral-800 font-medium">{fmtVisitDate(p.next_appointment)}</p>
                      {p.next_appointment.includes("T") && (
                        <p className="text-[11px] text-neutral-400">{fmt12(p.next_appointment.split("T")[1])}</p>
                      )}
                    </>
                  ) : (
                    <span className="text-neutral-300">—</span>
                  )}
                </div>

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
                {allTotal === 0 ? "No patients registered yet." : "No patients match your search."}
              </p>
            </div>
          )}
        </div>

        {/* Pagination */}
        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-t border-neutral-100">
            <p className="text-xs text-neutral-500">
              Showing page {pageSafe} of {totalPages} · {total} records
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
