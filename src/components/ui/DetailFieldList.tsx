"use client";

const HIDDEN_KEYS = new Set(["id"]);

function humanizeKey(key: string): string {
  return key
    .replace(/_id$/, " ID")
    .replace(/_at$/, " At")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}(T|$)/.test(value)) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return key.endsWith("_at")
        ? d.toLocaleString()
        : d.toLocaleDateString();
    }
  }
  if (Array.isArray(value)) return value.length ? value.map(String).join(", ") : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Dumps every key on the given object as a label/value row — used for the
 * "show everything in the DB" detail views (staff/patients/clinics/regions/
 * admins) so a raw API response doesn't need per-field mapping to display. */
export function DetailFieldList({ data, exclude = [] }: { data: object; exclude?: string[] }) {
  const excluded = new Set([...HIDDEN_KEYS, ...exclude]);
  const entries = Object.entries(data as Record<string, unknown>).filter(([k]) => !excluded.has(k));
  if (entries.length === 0) return null;
  return (
    <div className="divide-y divide-neutral-100 border border-neutral-100 rounded-lg overflow-hidden">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
          <span className="text-neutral-500 flex-shrink-0">{humanizeKey(key)}</span>
          <span className="text-neutral-800 font-medium text-right break-words">{formatValue(key, value)}</span>
        </div>
      ))}
    </div>
  );
}
