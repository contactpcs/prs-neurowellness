"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Calendar, Activity, FileText, ClipboardList, FileCheck2, Filter, ChevronDown, ChevronUp, AlertCircle, Loader2, Upload, Download } from "lucide-react";
import { usePatientPermissions } from "@/lib/hooks";
import { appointmentsService } from "@/lib/api/services/appointments.service";
import { doctorsService } from "@/lib/api/services/doctors.service";
import { patientFilesService, type PatientFile } from "@/lib/api/services/patientFiles.service";
import { extractErrorMessage } from "@/lib/api/errors";
import type { InstanceScoreDetail } from "@/lib/api/services/scores.service";
import type { Appointment, AppointmentStatus } from "@/types/domain.types";

type Tab = "appointments" | "reports" | "prs" | "sessions" | "final-reports";

const REPORT_TYPE_OPTIONS = [
  { value: "blood_test",     label: "Blood test" },
  { value: "scan",           label: "Scan" },
  { value: "mri",            label: "MRI" },
  { value: "eeg",            label: "EEG" },
  { value: "other",          label: "Other" },
];

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function fmt12(t: string | null | undefined) {
  if (!t) return "No time booked yet";
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
  planned:     "bg-gray-100 text-gray-600",
  selected:    "bg-amber-100 text-amber-700",
  paid:        "bg-green-100 text-green-700",
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

export function PatientHistoryPanel({ patientId, clinicId }: { patientId: string; clinicId?: string }) {
  const [tab, setTab] = useState<Tab>("appointments");

  // Real, working sources — same ones the rest of the doctor patient-detail
  // page already relies on. The old standalone /history page hit stub
  // services (scores.service's getPatientScoresSummary always returns
  // empty) and mis-shaped endpoints (doctors.service's PatientDetail has no
  // `.permissions` field), which is why nothing showed up there.
  const assessments = usePatientPermissions(patientId);

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

  // ── medical reports (blood tests, scans, MRI, EEG) ──────────────────────
  const [reports, setReports]           = useState<PatientFile[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsErr, setReportsErr]     = useState<string | null>(null);
  const [reportType, setReportType]     = useState("other");
  const [uploading, setUploading]       = useState(false);
  const [uploadErr, setUploadErr]       = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setApptLoading(true);
    appointmentsService.list({ patient_id: patientId, limit: 100 })
      .then(({ appointments }) => setAppointments(appointments))
      .catch(() => setApptErr("Failed to load appointments"))
      .finally(() => setApptLoading(false));
  }, [patientId]);

  useEffect(() => {
    setReportsLoading(true);
    patientFilesService.list(patientId)
      .then(setReports)
      .catch(() => setReportsErr("Failed to load medical reports"))
      .finally(() => setReportsLoading(false));
  }, [patientId]);

  const onPickReport = () => fileInputRef.current?.click();

  const onReportSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !clinicId) return;
    setUploadErr(null);
    setUploading(true);
    try {
      const uploaded = await patientFilesService.upload(patientId, clinicId, file, reportType);
      setReports((prev) => [uploaded, ...prev]);
    } catch (err: any) {
      setUploadErr(extractErrorMessage(err, "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const onDownloadReport = async (fileId: string, fileName: string) => {
    try {
      const url = await patientFilesService.downloadUrl(fileId);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      setUploadErr("Could not download this file");
    }
  };

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
    { id: "appointments",   label: "Appointments",          Icon: Calendar     },
    { id: "reports",        label: "Medical Reports",       Icon: FileText     },
    { id: "prs",            label: "PRS Assessments",       Icon: Activity     },
    { id: "sessions",       label: "Device Sessions",       Icon: ClipboardList },
    { id: "final-reports",  label: "Final Treatment Reports", Icon: FileCheck2 },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-neutral-900 mb-1">Medical History</h2>
        <p className="text-neutral-600 text-sm">Appointments, medical reports, PRS assessments, device sessions, and final treatment reports.</p>
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
                {(["planned","selected","paid","checked_in","in_progress","completed","cancelled","no_show","rescheduled"] as const).map((s) => (
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

        {/* ── Medical Reports ── */}
        {tab === "reports" && (
          <div className="bg-white">
            <div className="px-6 py-4 border-b border-neutral-100 flex flex-wrap items-center gap-3">
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="px-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                {REPORT_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input ref={fileInputRef} type="file" className="hidden" onChange={onReportSelected} />
              <button
                onClick={onPickReport}
                disabled={uploading || !clinicId}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-neutral-900 text-white text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                <Upload className="w-3.5 h-3.5" /> {uploading ? "Uploading…" : "Upload report"}
              </button>
              <span className="ml-auto text-xs text-neutral-400">
                {reports.length} record{reports.length !== 1 ? "s" : ""}
              </span>
            </div>

            {uploadErr && <SectionError msg={uploadErr} />}

            {reportsLoading ? <SectionSkeleton /> : reportsErr ? <SectionError msg={reportsErr} /> : reports.length === 0 ? (
              <div className="px-6 py-12 text-center text-sm text-neutral-400">No medical reports uploaded yet</div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {reports.map((f) => (
                  <div key={f.file_id} className="flex items-center justify-between gap-3 px-6 py-3.5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-neutral-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-900 truncate">{f.file_name}</p>
                        <p className="text-xs text-neutral-400 mt-0.5">
                          {REPORT_TYPE_OPTIONS.find((o) => o.value === f.document_type)?.label ?? f.document_type}
                          {f.file_size ? ` · ${formatFileSize(f.file_size)}` : ""}
                          {f.created_at ? ` · ${formatDate(f.created_at)}` : ""}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => onDownloadReport(f.file_id, f.file_name)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 flex-shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" /> Download
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Device Sessions ── */}
        {tab === "sessions" && (
          <div className="px-6 py-12 text-center text-sm text-neutral-400 bg-white">
            No device session logs recorded yet
          </div>
        )}

        {/* ── Final Treatment Reports ── */}
        {tab === "final-reports" && (
          <div className="px-6 py-12 text-center text-sm text-neutral-400 bg-white">
            No final treatment reports available yet
          </div>
        )}

      </div>
    </div>
  );
}
