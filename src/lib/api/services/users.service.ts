import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { User } from "@/types/auth.types";

export class NoSupportedFieldsError extends Error {}

export const usersService = {
  // Patient self-profile — GET /auth/me only carries identity fields (no
  // dob/address/city/etc), so this fetches the full patient record via
  // GET /patients/{patient_id} instead (patient_id comes off the logged-in
  // user, set on every /auth/me call — see auth.types.ts).
  async getProfile(): Promise<Record<string, unknown>> {
    const me = await apiClient.get(ENDPOINTS.USERS.PROFILE);
    const patientId = me.data.patient_id;
    if (!patientId) return me.data;
    const { data } = await apiClient.get(ENDPOINTS.DOCTORS.PATIENT(patientId));
    return data;
  },

  async updateProfile(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const mapped: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (key === "full_name") {
        const [first_name, ...rest] = String(value).trim().split(/\s+/);
        if (first_name) mapped.first_name = first_name;
        if (rest.length) mapped.last_name = rest.join(" ");
        continue;
      }
      const mappedKey = FIELD_MAP[key] ?? key;
      if (SUPPORTED_UPDATE_FIELDS.has(mappedKey)) mapped[mappedKey] = value;
    }
    // Every changed field the caller sent has no backing DB column (e.g.
    // only weight_kg/blood_group/occupation were edited) — there is nothing
    // to PATCH. Returning {} here used to be treated by callers as "here is
    // your updated profile", which blanked the whole form when they merged
    // it in. Throw instead so the caller can tell "nothing changed" apart
    // from "here is fresh (empty) data".
    if (!Object.keys(mapped).length) {
      throw new NoSupportedFieldsError(
        "None of the changed fields can be saved yet — this needs a database change."
      );
    }

    const me = await apiClient.get(ENDPOINTS.USERS.PROFILE);
    const patientId = me.data.patient_id;
    if (!patientId) throw new Error("No patient record for this account.");
    const { data } = await apiClient.patch(ENDPOINTS.USERS.PATIENT_SELF_UPDATE(patientId), mapped);
    // response_model=PatientRead always carries these — if the server ever
    // sends back something else (a proxy error page, a shape change), fail
    // loudly here instead of letting the caller blank out a form that had
    // real data in it a moment ago.
    if (!data || typeof data !== "object" || !("patient_id" in data)) {
      throw new Error("Unexpected response while saving your profile — please try again.");
    }
    return data;
  },
};

// Profile page's form field names -> PatientSelfUpdate's column names.
// Fields with no backing column on profiles/patients (government_id,
// id_type, blood_group, allergies, insurance_provider, insurance_policy,
// weight_kg, height_ft, height_in) have no server target yet and are
// dropped here rather than silently no-op'd server-side.
const FIELD_MAP: Record<string, string | null> = {
  full_name: null, // derived (first_name + last_name) — not a single column
  date_of_birth: "dob",
  address_line1: "address",
  emergency_contact: "emergency_contact_name",
};

const SUPPORTED_UPDATE_FIELDS = new Set([
  "first_name", "last_name", "email", "phone", "gender", "dob", "address",
  "city", "state", "country", "pincode",
  "emergency_contact_name", "emergency_contact_phone",
  "language_pref", "blood_group", "allergies", "occupation", "marital_status",
  "insurance_provider", "insurance_policy", "weight_kg", "height_ft", "height_in",
  "government_id", "id_type",
]);
