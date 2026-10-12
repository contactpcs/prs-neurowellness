/**
 * Batches per-answer autosaves into one request per window (API audit
 * F-040/F-041). Every answer is still queued the moment it's given; the
 * queue for a record (PRS instance / anamnesis) goes out as ONE request at
 * most `windowMs` later, immediately when the tab is hidden or closed
 * (keepalive request), and is merged into the record's final submit so the
 * answers and the finalize land together. Re-answering a question inside a
 * window keeps only the latest value. Each caller's promise settles with the
 * request that actually carried its answer, so callers that track failures
 * per answer keep working.
 *
 * ponytail: power/OS crash can lose at most the last window of answers.
 * Upgrade path: mirror the queue to sessionStorage and resend on reopen.
 */

type Waiter = { resolve: () => void; reject: (err: unknown) => void };
type Entry<T> = { item: T; waiters: Waiter[] };

export function createSaveBatcher<T>(opts: {
  windowMs: number;
  /** Identity inside one record — same id = same question, latest wins. */
  idOf: (item: T) => string;
  send: (key: string, items: T[], keepalive: boolean) => Promise<void>;
}) {
  const queues = new Map<string, Map<string, Entry<T>>>();
  const inflight = new Map<string, Promise<void>>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const settle = (entries: Entry<T>[], err?: unknown) =>
    entries.forEach((e) => e.waiters.forEach((w) => (err === undefined ? w.resolve() : w.reject(err))));

  const takeEntries = (key: string): Entry<T>[] => {
    const q = queues.get(key);
    queues.delete(key);
    return q ? [...q.values()] : [];
  };

  function flushKey(key: string, keepalive = false): Promise<void> {
    const entries = takeEntries(key);
    if (entries.length === 0) return inflight.get(key) ?? Promise.resolve();
    const prev = inflight.get(key) ?? Promise.resolve();
    // Chained per record so batches for one record reach the server in order.
    const p = prev
      .catch(() => {})
      .then(() => opts.send(key, entries.map((e) => e.item), keepalive))
      .then(() => settle(entries), (err) => settle(entries, err));
    inflight.set(key, p);
    p.finally(() => { if (inflight.get(key) === p) inflight.delete(key); });
    return p;
  }

  function flushAll(keepalive = false): Promise<void> {
    if (timer) { clearTimeout(timer); timer = null; }
    return Promise.all([...queues.keys()].map((k) => flushKey(k, keepalive))).then(() => {});
  }

  function enqueue(key: string, item: T): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const q = queues.get(key) ?? new Map<string, Entry<T>>();
      queues.set(key, q);
      const id = opts.idOf(item);
      const existing = q.get(id);
      if (existing) {
        existing.item = item;
        existing.waiters.push({ resolve, reject });
      } else {
        q.set(id, { item, waiters: [{ resolve, reject }] });
      }
      if (!timer) timer = setTimeout(() => { timer = null; void flushAll(); }, opts.windowMs);
    });
  }

  /** For a record's final submit: waits for any batch already on the wire,
   * then hands back the still-queued items to include in that request.
   * Call done() / done(err) once the submit request finishes. */
  async function drain(key: string): Promise<{ items: T[]; done: (err?: unknown) => void }> {
    await (inflight.get(key) ?? Promise.resolve()).catch(() => {});
    const entries = takeEntries(key);
    return { items: entries.map((e) => e.item), done: (err?: unknown) => settle(entries, err) };
  }

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", () => { void flushAll(true); });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") void flushAll(true);
    });
  }

  return { enqueue, drain, flushAll };
}
