import { API_BASE_URL } from "@/lib/constants";

/** Matches the relay's publish payload (app/workers/event_relay.py::
 * _process_event) — a slice of the real notifications row, not the full
 * NotificationRead shape (no recipient_id/entity_type/created_at — the
 * stream is push-only, the bell's own GET /notifications is still the
 * source of truth for anything beyond "something happened, go refresh"). */
export interface SSEMessage {
  type: string;
  title: string;
  body: string | null;
  notification_id: string;
}

/** One EventSource per logged-in session (Architecture Section 25.1).
 * Browser EventSource can't set an Authorization header, so the token
 * rides as a query param — the one endpoint on the backend that accepts
 * that (core/middleware.py's AuthContextMiddleware special-cases this
 * exact path). Reconnection on a dropped connection is the browser's own
 * built-in EventSource retry — no manual backoff needed here. */
export function openEventStream(token: string, onMessage: (msg: SSEMessage) => void): EventSource {
  const source = new EventSource(`${API_BASE_URL}/events/stream?token=${encodeURIComponent(token)}`);
  source.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data) as SSEMessage);
    } catch {
      // malformed frame — never let one bad message kill the connection
    }
  };
  return source;
}
