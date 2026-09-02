import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { User } from "@/types/auth.types";

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

  // Profile page's form field names -> PatientSelfUpdate's column names.
  // Fields with no backing column on profiles/patients (government_id,
  // id_type, blood_group, allergies, insurance_provider, insurance_policy,
  // weight_kg, height_ft, height_in) have no server target yet and are
  // dropped here rather than silently no-op'd server-side.
  _FIELD_MAP: {
    full_name: null, // derived (first_name + last_name) — not a single column
    date_of_birth: "dob",
    address_line1: "address",
    emergency_contact: "emergency_contact_name",
  } as Record<string, string | null>,

  // PATCH /patients/{id}/self — patient self-edit. mrn, approval_status,
  // is_active, primary_doctor_id etc. stay staff-only (not accepted by this
  // route's PatientSelfUpdate schema).
  async updateProfile(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const SUPPORTED = new Set([
      "first_name", "last_name", "email", "phone", "gender", "dob", "address",
      "city", "state", "country", "pincode",
      "emergency_contact_name", "emergency_contact_phone",
    ]);
    const mapped: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (key === "full_name") {
        const [first_name, ...rest] = String(value).trim().split(/\s+/);
        if (first_name) mapped.first_name = first_name;
        if (rest.length) mapped.last_name = rest.join(" ");
        continue;
      }
      const mappedKey = this._FIELD_MAP[key] ?? key;
      if (SUPPORTED.has(mappedKey)) mapped[mappedKey] = value;
    }
    if (!Object.keys(mapped).length) return {};

    const me = await apiClient.get(ENDPOINTS.USERS.PROFILE);
    const patientId = me.data.patient_id;
    if (!patientId) throw new Error("No patient record for this account.");
    const { data } = await apiClient.patch(ENDPOINTS.USERS.PATIENT_SELF_UPDATE(patientId), mapped);
    return data;
  },
};
