import { API_BASE_URL, STORAGE_KEYS } from "@/lib/constants";

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

const RECONNECT_DELAY_MS = 5000;

/** One EventSource per logged-in session (Architecture Section 25.1).
 * Browser EventSource can't set an Authorization header, so the token
 * rides as a query param — the one endpoint on the backend that accepts
 * that (core/middleware.py's AuthContextMiddleware special-cases this
 * exact path).
 *
 * A dropped network connection is retried by the browser itself. An HTTP
 * error (401 once the token in the URL has expired) is not — the browser
 * closes the stream for good and live updates silently stop. So on CLOSED
 * this reopens with whatever token is current in storage. Returns a handle
 * rather than the EventSource, since the underlying source is replaced. */
export function openEventStream(token: string, onMessage: (msg: SSEMessage) => void): { close: () => void } {
  let source: EventSource;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const connect = (t: string) => {
    source = new EventSource(`${API_BASE_URL}/events/stream?token=${encodeURIComponent(t)}`);
    source.onmessage = (event) => {
      try {
        onMessage(JSON.parse(event.data) as SSEMessage);
      } catch {
        // malformed frame — never let one bad message kill the connection
      }
    };
    source.onerror = () => {
      if (stopped || source.readyState !== EventSource.CLOSED) return;
      timer = setTimeout(() => {
        const current = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
        if (!stopped && current) connect(current);
      }, RECONNECT_DELAY_MS);
    };
  };
  connect(token);

  return {
    close: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      source.close();
    },
  };
}
