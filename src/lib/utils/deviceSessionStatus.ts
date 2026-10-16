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
 *  - badge: solid pill (lists, calendar chips). Solid, not pale tints —
 *    pale -100 tints made blue/cyan (and other neighbours) look the same.
 *  - dot:   solid swatch (legend, filter buttons, mobile calendar)
 * Hues: dark slate, purple, bright cyan, green, red, yellow, light grey —
 * each differs from the rest in hue and/or lightness. */
export type SessionTone = { badge: string; dot: string };

const TONES = {
  upcoming: { badge: "bg-slate-800 text-white border-slate-800", dot: "bg-slate-800" },
  paid: { badge: "bg-purple-600 text-white border-purple-600", dot: "bg-purple-600" },
  in_progress: { badge: "bg-cyan-400 text-neutral-900 border-cyan-400", dot: "bg-cyan-400" },
  completed: { badge: "bg-green-600 text-white border-green-600", dot: "bg-green-600" },
  no_show: { badge: "bg-red-600 text-white border-red-600", dot: "bg-red-600" },
  not_booked: { badge: "bg-yellow-300 text-neutral-900 border-yellow-300", dot: "bg-yellow-300" },
  cancelled: { badge: "bg-neutral-200 text-neutral-600 border-neutral-300", dot: "bg-neutral-300" },
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
