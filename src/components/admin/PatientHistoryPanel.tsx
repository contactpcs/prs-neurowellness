"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, Activity, FileText, Shield, Filter, ChevronDown, ChevronUp, AlertCircle, Loader2 } from "lucide-react";
import { usePatientPermissions, usePatientAnamnesis } from "@/lib/hooks";
import { appointmentsService } from "@/lib/api/services/appointments.service";
import { doctorsService } from "@/lib/api/services/doctors.service";
import type { InstanceScoreDetail } from "@/lib/api/services/scores.service";
import type { Appointment, AppointmentStatus } from "@/types/domain.types";

type Tab = "appointments" | "prs" | "anamnesis" | "permissions";

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function severityBg(level?: string) {
  switch (level) {
    case "severe":   return "bg-red-50 text-red-700";
    case "moderate": return "bg-orange-50 text-orange-700";
    case "mild":     return "bg-yellow-50 text-yellow-700";
    default:         return "bg-green-50 text-green-700";
  }
}

const APPT_BADGE: Record<string, string> = {
  confirmed:   "bg-green-100 text-green-700",
  scheduled:   "bg-amber-100 text-amber-700",
  checked_in:  "bg-blue-100 text-blue-700",
  in_progress: "bg-blue-200 text-blue-900",
  cancelled:   "bg-red-100 text-red-700",
  no_show:     "bg-gray-100 text-gray-600",
  completed:   "bg-slate-100 text-slate-600",
  rescheduled: "bg-purple-100 text-purple-700",
};

const PERM_BADGE: Record<string, string> = {
  granted:   "bg-blue-50 text-blue-700",
  completed: "bg-green-50 text-green-700",
  expired:   "bg-yellow-50 text-yellow-700",
  revoked:   "bg-red-50 text-red-700",
};

function SectionSkeleton() {
  return (
    <div className="space-y-3 animate-pulse p-6">
      {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-neutral-100 rounded-lg" />)}
    </div>
  );
}

function SectionError({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 m-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm">
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      {msg}
    </div>
  );
}

export function PatientHistoryPanel({ patientId }: { patientId: string }) {
  const [tab, setTab] = useState<Tab>("appointments");

  // Real, working sources — same ones the rest of the doctor patient-detail
  // page already relies on. The old standalone /history page hit stub
  // services (scores.service's getPatientScoresSummary always returns
  // empty) and mis-shaped endpoints (doctors.service's PatientDetail has no
  // `.permissions` field, and the raw anamnesis fetch skipped the
  // `withResponses` unwrap), which is why nothing showed up there.
  const assessments = usePatientPermissions(patientId);
  const { record: anamnesis, isLoading: anamnesisLoading } = usePatientAnamnesis(patientId);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [apptLoading, setApptLoading]   = useState(true);
  const [apptErr, setApptErr]           = useState<string | null>(null);

  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo,   setFilterDateTo]   = useState("");
  const [filterStatus,   setFilterStatus]   = useState<AppointmentStatus | "">("");

  const [drillOpen,    setDrillOpen]    = useState<string | null>(null);
  const [drillData,    setDrillData]    = useState<Record<string, InstanceScoreDetail>>({});
  const [drillLoading, setDrillLoading] = useState<string | null>(null);
  const [drillErr,     setDrillErr]     = useState<Record<string, boolean>>({});

  useEffect(() => {
    setApptLoading(true);
    appointmentsService.list({ patient_id: patientId, limit: 100 })
      .then(({ appointments }) => setAppointments(appointments))
      .catch(() => setApptErr("Failed to load appointments"))
      .finally(() => setApptLoading(false));
  }, [patientId]);

  const handleDrill = useCallback(async (instanceId: string) => {
    if (drillOpen === instanceId) { setDrillOpen(null); return; }
    setDrillOpen(instanceId);
    if (drillData[instanceId]) return;
    setDrillLoading(instanceId);
    try {
      const detail = await doctorsService.getPatientResult(patientId, instanceId);
      setDrillData((prev) => ({ ...prev, [instanceId]: detail }));
    } catch {
      setDrillErr((prev) => ({ ...prev, [instanceId]: true }));
    } finally {
      setDrillLoading(null);
    }
  }, [patientId, drillOpen, drillData]);

  const filteredAppts = appointments
    .filter((a) => {
      if (filterDateFrom && a.appointment_date < filterDateFrom) return false;
      if (filterDateTo   && a.appointment_date > filterDateTo)   return false;
      if (filterStatus   && a.status !== filterStatus)            return false;
      return true;
    })
    .sort((a, b) => b.appointment_date.localeCompare(a.appointment_date));

  const TABS: { id: Tab; label: string; Icon: React.ElementType }[] = [
    { id: "appointments", label: "Appointments",       Icon: Calendar  },
    { id: "prs",          label: "PRS Assessments",    Icon: Activity  },
    { id: "anamnesis",    label: "Anamnesis",           Icon: FileText  },
    { id: "permissions",  label: "Granted Permissions", Icon: Shield    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-neutral-900 mb-1">Medical History</h2>
        <p className="text-neutral-600 text-sm">Appointments, PRS assessments, anamnesis, and granted permissions.</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {TABS.map(({ id: tabId, label, Icon }) => (
          <button
            key={tabId}
            onClick={() => setTab(tabId)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === tabId
                ? "bg-neutral-900 text-white"
                : "bg-white text-neutral-700 border border-neutral-200 hover:border-neutral-300"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-neutral-50 rounded-lg border border-neutral-200 overflow-hidden">

        {/* ── Appointments ── */}
        {tab === "appointments" && (
          <div>
            {/* Filter bar */}
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center gap-3 flex-wrap bg-white">
              <Filter className="w-4 h-4 text-neutral-400 flex-shrink-0" />
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-neutral-500">From</label>
                <input
                  type="date"
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                  className="text-sm border border-neutral-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs text-neutral-500">To</label>
                <input
                  type="date"
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                  className="text-sm border border-neutral-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as AppointmentStatus | "")}
                className="text-sm border border-neutral-200 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
              >
                <option value="">All Statuses</option>
                {(["scheduled","confirmed","checked_in","completed","cancelled","no_show","rescheduled"] as const).map((s) => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
              </select>
              {(filterDateFrom || filterDateTo || filterStatus) && (
                <button
                  onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); setFilterStatus(""); }}
                  className="text-xs text-red-500 hover:text-red-700 transition-colors"
                >
                  Clear
                </button>
              )}
              <span className="ml-auto text-xs text-neutral-400">
                {filteredAppts.length} record{filteredAppts.length !== 1 ? "s" : ""}
              </span>
            </div>

            {apptLoading ? <SectionSkeleton /> : apptErr ? <SectionError msg={apptErr} /> : filteredAppts.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-neutral-400">No appointments found</div>
            ) : (
              <div className="overflow-x-auto bg-white">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-neutral-100">
                      {["Date", "Time", "Type", "Reason", "Status"].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {filteredAppts.map((a) => (
                      <tr key={a.appointment_id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-5 py-3 text-sm text-neutral-800 whitespace-nowrap">{formatDate(a.appointment_date)}</td>
                        <td className="px-5 py-3 text-sm text-neutral-600 whitespace-nowrap">{fmt12(a.start_time)}</td>
                        <td className="px-5 py-3 text-sm text-neutral-600 capitalize">{(a.appointment_type || "—").replace(/_/g, " ")}</td>
                        <td className="px-5 py-3 text-sm text-neutral-600 max-w-[200px] truncate">{a.reason || "—"}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${APPT_BADGE[a.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {statusLabel(a.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── PRS Assessments ── */}
        {tab === "prs" && (
          <div className="divide-y divide-neutral-100 bg-white">
            {assessments.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-neutral-400">No PRS assessments found</div>
            ) : assessments.map((a) => {
              const instanceId = a.instance_id;
              const isOpen  = !!instanceId && drillOpen === instanceId;
              const drill   = instanceId ? drillData[instanceId] : undefined;
              const loading = !!instanceId && drillLoading === instanceId;
              const failed  = !!instanceId && drillErr[instanceId];
              const disease_result = drill?.disease_result;

              return (
                <div key={a.permission_id}>
                  <button
                    onClick={() => instanceId && handleDrill(instanceId)}
                    disabled={!instanceId}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-neutral-50 transition-colors text-left gap-4 disabled:cursor-default disabled:hover:bg-white"
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-neutral-900 truncate">
                          {a.disease_name || a.disease_id || "Assessment"}
                        </p>
                        <p className="text-xs text-neutral-500 mt-0.5">
                          {a.status === "completed"
                            ? `Completed ${formatDate(a.completed_at)}`
                            : `Granted ${formatDate(a.granted_at)}`}
                        </p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${PERM_BADGE[a.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {statusLabel(a.status)}
                      </span>
                    </div>
                    {instanceId && (isOpen
                      ? <ChevronUp className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                      : <ChevronDown className="w-4 h-4 text-neutral-400 flex-shrink-0" />)}
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-5 bg-neutral-50 border-t border-neutral-100">
                      {loading ? (
                        <div className="flex items-center gap-2 py-4 text-sm text-neutral-500">
                          <Loader2 className="w-4 h-4 animate-spin" /> Loading results…
                        </div>
                      ) : failed ? (
                        <p className="py-4 text-sm text-red-500">Could not load details.</p>
                      ) : drill ? (
                        <div className="pt-4 space-y-4">
                          {disease_result && (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              {disease_result.percentage != null && (
                                <div className="bg-white rounded-lg p-3 border border-neutral-200">
                                  <p className="text-xs text-neutral-500 mb-0.5">Score</p>
                                  <p className="text-xl font-bold text-neutral-900">
                                    {disease_result.percentage.toFixed(0)}%
                                  </p>
                                </div>
                              )}
                              {disease_result.severity_label && (
                                <div className="bg-white rounded-lg p-3 border border-neutral-200">
                                  <p className="text-xs text-neutral-500 mb-0.5">Severity</p>
                                  <p className={`text-sm font-semibold ${severityBg(disease_result.severity_level).replace(/bg-\S+ /, "")}`}>
                                    {disease_result.severity_label}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          {drill.scale_results?.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">
                                Scale Breakdown
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {drill.scale_results.map((sr) => (
                                  <div
                                    key={sr.scale_result_id ?? sr.scale_id}
                                    className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-neutral-200"
                                  >
                                    <span className="text-sm text-neutral-700 truncate">
                                      {sr.scale_name ?? sr.scale_code ?? sr.scale_id}
                                    </span>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      {sr.calculated_value != null && (
                                        <span className="text-sm font-semibold text-neutral-900">
                                          {sr.calculated_value}
                                          {sr.max_possible != null && (
                                            <span className="text-xs font-normal text-neutral-400">/{sr.max_possible}</span>
                                          )}
                                        </span>
                                      )}
                                      {sr.severity_label && (
                                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${severityBg(sr.severity_level)}`}>
                                          {sr.severity_label}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="py-4 text-sm text-neutral-400">Could not load details.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Anamnesis ── */}
        {tab === "anamnesis" && (
          <div className="p-6 bg-white">
            {anamnesisLoading ? (
              <SectionSkeleton />
            ) : !anamnesis ? (
              <div className="py-12 text-center text-sm text-neutral-400">No anamnesis record found</div>
            ) : (
              <div className="space-y-5">
                <div>
                  <h3 className="text-base font-semibold text-neutral-900">Anamnesis Record</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    Status:{" "}
                    <span className={`font-medium ${anamnesis.status === "completed" ? "text-green-700" : "text-amber-700"}`}>
                      {statusLabel(anamnesis.status)}
                    </span>
                    {anamnesis.completed_at && ` · Completed ${formatDate(anamnesis.completed_at)}`}
                  </p>
                </div>

                {[
                  { label: "Chief Complaint",       value: anamnesis.chief_complaint },
                  { label: "Main Symptoms",          value: anamnesis.main_symptoms },
                  { label: "Initial Symptoms",       value: anamnesis.initial_symptoms },
                  { label: "Symptoms Onset",         value: anamnesis.symptoms_start },
                  { label: "Duration",               value: anamnesis.symptoms_duration },
                  { label: "Frequency",              value: anamnesis.symptoms_frequency },
                  { label: "Intensity",              value: anamnesis.symptoms_intensity },
                  { label: "Progression",            value: anamnesis.symptoms_progression },
                  { label: "Previous Treatments",    value: anamnesis.previous_treatments },
                  { label: "Current Medications",    value: anamnesis.current_medications },
                  { label: "Operations",             value: anamnesis.has_operations ? (anamnesis.operations_details || "Yes") : "No" },
                  { label: "Brain MRI",              value: anamnesis.has_brain_mri ? (anamnesis.mri_details || "Yes") : "No" },
                  { label: "Other Scans",            value: anamnesis.other_scans },
                  { label: "Neuromodulation",        value: anamnesis.has_neuromodulation ? (anamnesis.neuromodulation_details || "Yes") : "No" },
                  { label: "Diagnosis Related",      value: anamnesis.diagnosis_related ? (anamnesis.diagnosis_details || "Yes") : "No" },
                ].filter((f) => f.value).map((field) => (
                  <div key={field.label} className="border-b border-neutral-100 pb-4">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-1">{field.label}</p>
                    <p className="text-sm text-neutral-800">{field.value}</p>
                  </div>
                ))}

                {anamnesis.secondary_symptoms && anamnesis.secondary_symptoms.length > 0 && (
                  <div className="border-b border-neutral-100 pb-4">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Secondary Symptoms</p>
                    <div className="flex flex-wrap gap-2">
                      {anamnesis.secondary_symptoms.map((s) => (
                        <span key={s} className="px-2 py-0.5 bg-neutral-100 text-neutral-700 text-xs rounded">{s}</span>
                      ))}
                    </div>
                    {anamnesis.secondary_symptoms_details && (
                      <p className="text-sm text-neutral-800 mt-2">{anamnesis.secondary_symptoms_details}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Granted Permissions ── */}
        {tab === "permissions" && (
          <div className="bg-white">
            {assessments.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-neutral-400">No permissions granted yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-neutral-100">
                      {["Disease", "Status", "Granted", "Completed / Expires"].map((h) => (
                        <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {assessments.map((p) => (
                      <tr key={p.permission_id} className="hover:bg-neutral-50 transition-colors">
                        <td className="px-5 py-3 text-sm font-medium text-neutral-900">
                          {p.disease_name || p.disease_id}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${PERM_BADGE[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {statusLabel(p.status)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-neutral-600 whitespace-nowrap">
                          {formatDate(p.granted_at)}
                        </td>
                        <td className="px-5 py-3 text-sm text-neutral-600 whitespace-nowrap">
                          {formatDate(p.completed_at ?? p.expires_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
