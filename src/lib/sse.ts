import apiClient from "@/lib/api/client";
import { ENDPOINTS } from "@/lib/api/endpoints";
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

const RECONNECT_MIN_MS = 5_000;
const RECONNECT_MAX_MS = 60_000;

/** One live stream per logged-in session (Architecture Section 25.1).
 *
 * A browser EventSource can't send an Authorization header, so the stream is
 * opened with a ONE-TIME TICKET (POST /events/ticket, an ordinary
 * authenticated call) instead of the access token — the token never appears
 * in a URL, and with it in access logs, proxy logs or browser history. A
 * ticket dies on first use, so the browser's own built-in reconnect (which
 * would replay the same URL) can't work; on any drop this closes the source,
 * asks for a fresh ticket and reconnects itself. That also means an expired
 * access token is renewed by the ordinary request path (client.ts) on the way,
 * instead of live updates silently stopping until the page is reloaded.
 *
 * Backs off from 5 s to 60 s while the server can't be reached (Redis down
 * answers the ticket call with 503). Returns a handle rather than the
 * EventSource, since the underlying source is replaced on every reconnect. */
export function openEventStream(onMessage: (msg: SSEMessage) => void): { close: () => void } {
  let source: EventSource | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let delay = RECONNECT_MIN_MS;

  const scheduleReconnect = () => {
    if (stopped) return;
    timer = setTimeout(connect, delay);
    delay = Math.min(delay * 2, RECONNECT_MAX_MS);
  };

  async function connect() {
    if (stopped) return;
    try {
      const { data } = await apiClient.post(ENDPOINTS.LIVE.TICKET);
      if (stopped) return;
      const es = new EventSource(`${API_BASE_URL}${ENDPOINTS.LIVE.STREAM}?ticket=${encodeURIComponent(data.ticket)}`);
      source = es;
      es.onopen = () => {
        delay = RECONNECT_MIN_MS;
        console.info("[live] connected — popups active");
      };
      es.onmessage = (event) => {
        try {
          onMessage(JSON.parse(event.data) as SSEMessage);
        } catch {
          // malformed frame — never let one bad message kill the connection
        }
      };
      es.onerror = () => {
        console.warn(`[live] stream dropped — reconnecting in ${Math.round(delay / 1000)}s`);
        es.close();
        if (source === es) source = null;
        scheduleReconnect();
      };
    } catch (err) {
      // 503 = backend can't reach Redis; 401 = session expired (client.ts renews it).
      const status = (err as { response?: { status?: number } })?.response?.status;
      console.warn(`[live] no stream ticket (HTTP ${status ?? "network error"}) — retrying in ${Math.round(delay / 1000)}s`);
      scheduleReconnect();
    }
  }

  void connect();

  return {
    close: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      source?.close();
    },
  };
}
