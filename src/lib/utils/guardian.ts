// Under-18 patients must have guardian details (name, relationship, contact).
// Mirrors _is_minor() in backend patients/service.py, which enforces the same
// rule server-side — this only drives the forms.

export const GUARDIAN_RELATION_OPTIONS = [
  { value: "parent", label: "Parent" },
  { value: "spouse", label: "Spouse" },
  { value: "sibling", label: "Sibling" },
  { value: "child", label: "Child" },
  { value: "legal_guardian", label: "Legal Guardian" },
  { value: "other", label: "Other" },
];

/** Age in whole years from a YYYY-MM-DD date, or null if unparseable. */
export function ageFromDob(dob: string | undefined | null): number | null {
  if (!dob) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const today = new Date();
  let age = today.getFullYear() - y;
  const beforeBirthday = today.getMonth() + 1 < mo || (today.getMonth() + 1 === mo && today.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

export function isMinor(dob: string | undefined | null): boolean {
  const age = ageFromDob(dob);
  // age < 0 = future date (half-typed or invalid DOB), not a minor.
  return age !== null && age >= 0 && age < 18;
}
