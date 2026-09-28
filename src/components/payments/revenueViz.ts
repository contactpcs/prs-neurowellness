import type { RevenueGroupBy } from "@/lib/api/services/payments.service";

// Validated categorical palette (dataviz reference instance, light surface):
// passes lightness band, chroma floor, adjacent CVD ΔE ≥ 9.1, normal-vision
// ΔE ≥ 19.6. Slots 3/4/5 are below 3:1 contrast, so every value is also shown
// as text (legend totals, tooltips, table view) — never color alone.
export const SERIES_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#4a3aa7"];

// Color follows the entity, not its rank: each service type owns a slot, so a
// type keeps its color whatever else is (or isn't) in the current range.
const PURPOSE_ORDER = ["initial", "follow_up", "protocol_followup", "device_session"];

const PURPOSE_LABELS: Record<string, string> = {
  initial: "Initial consultation",
  follow_up: "Follow-up",
  protocol_followup: "Protocol follow-up",
  device_session: "Device session",
  other: "Other",
};

export function purposeLabel(purpose: string): string {
  return PURPOSE_LABELS[purpose] ?? purpose.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** Known types in fixed order, then any others (store order types…) alphabetically. */
export function sortPurposes(purposes: string[]): string[] {
  const known = PURPOSE_ORDER.filter((p) => purposes.includes(p));
  const rest = purposes.filter((p) => !PURPOSE_ORDER.includes(p)).sort();
  return [...known, ...rest];
}

export function purposeColor(purpose: string, allPurposes: string[]): string {
  const known = PURPOSE_ORDER.indexOf(purpose);
  if (known >= 0) return SERIES_COLORS[known];
  const extras = allPurposes.filter((p) => !PURPOSE_ORDER.includes(p)).sort();
  // ponytail: 2 spare slots for non-appointment types; past that they share slot 6.
  return SERIES_COLORS[Math.min(PURPOSE_ORDER.length + extras.indexOf(purpose), SERIES_COLORS.length - 1)];
}

export function fmtMoney(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

/** Axis-tick style: ₹0, ₹500, ₹12K, ₹1.2L, ₹3.4Cr (Indian units). */
export function fmtMoneyCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${+(n / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `₹${+(n / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `₹${+(n / 1e3).toFixed(1)}K`;
  return `₹${Math.round(n)}`;
}

/** Calendar key in the viewer's local time — the same day the DB bucketed,
 * whether the DB session runs in UTC or IST. */
export function periodKey(period: string | Date): string {
  const d = typeof period === "string" ? new Date(period) : period;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Continuous run of period keys from first to last, so empty days/weeks show
 * as a gap on the axis instead of silently disappearing. */
export function fillPeriods(keys: string[], groupBy: RevenueGroupBy, max = 400): string[] {
  if (keys.length === 0) return [];
  const sorted = [...keys].sort();
  const [fy, fm, fd] = sorted[0].split("-").map(Number);
  const last = sorted[sorted.length - 1];
  const out: string[] = [];
  for (let i = 0; out.length < max; i++) {
    const d =
      groupBy === "day" ? new Date(fy, fm - 1, fd + i)
      : groupBy === "week" ? new Date(fy, fm - 1, fd + 7 * i)
      : groupBy === "month" ? new Date(fy, fm - 1 + i, fd)
      : new Date(fy + i, fm - 1, fd);
    const k = periodKey(d);
    if (k > last) break;
    out.push(k);
  }
  return out;
}

export function fmtPeriod(key: string, groupBy: RevenueGroupBy, long = false): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (groupBy === "year") return String(y);
  if (groupBy === "month") return date.toLocaleDateString("en-IN", { month: long ? "long" : "short", year: long ? "numeric" : "2-digit" });
  if (groupBy === "week") return `${long ? "Week of " : ""}${date.toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(long ? { year: "numeric" } : {}) })}`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", ...(long ? { year: "numeric" } : {}) });
}

/** Clean y-axis ticks: 0 and ~4 round steps covering max. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw) ?? 10 * mag;
  const ticks: number[] = [];
  for (let v = 0; v < max + step * 0.999; v += step) ticks.push(v);
  return ticks;
}
