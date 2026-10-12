"use client";

import { CalendarDays, Clock, User, Stethoscope, FileText, LogIn, PlayCircle, CheckCircle2 } from "lucide-react";
import { Modal } from "@/components/ui";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/appointmentStatus";
import type { Appointment } from "@/types/domain.types";

function fmt12(t?: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function fmtDate(d?: string | null): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Minutes between two ISO timestamps, or null if either is missing/invalid
 * — used for "waited 12 min before being seen" / "consult ran 22 min". */
function minutesBetween(startIso?: string | null, endIso?: string | null): number | null {
  if (!startIso || !endIso) return null;
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.round((end - start) / 60000);
}

function fmtSessionType(appointmentType?: string): string {
  if (!appointmentType) return "Session";
  return appointmentType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface DetailRowProps {
  icon?: React.ElementType;
  label: string;
  value: React.ReactNode;
}

function DetailRow({ icon: Icon, label, value }: DetailRowProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 gap-4">
      <span className="text-neutral-500 flex items-center gap-2 flex-shrink-0">
        {Icon && <Icon className="h-3.5 w-3.5 text-neutral-400" />}
        {label}
      </span>
      <span className="text-neutral-800 font-medium text-right">{value}</span>
    </div>
  );
}

/** Full detail view for one appointment — patient/doctor/schedule, notes,
 * and the visit timeline (checked_in_at/started_at/completed_at), shared
 * between clinic-admin's AppointmentsSection and receptionist's
 * ReceptionAppointmentsTable so both click-through to the same view. */
export function AppointmentDetailModal({
  appointment,
  isOpen,
  onClose,
}: {
  appointment: Appointment | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!appointment) return null;
  const a = appointment;

  const waitMinutes = minutesBetween(a.checked_in_at, a.started_at);
  const consultMinutes = minutesBetween(a.started_at, a.completed_at);
  const scheduledMinutes =
    a.start_time && a.end_time
      ? (() => {
          const [sh, sm] = a.start_time.split(":").map(Number);
          const [eh, em] = a.end_time.split(":").map(Number);
          const diff = eh * 60 + em - (sh * 60 + sm);
          return Number.isFinite(diff) && diff > 0 ? diff : null;
        })()
      : null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Appointment Details">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-base font-semibold text-neutral-900">{a.patient_name ?? "Unknown patient"}</p>
            <p className="text-xs text-neutral-400 mt-0.5">{fmtSessionType(a.appointment_type)}</p>
          </div>
          <div className="flex items-center gap-1.5">
            {/* rescheduled_from set means THIS row replaced an earlier one —
                distinct from status === 'rescheduled', which is the OLD,
                superseded row instead. Without this, a doctor/receptionist
                has no way to tell a moved appointment apart from a normally-
                booked one at the same status. */}
            {a.rescheduled_from && (
              <span
                title={a.rescheduled_from_date ? `Originally booked for ${fmtDate(a.rescheduled_from_date)} · ${fmt12(a.rescheduled_from_start_time)}` : undefined}
                className="text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap bg-purple-100 text-purple-700"
              >
                Rescheduled
              </span>
            )}
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${STATUS_TONE[a.status]}`}>
              {STATUS_LABEL[a.status]}
            </span>
          </div>
        </div>

        <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg overflow-hidden text-sm">
          {a.doctor_name && <DetailRow icon={Stethoscope} label="Doctor" value={`Dr. ${a.doctor_name}`} />}
          <DetailRow icon={CalendarDays} label="Scheduled Date" value={fmtDate(a.appointment_date)} />
          {a.start_time && (
            <DetailRow
              icon={Clock}
              label="Scheduled Time"
              value={a.end_time ? `${fmt12(a.start_time)} – ${fmt12(a.end_time)}` : fmt12(a.start_time)}
            />
          )}
          {scheduledMinutes != null && <DetailRow label="Slot Duration" value={`${scheduledMinutes} min`} />}
          {a.rescheduled_from && (
            <DetailRow
              label="Originally Booked For"
              value={
                a.rescheduled_from_date
                  ? `${fmtDate(a.rescheduled_from_date)} · ${fmt12(a.rescheduled_from_start_time)}`
                  : "—"
              }
            />
          )}
          <DetailRow icon={User} label="Booked By" value={`${a.booked_by_role.replace(/_/g, " ")}`} />
          {a.reason && <DetailRow icon={FileText} label="Reason" value={a.reason} />}
          {a.patient_complaint && <DetailRow label="Patient Complaint" value={a.patient_complaint} />}
          {a.notes && <DetailRow label="Notes" value={a.notes} />}
          {a.cancellation_reason && <DetailRow label="Cancellation Reason" value={a.cancellation_reason} />}
        </div>

        {/* Visit timeline — checked_in_at/started_at/completed_at only get
            set as the visit actually progresses (scheduling/repository.py's
            update_status), so each row is "—" until reached rather than
            hidden — that itself communicates where the visit currently is. */}
        <div>
          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Visit Timeline</h3>
          <div className="divide-y divide-neutral-100 border border-neutral-200 rounded-lg overflow-hidden text-sm">
            <DetailRow icon={LogIn} label="Checked In" value={fmtDateTime(a.checked_in_at)} />
            <DetailRow
              icon={PlayCircle}
              label="Consultation Started"
              value={
                <>
                  {fmtDateTime(a.started_at)}
                  {waitMinutes != null && <span className="text-neutral-400 font-normal"> (waited {waitMinutes} min)</span>}
                </>
              }
            />
            <DetailRow
              icon={CheckCircle2}
              label="Consultation Completed"
              value={
                <>
                  {fmtDateTime(a.completed_at)}
                  {consultMinutes != null && <span className="text-neutral-400 font-normal"> ({consultMinutes} min)</span>}
                </>
              }
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}
