import type { Notification } from "@/types/domain.types";

/** Where a notification should take the patient when tapped, or null if it
 * carries no actionable destination. The backend attaches a `metadata` bag to
 * assessment / device-session notifications; we read the ids out of it rather
 * than parsing the human-readable message. `notifications.service.ts` passes
 * `metadata` through unchanged — historically it was dropped, so older rows and
 * SSE pushes may still have none, hence every field is treated as optional. */
export function patientNotificationHref(n: Notification): string | null {
  const meta = n.metadata ?? {};
  const str = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;

  const appointmentId = str(meta.appointment_id) ?? str(meta.device_session_appointment_id);
  const protocolScaleId = str(meta.protocol_scale_id) ?? str(meta.session_scale_id);
  const scaleCode = str(meta.scale_code);

  // Assessment pushed to the patient for a specific device session — open that
  // session and highlight the assessment card.
  if (appointmentId && (protocolScaleId || scaleCode || /assessment|scale|prs/i.test(n.type))) {
    const params = new URLSearchParams();
    if (protocolScaleId) params.set("assessment", protocolScaleId);
    if (scaleCode) params.set("scale_code", scaleCode);
    const qs = params.toString();
    return `/patient/device-sessions/${appointmentId}${qs ? `?${qs}` : ""}`;
  }

  // Any other device-session notification with just an appointment id.
  if (appointmentId) return `/patient/device-sessions/${appointmentId}`;

  // A bare assessment permission (not tied to a device session).
  const permissionId = str(meta.permission_id) ?? str(meta.patient_scale_assignment_id);
  if (permissionId && /assessment|scale|prs/i.test(n.type)) {
    return `/patient/assessment/${permissionId}`;
  }

  return null;
}
