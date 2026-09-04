// Device sessions are appointments (appointment_type "device_session" /
// "protocol_followup"), so they share the real AppointmentStatus vocabulary
// — never the prototype's made-up "scheduled"/"missed" values. "Not yet
// started" covers every pre-session state: booked but the CA hasn't checked
// the patient in or begun stimulation yet.
const NOT_STARTED = new Set(["planned", "selected", "paid", "checked_in"]);
const FINISHED = new Set(["completed", "cancelled", "no_show"]);

export function isSessionFinished(status?: string | null): boolean {
  return !!status && FINISHED.has(status);
}

export function deviceSessionLabel(status?: string | null): string {
  if (!status || NOT_STARTED.has(status)) return "Not yet started";
  if (status === "in_progress") return "In Progress";
  if (status === "completed") return "Completed";
  if (status === "no_show") return "Missed";
  if (status === "cancelled") return "Cancelled";
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function deviceSessionTone(status?: string | null): string {
  if (!status || NOT_STARTED.has(status)) return "bg-neutral-100 text-neutral-500";
  if (status === "in_progress") return "bg-primary-50 text-primary-700";
  if (status === "completed") return "bg-green-50 text-green-700";
  if (status === "no_show") return "bg-red-50 text-red-700";
  return "bg-neutral-100 text-neutral-600";
}
