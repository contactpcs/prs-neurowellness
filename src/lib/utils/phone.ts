// Mobile numbers are entered as exactly 10 digits (no country code, spaces or
// dashes) — the country code is picked separately and prefixed on submit.

export const MOBILE_DIGITS = 10;
export const MOBILE_ERROR = "Enter a valid 10-digit mobile number";

/** Strips everything but digits and caps at 10 — use in input onChange. */
export function toMobileDigits(v: string): string {
  return v.replace(/\D/g, "").slice(0, MOBILE_DIGITS);
}

export function isValidMobile(v: string | undefined | null): boolean {
  return /^\d{10}$/.test(v ?? "");
}
