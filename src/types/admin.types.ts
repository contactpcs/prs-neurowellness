// ─── Admin Dashboard ──────────────────────────────────────────────
// Actual API shape: { data: { stats: {...}, clinic_breakdown: [...] } }

export interface AdminDashboardStats {
  total_clinics: number;
  total_doctors: number;
  total_receptionists: number;
  total_clinical_assistants: number;
  total_patients: number;
  pending_approvals: number;
  active_assessments: number;
}

export interface AdminDashboard {
  stats: AdminDashboardStats;
  clinic_breakdown: ClinicBreakdown[];
}

export interface ClinicBreakdown {
  clinic_id: string;
  clinic_name: string;
  city?: string;
  state?: string;
  is_active: boolean;
  staff_count: number;
  patient_count: number;
}

export interface RecentActivity {
  id: string;
  type: "patient_registered" | "staff_registered" | "clinic_created" | "patient_approved" | "patient_rejected" | string;
  description: string;
  timestamp: string;
  user_name?: string;
  clinic_name?: string;
}

// ─── Clinic ───────────────────────────────────────────────────────

export interface AdminClinic {
  clinic_id: string;
  clinic_code: string;
  clinic_name: string;
  clinic_type: "anava_owned" | "partner" | "mobile";
  status: "setup" | "active" | "pending_closure" | "closed";
  region_id: string;
  clinic_admin_id: string | null;
  is_main_branch: boolean;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  email?: string;
  is_active: boolean; // derived client-side from status === "active"
  doctor_count?: number;
  staff_count?: number;
  patient_count?: number;
  created_at?: string;
}

// Clinic creation is a 2-step flow — clinic_admin_id is never part of
// create; assign one afterward via ClinicAdminAssignPayload.
export interface CreateClinicPayload {
  clinic_code: string;
  clinic_name: string;
  clinic_type: "anava_owned" | "partner" | "mobile";
  region_id: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
}

export interface ClinicAdminAssignPayload {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  gender?: "male" | "female" | "other";
  dob?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
}

export interface AdminRegion {
  region_id: string;
  region_name: string;
  country: string;
  state: string;
  regional_admin_id?: string | null;
  is_active: boolean;
  created_at?: string;
}

export interface RegionalAdminAssignPayload {
  clinic_id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  gender?: "male" | "female" | "other";
  dob?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
}

// ─── Admins (regional_admin / clinic_admin management) ─────────────

export interface AdminAccount {
  admin_id: string;
  profile_id: string;
  admin_type: "super_admin" | "regional_admin" | "clinic_admin";
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  is_active: boolean;
  region_id: string | null;
  region_name: string | null;
  clinic_id: string | null;
  clinic_name: string | null;
  created_at: string;
}

// ─── Staff ────────────────────────────────────────────────────────

export interface AdminStaffMember {
  id: string;
  profile_id?: string; // needed to look up consent_records (keyed on profiles.id, not doctor_id/ca_id/receptionist_id)
  user_id?: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  email: string;
  phone?: string;
  role: string;
  clinic_id?: string;
  clinic_name?: string;
  is_active: boolean;
  created_at?: string;
  registered_at?: string;
  // Doctor-only
  specialization?: string;
  license_number?: string;
  hospital_affiliation?: string;
  max_patient_count?: number;
  // Clinical assistant-only
  qualification?: string;
}

export interface RegisterStaffPayload {
  first_name: string;
  last_name: string;
  email: string;
  password: string; // unused by backend (Cognito-based, no password check) — kept so the form doesn't need to change
  role: string;
  clinic_id: string;
  phone?: string;
  gender?: "male" | "female" | "other";
  dob?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  // Doctor-only
  specialization?: string;
  license_number?: string;
  hospital_affiliation?: string;
  max_patient_count?: number;
  // Clinical assistant-only
  qualification?: string;
  // Set when this registration fulfills an approved staff_request
  staff_request_id?: string;
}

// ─── Patients ─────────────────────────────────────────────────────

export interface AdminPatient {
  id: string;
  profile_id?: string; // needed to look up consent_records (keyed on profiles.id, not patient_id)
  user_id?: string;
  first_name: string;
  last_name: string;
  full_name?: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  clinic_id?: string;
  clinic_name?: string;
  approval_status: "pending" | "approved" | "rejected";
  // Real backend registration progression (patients.registration_status):
  // demographics_complete -> disease_selected -> consent_signed ->
  // anamnesis_complete -> general_prs_complete -> registration_complete.
  registration_status?: string;
  mrn?: string;
  registered_at?: string;
  created_at?: string;
  is_active?: boolean;
}

// ─── Notifications ────────────────────────────────────────────────

export interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  type?: string;
  link?: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  unread_count: number;
}
