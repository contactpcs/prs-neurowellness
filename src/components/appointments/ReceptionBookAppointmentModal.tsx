"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X, Search, Loader2, CalendarDays } from "lucide-react";
import { Modal } from "@/components/ui";
import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
import { receptionService } from "@/lib/api/services/reception.service";
import { StaffPaymentPanel } from "@/components/appointments/StaffPaymentPanel";
import type { Appointment, AvailabilitySlot, DoctorListItem, PatientListItem } from "@/types/domain.types";

// Protocol follow-ups and device sessions aren't new appointments: the doctor
// already created them as 'planned' rows with a fixed date on the treatment
// schedule, so "booking" one means putting a time on that row, on that same
// day only. A protocol follow-up takes a slot on the doctor's calendar; a
// device session takes one on its device's capacity calendar (no doctor).
const APPT_TYPES = [
  { value: "initial",           label: "Initial" },
  { value: "follow_up",         label: "Follow-up" },
  { value: "protocol_followup", label: "Protocol Follow-up" },
  { value: "device_session",    label: "Device Session" },
];
const PLANNED_TYPES = new Set(["protocol_followup", "device_session"]);

// Doctor slots and device slots share date/start/end/is_available; a device
// slot also carries capacity/remaining (it's counted, not a single lock).
type Slot = AvailabilitySlot & { capacity?: number; remaining?: number };

function fmtDay(d: string): string {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmt12(t: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Slot start as a local timestamp. The backend drops past slots and
 * rejects past bookings (scheduling/service.py _reject_if_past) — this only
 * hides slots that pass while the modal stays open. */
function slotStart(s: Slot): number {
  return new Date(`${s.date}T${s.start_time}`).getTime();
}

const fieldCls = "w-full h-[38px] px-3 rounded-lg border border-neutral-300 bg-white text-sm text-neutral-800 outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500";
const labelCls = "block text-xs font-medium text-neutral-700 mb-1.5";

export function ReceptionBookAppointmentModal({
  isOpen, clinicId, patients: patientsProp, prefill, initialPatient, onClose, onBooked,
}: {
  /** Opened from a patient's own page — start with that patient selected. */
  initialPatient?: PatientListItem | null;
  isOpen: boolean;
  clinicId: string;
  /** Pre-loaded clinic patients; fetched here if not supplied. */
  patients?: PatientListItem[];
  /** Opened from a slot on the doctor calendar — start on that doctor, date
   * and time (the time is picked once that day's slots load). */
  prefill?: { doctorId: string; date: string; startTime: string } | null;
  onClose: () => void;
  onBooked: () => void;
}) {
  const [patients, setPatients] = useState<PatientListItem[]>(patientsProp ?? []);
  const [doctors, setDoctors] = useState<DoctorListItem[]>([]);
  const [search, setSearch] = useState("");
  const [patient, setPatient] = useState<PatientListItem | null>(null);
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState(() => toDateStr(new Date()));
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [apptType, setApptType] = useState("initial");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Protocol follow-up / device session: the patient's doctor-scheduled
  // (planned) rows of that type from today on, and which one gets a time.
  const [planned, setPlanned] = useState<Appointment[]>([]);
  const [loadingPlanned, setLoadingPlanned] = useState(false);
  const [plannedId, setPlannedId] = useState("");
  // Re-evaluated every 30s so a slot that starts while the modal is open
  // drops out of the list instead of staying bookable.
  const [now, setNow] = useState(() => Date.now());
  // Set once the slot is booked (appointment now Awaiting Payment) — the
  // modal then switches to collecting payment for it.
  const [payingId, setPayingId] = useState<string | null>(null);
  // Start time from a calendar click, waiting for that day's slots to load.
  const pendingStart = useRef<string | null>(null);

  const todayStr = toDateStr(new Date(now));

  // Reset to a fresh form (today, no selections) each time it opens.
  useEffect(() => {
    if (!isOpen) return;
    const today = toDateStr(new Date());
    setSearch(""); setPatient(initialPatient ?? null); setSlot(null);
    setDate(prefill && prefill.date >= today ? prefill.date : today);
    setApptType("initial"); setReason(""); setError(null); setNow(Date.now());
    setPlanned([]); setPlannedId(""); setPayingId(null);
    pendingStart.current = prefill?.startTime ?? null;
    if (prefill) setDoctorId(prefill.doctorId);
    receptionService.getDoctors()
      .then(({ doctors: d }) => { setDoctors(d); setDoctorId((prev) => prefill?.doctorId || prev || d[0]?.id || ""); })
      .catch(() => setDoctors([]));
    // Only on open (or a new calendar slot) — a background patient-list
    // refresh mustn't wipe the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, prefill, initialPatient]);

  useEffect(() => { if (patientsProp) setPatients(patientsProp); }, [patientsProp]);

  // No preloaded list: search the server as the receptionist types (debounced,
  // first 8 matches) instead of downloading every clinic patient on open
  // (API audit F-021).
  useEffect(() => {
    if (patientsProp || !isOpen) return;
    const q = search.trim();
    if (!q) { setPatients([]); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      receptionService.getPatients({ search: q, pageSize: 8 })
        .then(({ patients: p }) => { if (!cancelled) setPatients(p); })
        .catch(() => {});
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [search, isOpen, patientsProp]);

  useEffect(() => {
    if (!isOpen) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [isOpen]);

  const isPlanned = PLANNED_TYPES.has(apptType);
  const isDevice = apptType === "device_session";
  const plannedAppt = planned.find((a) => a.appointment_id === plannedId) ?? null;

  // Default the doctor to the patient's assigned doctor, when they have one —
  // unless the receptionist came in from a specific doctor's calendar slot.
  useEffect(() => {
    if (prefill) return;
    if (patient?.doctor_id && doctors.some((d) => d.id === patient.doctor_id)) setDoctorId(patient.doctor_id);
  }, [patient, doctors, prefill]);

  // Load this patient's planned rows of the chosen type dated today or later
  // — an overdue one can't be booked from here (same-day only).
  useEffect(() => {
    setPlanned([]); setPlannedId("");
    if (!isOpen || !isPlanned || !patient) return;
    let cancelled = false;
    setLoadingPlanned(true);
    apiClient.get(ENDPOINTS.APPOINTMENTS.LIST, {
      params: { patient_id: patient.id, appointment_type: apptType, status: "planned", date_from: toDateStr(new Date()), limit: 100 },
    })
      .then(({ data }) => {
        if (cancelled) return;
        const rows: Appointment[] = (Array.isArray(data) ? data : [])
          .sort((a: Appointment, b: Appointment) =>
            a.appointment_date.localeCompare(b.appointment_date) || (a.session_number ?? 0) - (b.session_number ?? 0));
        setPlanned(rows);
        setPlannedId(rows[0]?.appointment_id ?? "");
      })
      .catch(() => { if (!cancelled) setPlanned([]); })
      .finally(() => { if (!cancelled) setLoadingPlanned(false); });
    return () => { cancelled = true; };
  }, [isOpen, isPlanned, apptType, patient]);

  // Locked to the planned follow-up's own day (and its doctor).
  useEffect(() => {
    if (isPlanned && plannedAppt) setDate(plannedAppt.appointment_date);
    if (!isPlanned) setDate((d) => (d < toDateStr(new Date()) ? toDateStr(new Date()) : d));
  }, [isPlanned, plannedAppt]);

  // appointments.doctor_id is a profile id; the availability route takes the
  // same doctor id the doctors list uses (doctor_public_id).
  const slotDoctorId = isPlanned ? (plannedAppt?.doctor_public_id ?? plannedAppt?.doctor_id ?? "") : doctorId;

  // Device session: that device's capacity calendar (the same one the
  // clinic's device schedule defines), never a doctor's.
  const deviceId = isDevice ? (plannedAppt?.clinic_device_id ?? "") : "";

  const fetchSlots = useCallback(async () => {
    if (!isOpen || !date || (isDevice ? !deviceId : !slotDoctorId)) { setSlots([]); return; }
    setLoadingSlots(true);
    try {
      const { data } = isDevice
        ? await apiClient.get(ENDPOINTS.CLINIC_DEVICE.AVAILABILITY(clinicId, deviceId), {
            params: { from_date: date, to_date: date },
          })
        : await apiClient.get(ENDPOINTS.SCHEDULE.SLOTS(slotDoctorId), {
            params: { from_date: date, to_date: date, include_unavailable: true },
          });
      setSlots(Array.isArray(data) ? data : []);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [isOpen, isDevice, deviceId, clinicId, slotDoctorId, date]);

  useEffect(() => { setSlot(null); fetchSlots(); }, [fetchSlots]);

  // Only upcoming times: anything already started today is dropped.
  const upcomingSlots = useMemo(() => slots.filter((s) => slotStart(s) > now), [slots, now]);

  // Pre-pick the clicked calendar slot once its day's slots are in (only if
  // it's still free and upcoming — otherwise the receptionist picks again).
  useEffect(() => {
    const want = pendingStart.current;
    if (!want || loadingSlots || isPlanned) return;
    // Wait until the loaded list is for the prefilled day — a fetch for the
    // previous doctor/date can land first.
    if (!slots.some((s) => s.date === date)) return;
    const match = upcomingSlots.find((s) => s.date === date && s.start_time.slice(0, 5) === want.slice(0, 5));
    pendingStart.current = null;
    if (match?.is_available) setSlot(match);
  }, [upcomingSlots, slots, loadingSlots, date, isPlanned]);

  // A picked slot that has since passed is un-picked.
  useEffect(() => {
    if (slot && slotStart(slot) <= now) setSlot(null);
  }, [slot, now]);

  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return patients
      .filter((p) => p.approval_status !== "pending" && p.approval_status !== "rejected")
      .filter((p) => `${p.full_name || `${p.first_name} ${p.last_name}`} ${p.mrn ?? ""} ${p.phone ?? ""}`.toLowerCase().includes(q))
      .slice(0, 8);
  }, [patients, search]);

  const canSubmit = !!patient && !!slot && !busy && (isPlanned ? !!plannedAppt : !!doctorId);

  const submit = async () => {
    if (!patient || !slot || (isPlanned ? !plannedAppt : !doctorId)) return;
    if (slotStart(slot) <= Date.now()) { setError("That time has already passed — pick an upcoming slot."); setSlot(null); return; }
    setBusy(true);
    setError(null);
    try {
      const { data: booked } = isPlanned && plannedAppt
        // Puts a time on the doctor's planned row in place (planned ->
        // awaiting payment) — the staff reschedule route handles planned
        // protocol-born rows that way. Same day only.
        ? await apiClient.patch<Appointment>(ENDPOINTS.APPOINTMENTS.RESCHEDULE(plannedAppt.appointment_id), {
            appointment_date: plannedAppt.appointment_date,
            start_time: slot.start_time,
            change_reason: reason.trim() || undefined,
          })
        : await apiClient.post<Appointment>(ENDPOINTS.APPOINTMENTS.LIST, {
            clinic_id: clinicId,
            patient_id: patient.id,
            doctor_id: doctorId,
            appointment_date: slot.date,
            start_time: slot.start_time,
            appointment_type: apptType,
            reason: reason.trim() || undefined,
          });
      // Booked = held, Awaiting Payment (same as a patient booking) — take
      // payment now. Only when the backend runs with payment switched off
      // does it land on 'paid' straight away, with nothing to collect.
      if (booked?.status === "selected") setPayingId(booked.appointment_id);
      else onBooked();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? e?.response?.data?.detail ?? e?.message ?? "Booking failed");
      fetchSlots();
    } finally {
      setBusy(false);
    }
  };

  const patientName = (p: PatientListItem) => p.full_name || `${p.first_name} ${p.last_name}`.trim();

  if (payingId) {
    // Any exit from here (paid, or "pay later") still refreshes the parent —
    // the appointment exists either way.
    return (
      <Modal isOpen={isOpen} onClose={onBooked} title="Collect Payment" className="max-w-lg">
        <StaffPaymentPanel appointmentId={payingId} onDone={onBooked} onCancel={onBooked} />
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Book Appointment" className="max-w-lg">
      <div className="space-y-4">
        {/* Patient */}
        <div>
          <label className={labelCls}>Patient <span className="text-red-500">*</span></label>
          {patient ? (
            <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              <span className="text-sm font-medium text-green-800">
                {patientName(patient)}
                {patient.mrn && <span className="text-green-600 font-normal ml-2 text-xs">({patient.mrn})</span>}
              </span>
              <button onClick={() => setPatient(null)} className="text-green-600 hover:text-green-800" aria-label="Change patient">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-[19px] -translate-y-1/2 w-3.5 h-3.5 text-neutral-400 pointer-events-none" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, MRN or phone…"
                className={`${fieldCls} pl-8`}
              />
              {search.trim() && (
                <div className="mt-1 border border-neutral-200 rounded-lg overflow-hidden max-h-48 overflow-y-auto bg-white shadow-dropdown">
                  {matches.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setPatient(p); setSearch(""); }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-50 border-b border-neutral-100 last:border-0 transition-colors"
                    >
                      <span className="font-medium text-neutral-800">{patientName(p)}</span>
                      {p.mrn && <span className="text-neutral-400 ml-2 text-xs">({p.mrn})</span>}
                      {p.phone && <span className="text-neutral-400 ml-2 text-xs">{p.phone}</span>}
                    </button>
                  ))}
                  {matches.length === 0 && <div className="px-3 py-2 text-sm text-neutral-400">No patients found</div>}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Type */}
          <div>
            <label className={labelCls}>Type of appointment <span className="text-red-500">*</span></label>
            <select value={apptType} onChange={(e) => { setApptType(e.target.value); setError(null); }} className={fieldCls}>
              {APPT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Doctor — fixed to the planned row's doctor; a device session has
              no doctor (a CA runs it), so show its device instead. */}
          <div>
            <label className={labelCls}>{isDevice ? "Device" : "Doctor"} <span className="text-red-500">*</span></label>
            {isDevice ? (
              <input
                disabled
                value={plannedAppt?.device_name ?? "—"}
                className={`${fieldCls} bg-neutral-50 text-neutral-500 cursor-not-allowed`}
              />
            ) : isPlanned ? (
              <input
                disabled
                value={plannedAppt?.doctor_name ? `Dr. ${plannedAppt.doctor_name}` : "—"}
                className={`${fieldCls} bg-neutral-50 text-neutral-500 cursor-not-allowed`}
              />
            ) : (
              <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className={fieldCls}>
                {doctors.length === 0 && <option value="">No doctors at this clinic</option>}
                {doctors.map((d) => <option key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name}</option>)}
              </select>
            )}
          </div>
        </div>

        {/* Protocol follow-up / device session — pick which scheduled one
            (from the treatment schedule) to give a time */}
        {isPlanned && (
          <div>
            <label className={labelCls}>
              {isDevice ? "Scheduled device session" : "Scheduled protocol follow-up"} <span className="text-red-500">*</span>
            </label>
            {!patient ? (
              <p className="text-sm text-neutral-400 py-2">Select a patient first.</p>
            ) : loadingPlanned ? (
              <div className="flex items-center gap-2 text-sm text-neutral-400 py-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading scheduled {isDevice ? "sessions" : "follow-ups"}…
              </div>
            ) : planned.length === 0 ? (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                No {isDevice ? "device session" : "protocol follow-up"} is scheduled for this patient from today on.
                The doctor schedules these from the treatment protocol.
              </p>
            ) : (
              <select value={plannedId} onChange={(e) => setPlannedId(e.target.value)} className={fieldCls}>
                {planned.map((a) => (
                  <option key={a.appointment_id} value={a.appointment_id}>
                    {fmtDay(a.appointment_date)}
                    {a.session_number ? ` · ${isDevice ? "Session" : "Follow-up"} #${a.session_number}` : ""}
                    {isDevice
                      ? (a.device_name ? ` · ${a.device_name}` : "")
                      : (a.doctor_name ? ` · Dr. ${a.doctor_name}` : "")}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Date — locked to the scheduled day for a planned session */}
        <div>
          <label className={labelCls}>Date <span className="text-red-500">*</span></label>
          <input
            type="date"
            value={date}
            min={todayStr}
            disabled={isPlanned}
            onChange={(e) => setDate(e.target.value && e.target.value < todayStr ? todayStr : e.target.value)}
            className={`${fieldCls} ${isPlanned ? "bg-neutral-50 text-neutral-500 cursor-not-allowed" : ""}`}
          />
          {isPlanned && plannedAppt && (
            <p className="text-xs text-neutral-400 mt-1">
              {isDevice ? "Device sessions" : "Protocol follow-ups"} can only be booked on their scheduled day.
            </p>
          )}
        </div>

        {/* Time */}
        <div>
          <label className={labelCls}>Time <span className="text-red-500">*</span></label>
          {isPlanned && !plannedAppt ? (
            <p className="text-sm text-neutral-400 py-2">Choose a scheduled {isDevice ? "session" : "follow-up"} first.</p>
          ) : loadingSlots ? (
            <div className="flex items-center gap-2 text-sm text-neutral-400 py-3">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading slots…
            </div>
          ) : upcomingSlots.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-neutral-400 py-3">
              <CalendarDays className="w-4 h-4" />
              {isPlanned
                ? `${date === todayStr ? "No upcoming slots left today" : "No open slots that day"} on the ${isDevice ? "device" : "doctor's"} calendar.`
                : date === todayStr ? "No upcoming slots left today — pick another date." : "No slots on this date — pick another date."}
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 max-h-44 overflow-y-auto">
              {upcomingSlots.map((s) => {
                const picked = slot?.start_time === s.start_time;
                return (
                  <button
                    key={s.start_time}
                    disabled={!s.is_available}
                    onClick={() => setSlot(s)}
                    title={
                      !s.is_available
                        ? (isDevice ? "Device fully booked" : "Already booked")
                        : `${fmt12(s.start_time)} – ${fmt12(s.end_time)}${isDevice && s.remaining != null ? ` · ${s.remaining} of ${s.capacity} free` : ""}`
                    }
                    className={`text-xs font-medium px-2 py-1.5 rounded-md border transition-colors ${
                      !s.is_available
                        ? "bg-neutral-100 text-neutral-400 border-neutral-200 line-through cursor-not-allowed"
                        : picked
                        ? "bg-primary-600 text-white border-primary-600"
                        : "bg-green-50 text-green-700 border-green-200 hover:bg-green-100"
                    }`}
                  >
                    {fmt12(s.start_time)}
                    {isDevice && s.is_available && s.remaining != null && (
                      <span className={`block text-[10px] ${picked ? "text-white/80" : "text-green-600/80"}`}>{s.remaining} free</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Reason */}
        <div>
          <label className={labelCls}>Reason <span className="text-neutral-400 font-normal">(optional)</span></label>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Headaches for 2 weeks" className={fieldCls} />
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white rounded-lg bg-brand-gradient hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {busy ? "Booking…" : "Book & Collect Payment"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
