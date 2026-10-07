export interface CompletionItem { key: string; label: string; done: boolean }

/** patient is backend PatientRead-shaped (dob/address/city/state/country/
 * pincode/phone/gender/blood_group/allergies/occupation/marital_status/
 * insurance_provider/insurance_policy/weight_kg/height_ft/height_in/
 * government_id/id_type/emergency_contact_name) — GET /auth/me deliberately
 * doesn't carry these (identity fields only), so callers must fetch the
 * real patient record (GET /patients/{patient_id}) and pass it here, not
 * the auth user object. verified flags DO come off /auth/me
 * (CurrentUserRead has them) since that's the one place they're accurate.
 * Kept in one place so the dashboard card and the profile page never drift
 * on what "100%" means — every caller MUST pass the same `verified` arg
 * (both flags default to "done" when omitted, which silently inflates the
 * result if one caller forgets it — see dashboard/page.tsx). */
export function computeProfileCompletion(
  patient: Record<string, unknown> | null | undefined,
  verified?: { email_verified?: boolean; phone_verified?: boolean },
): { percent: number; items: CompletionItem[] } {
  if (!patient) return { percent: 0, items: [] };
  const p = patient as Record<string, string | number | undefined>;

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
    { key: "emergency_contact_name", label: "Emergency contact", done: !!(p.emergency_contact_name ?? p.emergency_contact) },
    { key: "blood_group",        label: "Blood group",        done: !!p.blood_group },
    { key: "allergies",          label: "Allergies",          done: !!p.allergies },
    { key: "occupation",         label: "Occupation",         done: !!p.occupation },
    { key: "marital_status",     label: "Marital status",     done: !!p.marital_status },
    { key: "insurance_provider", label: "Insurance provider", done: !!p.insurance_provider },
    { key: "insurance_policy",   label: "Insurance policy",   done: !!p.insurance_policy },
    { key: "weight_kg",          label: "Weight",              done: p.weight_kg !== undefined && p.weight_kg !== null && p.weight_kg !== "" },
    { key: "height_ft",          label: "Height",               done: p.height_ft !== undefined && p.height_ft !== null && p.height_ft !== "" },
    { key: "government_id",      label: "Government ID",       done: !!p.government_id },
    { key: "id_type",            label: "Government ID type",  done: !!p.id_type },
    { key: "email_verified", label: "Email verified",  done: verified?.email_verified === true },
    { key: "phone_verified", label: "Mobile verified", done: verified?.phone_verified === true },
  ];

  const done = items.filter((i) => i.done).length;
  return { percent: Math.round((done / items.length) * 100), items };
}
