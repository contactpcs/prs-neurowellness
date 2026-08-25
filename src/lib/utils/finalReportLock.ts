// Whether a Final Report has been generated for a given clinical session —
// there's no backend field for this, so it's tracked client-side the same
// way eeg_analysis_job_${id} is (see doctor patient workspace page). Once
// set, the Treatment Plan for that stage is locked even if it's still the
// most recent session (i.e. before a follow-up has started).
const KEY_PREFIX = "final_report_generated_";

export function isFinalReportGenerated(appointmentId?: string | null): boolean {
  if (!appointmentId || typeof window === "undefined") return false;
  return localStorage.getItem(KEY_PREFIX + appointmentId) === "1";
}

export function markFinalReportGenerated(appointmentId?: string | null): void {
  if (!appointmentId || typeof window === "undefined") return;
  localStorage.setItem(KEY_PREFIX + appointmentId, "1");
}
