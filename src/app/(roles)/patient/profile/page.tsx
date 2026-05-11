"use client";

import { useState } from "react";
import { useAuth, useMyDoctor } from "@/lib/hooks";
import { Card, CardContent, PageLoader } from "@/components/ui";
import { ROLE_LABELS } from "@/lib/constants";
import { Edit2, Check, X } from "lucide-react";

export default function PatientProfilePage() {
  const { user } = useAuth();
  const { doctor, isLoading: isDoctorLoading } = useMyDoctor();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    // Contact & Location
    phone: user?.phone || "",
    address_line1: user?.address_line1 || "",
    city: user?.city || "",
    state: user?.state || "",
    country: user?.country || "India",
    pincode: user?.pincode || "",
    primary_language: user?.primary_language || "",

    // Medical
    date_of_birth: user?.date_of_birth || "",
    gender: user?.gender || "",
    blood_group: user?.blood_group || "",
    known_allergies: user?.known_allergies || "",
    medical_history: user?.medical_history || "",

    // Current Medications
    current_medications: user?.current_medications || "",

    // Emergency Contact
    emergency_contact: user?.emergency_contact || "",

    // Insurance
    insurance_provider: user?.insurance_provider || "",
    policy_number: user?.policy_number || "",

    // Personal
    occupation: user?.occupation || "",
    marital_status: user?.marital_status || "",
    referred_by: user?.referred_by || "",
  });

  const [originalData] = useState(formData);

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // TODO: Implement API call to update patient profile
      // const response = await patientService.updateProfile(formData);
      setIsEditing(false);
      // Show success toast
    } catch (error) {
      console.error("Failed to update profile:", error);
      // Show error toast
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData(originalData);
    setIsEditing(false);
  };

  const inputCls =
    "w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-neutral-400";

  const labelCls = "text-xs text-neutral-500 uppercase font-semibold tracking-wide";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-neutral-900">Profile</h1>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-100 text-neutral-700 hover:bg-neutral-200 transition-colors text-sm font-medium"
          >
            <Edit2 className="w-4 h-4" />
            Edit Profile
          </button>
        )}
      </div>

      {/* ─── BASIC INFORMATION (READ-ONLY) ─── */}
      <Card>
        <div className="px-6 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">Basic Information</h2>
        </div>
        <CardContent className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={labelCls}>First Name</p>
              <p className="text-sm text-neutral-700 mt-1">{user?.first_name}</p>
            </div>
            <div>
              <p className={labelCls}>Last Name</p>
              <p className="text-sm text-neutral-700 mt-1">{user?.last_name}</p>
            </div>
          </div>
          <div>
            <p className={labelCls}>Email</p>
            <p className="text-sm text-neutral-700 mt-1">{user?.email}</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={labelCls}>Role</p>
              <p className="text-sm text-neutral-700 mt-1 capitalize">{ROLE_LABELS[user?.roles?.[0] || "patient"]}</p>
            </div>
            <div>
              <p className={labelCls}>MRN</p>
              <p className="text-sm text-neutral-700 mt-1">{user?.mrn || "Not assigned"}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className={labelCls}>Registration Date</p>
              <p className="text-sm text-neutral-700 mt-1">{user?.registered_at ? new Date(user.registered_at).toLocaleDateString() : "—"}</p>
            </div>
            <div>
              <p className={labelCls}>Approval Status</p>
              <p className={`text-sm mt-1 font-medium ${user?.approval_status === "approved" ? "text-green-600" : user?.approval_status === "pending" ? "text-amber-600" : "text-red-600"}`}>
                {user?.approval_status ? user.approval_status.charAt(0).toUpperCase() + user.approval_status.slice(1) : "—"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── CONTACT & LOCATION ─── */}
      <Card>
        <div className="px-6 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">Contact & Location</h2>
        </div>
        <CardContent className="space-y-4 pt-4">
          {isEditing ? (
            <>
              <div>
                <label className={`${labelCls} block mb-1.5`}>Phone</label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={`${labelCls} block mb-1.5`}>Address Line 1</label>
                <input
                  type="text"
                  placeholder="Street address"
                  value={formData.address_line1}
                  onChange={(e) => handleChange("address_line1", e.target.value)}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`${labelCls} block mb-1.5`}>City</label>
                  <input
                    type="text"
                    placeholder="Mumbai"
                    value={formData.city}
                    onChange={(e) => handleChange("city", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={`${labelCls} block mb-1.5`}>State</label>
                  <input
                    type="text"
                    placeholder="Maharashtra"
                    value={formData.state}
                    onChange={(e) => handleChange("state", e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`${labelCls} block mb-1.5`}>Country</label>
                  <input
                    type="text"
                    placeholder="India"
                    value={formData.country}
                    onChange={(e) => handleChange("country", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={`${labelCls} block mb-1.5`}>Pincode</label>
                  <input
                    type="text"
                    placeholder="400001"
                    value={formData.pincode}
                    onChange={(e) => handleChange("pincode", e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={`${labelCls} block mb-1.5`}>Primary Language</label>
                <select
                  value={formData.primary_language}
                  onChange={(e) => handleChange("primary_language", e.target.value)}
                  className={inputCls}
                >
                  <option value="">Select language</option>
                  <option value="English">English</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Marathi">Marathi</option>
                  <option value="Tamil">Tamil</option>
                  <option value="Telugu">Telugu</option>
                  <option value="Kannada">Kannada</option>
                  <option value="Malayalam">Malayalam</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className={labelCls}>Phone</p>
                <p className="text-sm text-neutral-700 mt-1">{formData.phone || "Not provided"}</p>
              </div>
              <div>
                <p className={labelCls}>Address Line 1</p>
                <p className="text-sm text-neutral-700 mt-1">{formData.address_line1 || "Not provided"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={labelCls}>City</p>
                  <p className="text-sm text-neutral-700 mt-1">{formData.city || "Not provided"}</p>
                </div>
                <div>
                  <p className={labelCls}>State</p>
                  <p className="text-sm text-neutral-700 mt-1">{formData.state || "Not provided"}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={labelCls}>Country</p>
                  <p className="text-sm text-neutral-700 mt-1">{formData.country || "Not provided"}</p>
                </div>
                <div>
                  <p className={labelCls}>Pincode</p>
                  <p className="text-sm text-neutral-700 mt-1">{formData.pincode || "Not provided"}</p>
                </div>
              </div>
              <div>
                <p className={labelCls}>Primary Language</p>
                <p className="text-sm text-neutral-700 mt-1">{formData.primary_language || "Not provided"}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── MEDICAL INFORMATION ─── */}
      <Card>
        <div className="px-6 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">Medical Information</h2>
        </div>
        <CardContent className="space-y-4 pt-4">
          {isEditing ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`${labelCls} block mb-1.5`}>Date of Birth</label>
                  <input
                    type="date"
                    value={formData.date_of_birth}
                    onChange={(e) => handleChange("date_of_birth", e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={`${labelCls} block mb-1.5`}>Gender</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => handleChange("gender", e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not_to_say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`${labelCls} block mb-1.5`}>Blood Group</label>
                  <select
                    value={formData.blood_group}
                    onChange={(e) => handleChange("blood_group", e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Select blood group</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`${labelCls} block mb-1.5`}>Known Allergies</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Penicillin, Peanuts, Shellfish…"
                  value={formData.known_allergies}
                  onChange={(e) => handleChange("known_allergies", e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 resize-none transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-neutral-400"
                />
              </div>

              <div>
                <label className={`${labelCls} block mb-1.5`}>Medical History & Conditions</label>
                <textarea
                  rows={3}
                  placeholder="e.g. Diabetes, Hypertension, previous surgeries…"
                  value={formData.medical_history}
                  onChange={(e) => handleChange("medical_history", e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 resize-none transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-neutral-400"
                />
              </div>

              <div>
                <label className={`${labelCls} block mb-1.5`}>Current Medications</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Metformin 500mg twice daily, Aspirin 100mg daily…"
                  value={formData.current_medications}
                  onChange={(e) => handleChange("current_medications", e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 resize-none transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 hover:border-neutral-400"
                />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className={labelCls}>Date of Birth</p>
                  <p className="text-sm text-neutral-700 mt-1">{formData.date_of_birth || "Not provided"}</p>
                </div>
                <div>
                  <p className={labelCls}>Gender</p>
                  <p className="text-sm text-neutral-700 mt-1 capitalize">{formData.gender || "Not provided"}</p>
                </div>
              </div>
              <div>
                <p className={labelCls}>Blood Group</p>
                <p className="text-sm text-neutral-700 mt-1">{formData.blood_group || "Not provided"}</p>
              </div>
              <div>
                <p className={labelCls}>Known Allergies</p>
                <p className="text-sm text-neutral-700 mt-1 whitespace-pre-wrap">{formData.known_allergies || "Not provided"}</p>
              </div>
              <div>
                <p className={labelCls}>Medical History & Conditions</p>
                <p className="text-sm text-neutral-700 mt-1 whitespace-pre-wrap">{formData.medical_history || "Not provided"}</p>
              </div>
              <div>
                <p className={labelCls}>Current Medications</p>
                <p className="text-sm text-neutral-700 mt-1 whitespace-pre-wrap">{formData.current_medications || "Not provided"}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── EMERGENCY CONTACT ─── */}
      <Card>
        <div className="px-6 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">Emergency Contact</h2>
        </div>
        <CardContent className="space-y-4 pt-4">
          {isEditing ? (
            <div>
              <label className={`${labelCls} block mb-1.5`}>Emergency Contact (Name · Phone)</label>
              <input
                type="text"
                placeholder="e.g. Anjali Sharma — +91 98765 12345"
                value={formData.emergency_contact}
                onChange={(e) => handleChange("emergency_contact", e.target.value)}
                className={inputCls}
              />
            </div>
          ) : (
            <div>
              <p className={labelCls}>Emergency Contact</p>
              <p className="text-sm text-neutral-700 mt-1">{formData.emergency_contact || "Not provided"}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── INSURANCE ─── */}
      <Card>
        <div className="px-6 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">Insurance Information</h2>
        </div>
        <CardContent className="space-y-4 pt-4">
          {isEditing ? (
            <>
              <div>
                <label className={`${labelCls} block mb-1.5`}>Insurance Provider</label>
                <input
                  type="text"
                  placeholder="e.g. HDFC ERGO, Aetna…"
                  value={formData.insurance_provider}
                  onChange={(e) => handleChange("insurance_provider", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={`${labelCls} block mb-1.5`}>Policy Number</label>
                <input
                  type="text"
                  placeholder="Policy number"
                  value={formData.policy_number}
                  onChange={(e) => handleChange("policy_number", e.target.value)}
                  className={inputCls}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <p className={labelCls}>Insurance Provider</p>
                <p className="text-sm text-neutral-700 mt-1">{formData.insurance_provider || "Not provided"}</p>
              </div>
              <div>
                <p className={labelCls}>Policy Number</p>
                <p className="text-sm text-neutral-700 mt-1">{formData.policy_number || "Not provided"}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── PERSONAL INFORMATION ─── */}
      <Card>
        <div className="px-6 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">Personal Information</h2>
        </div>
        <CardContent className="space-y-4 pt-4">
          {isEditing ? (
            <>
              <div>
                <label className={`${labelCls} block mb-1.5`}>Occupation</label>
                <input
                  type="text"
                  placeholder="e.g. Software Engineer, Teacher…"
                  value={formData.occupation}
                  onChange={(e) => handleChange("occupation", e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={`${labelCls} block mb-1.5`}>Marital Status</label>
                <select
                  value={formData.marital_status}
                  onChange={(e) => handleChange("marital_status", e.target.value)}
                  className={inputCls}
                >
                  <option value="">Select status</option>
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="divorced">Divorced</option>
                  <option value="widowed">Widowed</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              <div>
                <label className={`${labelCls} block mb-1.5`}>Referred By</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. John Smith, Friend, Internet…"
                  value={formData.referred_by}
                  onChange={(e) => handleChange("referred_by", e.target.value)}
                  className={inputCls}
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <p className={labelCls}>Occupation</p>
                <p className="text-sm text-neutral-700 mt-1">{formData.occupation || "Not provided"}</p>
              </div>
              <div>
                <p className={labelCls}>Marital Status</p>
                <p className="text-sm text-neutral-700 mt-1 capitalize">{formData.marital_status || "Not provided"}</p>
              </div>
              <div>
                <p className={labelCls}>Referred By</p>
                <p className="text-sm text-neutral-700 mt-1">{formData.referred_by || "Not provided"}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── ASSIGNMENT (READ-ONLY) ─── */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide mb-3">Assignment</h2>
        {isDoctorLoading ? (
          <PageLoader />
        ) : doctor ? (
          <Card>
            <CardContent className="space-y-3">
              <div>
                <p className={labelCls}>Assigned Doctor</p>
                <p className="text-sm font-medium text-neutral-900 mt-1">
                  Dr. {doctor.first_name} {doctor.last_name}
                </p>
              </div>
              {doctor.specialization && (
                <div>
                  <p className={labelCls}>Specialization</p>
                  <p className="text-sm text-neutral-700 mt-1">{doctor.specialization}</p>
                </div>
              )}
              {doctor.phone && (
                <div>
                  <p className={labelCls}>Doctor Phone</p>
                  <p className="text-sm text-neutral-700 mt-1">{doctor.phone}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent>
              <p className="text-sm text-neutral-500">No doctor assigned yet.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ─── SAVE/CANCEL BUTTONS ─── */}
      {isEditing && (
        <div className="flex gap-3 sticky bottom-0 bg-white pt-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Check className="w-4 h-4" />
            {isSaving ? "Saving…" : "Save Changes"}
          </button>
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-neutral-100 text-neutral-700 font-medium text-sm hover:bg-neutral-200 disabled:opacity-50 transition-colors"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
