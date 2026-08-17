"use client";

import { useEffect, useState } from "react";
import { User, Mail, Phone, MapPin, Building2, ShieldCheck, Calendar, Loader2 } from "lucide-react";
import { receptionService } from "@/lib/api/services/reception.service";
import { useAuth } from "@/lib/hooks";
import { Card, CardHeader, CardContent, PageLoader, Input } from "@/components/ui";

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-primary-600" />
      </div>
      <div>
        <p className="text-xs text-neutral-400 leading-tight">{label}</p>
        <p className="text-sm font-medium text-neutral-800 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export default function ReceptionistProfilePage() {
  const { user: authUser } = useAuth();
  // profile = full data from /users/profile (may include clinic info not in JWT)
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "" });
  const [toast, setToast] = useState<string | null>(null);

  const load = () => {
    setIsLoading(true);
    receptionService
      .getMyProfile()
      .then((p: any) => setProfile(p))
      .catch(() => setProfile(authUser))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <PageLoader />;

  // merge: profile wins over authUser for richer data
  const data: any = profile ?? authUser;

  const firstName = data?.first_name || data?.firstName || data?.full_name?.split(" ")[0] || "";
  const lastName  = data?.last_name  || data?.lastName  || data?.full_name?.split(" ").slice(1).join(" ") || "";
  const fullName  = data?.full_name  || `${firstName} ${lastName}`.trim() || "Unknown";
  const initials  = (firstName[0] || "?").toUpperCase() + (lastName[0] || "").toUpperCase();

  const clinicName  = data?.clinic_name  || (typeof data?.clinic === "string" ? data.clinic : data?.clinic?.name) || null;
  const clinicCity  = data?.clinic_city  || data?.clinic?.city   || data?.clinic?.location || null;
  const clinicDisplay = clinicName || clinicCity;

  const roles: string[] = Array.isArray(data?.roles) ? data.roles : (data?.role ? [data.role] : []);

  const dob = data?.date_of_birth || data?.dob;
  const dobFormatted = dob
    ? new Date(dob).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })
    : null;

  const gender = data?.gender
    ? data.gender.charAt(0).toUpperCase() + data.gender.slice(1)
    : null;

  const startEditing = () => {
    setForm({ first_name: firstName, last_name: lastName, email: data?.email || "", phone: data?.phone || "" });
    setEditing(true);
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      await receptionService.updateMyProfile(form);
      setEditing(false);
      setToast("Profile changes saved.");
      load();
    } catch {
      setToast("Failed to save changes.");
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Breadcrumb + header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <nav className="flex items-center gap-1.5 mb-1.5 text-xs">
            <span className="text-neutral-700 font-medium">Profile</span>
          </nav>
          <h1 className="text-2xl font-bold text-neutral-900">Profile</h1>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button
                onClick={() => setEditing(false)}
                className="h-[38px] px-3.5 rounded-lg border border-neutral-300 bg-white text-neutral-700 text-sm font-medium hover:bg-neutral-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveChanges}
                disabled={saving}
                className="h-[38px] px-4 rounded-lg bg-brand-gradient text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1.5"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Changes
              </button>
            </>
          ) : (
            <button
              onClick={startEditing}
              className="h-[38px] px-4 rounded-lg bg-brand-gradient text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Edit Profile
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl shadow-dropdown text-sm font-medium text-white bg-neutral-800">
          {toast}
        </div>
      )}

      {/* Header card */}
      <Card>
        <CardContent className="flex items-center gap-5 py-6">
          <div className="w-[76px] h-[76px] rounded-full bg-brand-gradient flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl font-bold text-neutral-900 leading-tight">{fullName}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-success-50 text-success-700">Active</span>
            </div>
            <p className="text-sm text-neutral-500 mt-1">Receptionist{clinicDisplay ? ` · ${clinicDisplay}` : ""}</p>
          </div>
        </CardContent>
      </Card>

      {/* Personal & Contact Details */}
      <Card>
        <CardHeader><h3 className="text-sm font-semibold text-neutral-900">Personal &amp; Contact Details</h3></CardHeader>
        <CardContent>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="First Name" value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
              <Input label="Last Name" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
              <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              <Input label="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <InfoRow icon={Mail}     label="Email Address"  value={data?.email} />
              <InfoRow icon={Phone}    label="Phone Number"   value={data?.phone} />
              <InfoRow icon={Calendar} label="Date of Birth"  value={dobFormatted} />
              <InfoRow icon={User}     label="Gender"         value={gender} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clinic */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-neutral-900">Clinic Information</h3>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {clinicName && <InfoRow icon={Building2} label="Clinic Name"     value={clinicName} />}
          {clinicCity  && <InfoRow icon={MapPin}    label="Clinic Location" value={clinicCity} />}
          {!clinicName && !clinicCity && (
            <p className="text-sm text-neutral-400 col-span-2">
              Clinic information is not available. Please contact your administrator.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Role & Access */}
      <Card>
        <CardHeader>
          <h3 className="text-sm font-semibold text-neutral-900">Role &amp; Access</h3>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="h-4 w-4 text-primary-600" />
            </div>
            <div>
              <p className="text-xs text-neutral-400">Assigned Roles</p>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {roles.length > 0 ? roles.map((r) => (
                  <span
                    key={r}
                    className="px-2.5 py-0.5 rounded-full bg-primary-100 text-primary-700 text-xs font-medium capitalize"
                  >
                    {String(r).replace(/_/g, " ")}
                  </span>
                )) : (
                  <span className="px-2.5 py-0.5 rounded-full bg-primary-100 text-primary-700 text-xs font-medium">
                    Receptionist
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
