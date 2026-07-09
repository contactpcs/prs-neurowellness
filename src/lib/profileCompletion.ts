export interface CompletionItem { key: string; label: string; done: boolean }

/** patient is backend PatientRead-shaped (dob/address/city/state/country/
 * pincode/phone/gender) — GET /auth/me deliberately doesn't carry these
 * (identity fields only), so callers must fetch the real patient record
 * (GET /patients/{patient_id}) and pass it here, not the auth user object.
 * verified flags DO come off /auth/me (CurrentUserRead has them) since
 * that's the one place they're accurate. Kept in one place so the
 * dashboard card and the profile page never drift on what "100%" means. */
export function computeProfileCompletion(
  patient: Record<string, unknown> | null | undefined,
  verified?: { email_verified?: boolean; phone_verified?: boolean },
): { percent: number; items: CompletionItem[] } {
  if (!patient) return { percent: 0, items: [] };
  const p = patient as Record<string, string | undefined>;

  const items: CompletionItem[] = [
    { key: "full_name",     label: "Full name",     done: !!(p.full_name || (p.first_name && p.last_name)) },
    { key: "dob",           label: "Date of birth", done: !!(p.dob ?? p.date_of_birth) },
    { key: "gender",        label: "Gender",        done: !!p.gender },
    { key: "phone",         label: "Phone number",  done: !!p.phone },
    { key: "address",       label: "Address",       done: !!(p.address ?? p.address_line1) },
    { key: "city",          label: "City",          done: !!p.city },
    { key: "state",         label: "State",         done: !!p.state },
    { key: "country",       label: "Country",       done: !!p.country },
    { key: "pincode",       label: "Pincode",       done: !!p.pincode },
    { key: "email_verified", label: "Email verified",  done: verified?.email_verified !== false },
    { key: "phone_verified", label: "Mobile verified", done: verified?.phone_verified !== false },
  ];

  const done = items.filter((i) => i.done).length;
  return { percent: Math.round((done / items.length) * 100), items };
}
