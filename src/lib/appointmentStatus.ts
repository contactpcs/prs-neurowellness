import type { AppointmentStatus } from "@/types/domain.types";

// Single source of truth for how an appointment status renders — label,
// badge tone, and dot color. Used to be duplicated across ~11 files (doctor
// list/detail, reception table, admin sections, patient dashboard/list),
// each with its own copy of the legacy scheduled/confirmed vocabulary.

export const APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "planned", "selected", "paid", "checked_in", "in_progress",
  "completed", "cancelled", "no_show", "rescheduled",
];

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  planned: "Planned",
  selected: "Awaiting Payment",
  paid: "Paid",
  checked_in: "Checked In",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
  rescheduled: "Rescheduled",
};

// Tailwind classes for a text/background badge — theme tokens where they
// exist (success/warning/danger), neutral for terminal/inactive states.
export const STATUS_TONE: Record<AppointmentStatus, string> = {
  planned: "bg-neutral-100 text-neutral-700",
  selected: "bg-warning-100 text-warning-700",
  paid: "bg-success-100 text-success-700",
  checked_in: "bg-primary-100 text-primary-700",
  in_progress: "bg-primary-100 text-primary-700",
  completed: "bg-success-100 text-success-700",
  cancelled: "bg-danger-100 text-danger-700",
  no_show: "bg-danger-100 text-danger-700",
  rescheduled: "bg-neutral-100 text-neutral-700",
};

// Small-dot color variant (hex) for calendar/list views that render a dot
// instead of a full badge.
export const STATUS_DOT: Record<AppointmentStatus, string> = {
  planned: "#a3a3a3",
  selected: "#f59e0b",
  paid: "#22c55e",
  checked_in: "#0ea5e9",
  in_progress: "#0ea5e9",
  completed: "#16a34a",
  cancelled: "#ef4444",
  no_show: "#ef4444",
  rescheduled: "#a3a3a3",
};

export const ACTIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "planned", "selected", "paid", "checked_in", "in_progress",
];
