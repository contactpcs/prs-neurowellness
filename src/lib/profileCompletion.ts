import type { User } from "@/types/auth.types";

export interface CompletionItem { key: string; label: string; done: boolean }

/** Same field weighting patient/profile lets them edit, plus the two
 * Cognito-mode channel-verification flags — kept in one place so the
 * dashboard bar and the profile page never drift on what "100%" means. */
export function computeProfileCompletion(user: User | null | undefined): { percent: number; items: CompletionItem[] } {
  if (!user) return { percent: 0, items: [] };

  const items: CompletionItem[] = [
    { key: "full_name",         label: "Full name",         done: !!(user.full_name || (user.first_name && user.last_name)) },
    { key: "date_of_birth",     label: "Date of birth",     done: !!user.date_of_birth },
    { key: "gender",            label: "Gender",            done: !!user.gender },
    { key: "phone",             label: "Phone number",      done: !!user.phone },
    { key: "address_line1",     label: "Address",           done: !!user.address_line1 },
    { key: "city",               label: "City",              done: !!user.city },
    { key: "state",              label: "State",             done: !!user.state },
    { key: "country",            label: "Country",           done: !!user.country },
    { key: "pincode",            label: "Pincode",           done: !!user.pincode },
    { key: "blood_group",        label: "Blood group",       done: !!user.blood_group },
    { key: "known_allergies",    label: "Allergies",         done: !!user.known_allergies },
    { key: "emergency_contact",  label: "Emergency contact", done: !!user.emergency_contact },
    { key: "occupation",         label: "Occupation",        done: !!user.occupation },
    { key: "insurance_provider", label: "Insurance provider", done: !!user.insurance_provider },
    { key: "email_verified",     label: "Email verified",    done: user.email_verified !== false },
    { key: "phone_verified",     label: "Mobile verified",   done: user.phone_verified !== false },
  ];

  const done = items.filter((i) => i.done).length;
  return { percent: Math.round((done / items.length) * 100), items };
}
