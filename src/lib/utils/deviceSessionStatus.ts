// Device sessions are appointments (appointment_type "device_session" /
// "protocol_followup"), so they share the real AppointmentStatus vocabulary
// — never the prototype's made-up "scheduled"/"missed" values. "Not yet
// started" covers every pre-session state: booked but the CA hasn't checked
// the patient in or begun stimulation yet.
const NOT_STARTED = new Set(["planned", "selected", "paid", "checked_in"]);
const FINISHED = new Set(["completed", "cancelled", "no_show", "missed"]);

export function isSessionFinished(status?: string | null): boolean {
  return !!status && FINISHED.has(status);
}

/** Staff label. "Paid" and the two kinds of miss get their own label (and
 * colour) — no_show = a slot was booked but not attended; missed = the date
 * passed with no slot ever booked. */
export function deviceSessionLabel(status?: string | null): string {
  if (status === "paid") return "Paid";
  if (!status || NOT_STARTED.has(status)) return "Not yet started";
  if (status === "in_progress") return "In Progress";
  if (status === "completed") return "Completed";
  if (status === "no_show") return "No-Show";
  if (status === "missed") return "Not Booked";
  if (status === "cancelled") return "Cancelled";
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Patient-facing label — same as staff, except pre-session states read
 * "Upcoming" to match the patient page's filter name. */
export function patientDeviceSessionLabel(status?: string | null): string {
  if (status !== "paid" && (!status || NOT_STARTED.has(status))) return "Upcoming";
  return deviceSessionLabel(status);
}

/** One colour per status bucket, shared by list badges, calendar chips, the
 * calendar legend and the filter buttons so they always agree.
 *  - badge: pale-tint pill (lists, calendar chips); its border-* colour is the
 *    calendar chip / patient card stripe
 *  - dot:   solid swatch (legend, filter buttons, mobile calendar)
 * Hues: slate, purple, cyan, green, red, yellow — each a separate hue family.
 * Cancelled is outlined white rather than tinted, since a pale slate tint
 * already reads as grey. */
export type SessionTone = { badge: string; dot: string };

const TONES = {
  upcoming: { badge: "bg-slate-200 text-slate-800 border-slate-700", dot: "bg-slate-700" },
  paid: { badge: "bg-purple-100 text-purple-800 border-purple-500", dot: "bg-purple-500" },
  in_progress: { badge: "bg-cyan-100 text-cyan-800 border-cyan-500", dot: "bg-cyan-500" },
  completed: { badge: "bg-green-100 text-green-800 border-green-500", dot: "bg-green-500" },
  no_show: { badge: "bg-red-100 text-red-800 border-red-500", dot: "bg-red-500" },
  not_booked: { badge: "bg-yellow-100 text-yellow-800 border-yellow-400", dot: "bg-yellow-400" },
  cancelled: { badge: "bg-white text-neutral-500 border border-neutral-300", dot: "bg-neutral-300" },
} satisfies Record<string, SessionTone>;

type ToneKey = keyof typeof TONES;

// Doctor and patient portals share one palette.
function toneKey(status: string | null | undefined): ToneKey {
  if (status === "paid") return "paid";
  if (!status || NOT_STARTED.has(status)) return "upcoming";
  if (status === "in_progress") return "in_progress";
  if (status === "completed") return "completed";
  if (status === "no_show") return "no_show";
  if (status === "missed") return "not_booked";
  return "cancelled";
}

export function deviceSessionColors(status?: string | null): SessionTone {
  return TONES[toneKey(status)];
}

export function patientDeviceSessionColors(status?: string | null): SessionTone {
  return TONES[toneKey(status)];
}

export function deviceSessionTone(status?: string | null): string {
  return deviceSessionColors(status).badge;
}

export function patientDeviceSessionTone(status?: string | null): string {
  return patientDeviceSessionColors(status).badge;
}

/** Solid swatch for a filter button keyed by its status bucket. */
export const SESSION_FILTER_DOT: Record<string, string> = {
  upcoming: TONES.upcoming.dot,
  not_started: TONES.upcoming.dot,
  paid: TONES.paid.dot,
  in_progress: TONES.in_progress.dot,
  completed: TONES.completed.dot,
  no_show: TONES.no_show.dot,
  not_booked: TONES.not_booked.dot,
  cancelled: TONES.cancelled.dot,
};
