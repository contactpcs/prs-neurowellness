"use client";

import { useState, useCallback } from "react";
import { adminService } from "@/lib/api/services/admin.service";
import type {
  AdminDashboard,
  AdminClinic,
  AdminRegion,
  AdminAccount,
  ClinicAdminAssignPayload,
  RegionalAdminAssignPayload,
  CreateClinicPayload,
  AdminStaffMember,
  RegisterStaffPayload,
  AdminPatient,
} from "@/types/admin.types";

// ─── Regions ──────────────────────────────────────────────────────

export function useAdminRegions() {
  const [regions, setRegions] = useState<AdminRegion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setRegions(await adminService.getRegions());
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Failed to load regions");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createRegion = useCallback(async (payload: { region_name: string; country: string; state: string }) => {
    const created = await adminService.createRegion(payload);
    setRegions((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateRegion = useCallback(async (id: string, payload: { region_name?: string; is_active?: boolean }) => {
    const updated = await adminService.updateRegion(id, payload);
    setRegions((prev) => prev.map((r) => (r.region_id === id ? updated : r)));
    return updated;
  }, []);

  const deleteRegion = useCallback(async (id: string) => {
    await adminService.deleteRegion(id);
    setRegions((prev) => prev.filter((r) => r.region_id !== id));
  }, []);

  const assignRegionalAdmin = useCallback(async (id: string, payload: RegionalAdminAssignPayload) => {
    const updated = await adminService.assignRegionalAdmin(id, payload);
    setRegions((prev) => prev.map((r) => (r.region_id === id ? updated : r)));
    return updated;
  }, []);

  return { regions, isLoading, error, fetch, createRegion, updateRegion, deleteRegion, assignRegionalAdmin };
}

// ─── Admins (regional_admin / clinic_admin management view) ───────

export function useAdminAccounts() {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (params?: { admin_type?: string; region_id?: string; clinic_id?: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      setAdmins(await adminService.getAdmins(params));
    } catch (e: any) {
      setError(e?.response?.data?.error?.message || e?.response?.data?.detail || "Failed to load admins");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { admins, isLoading, error, fetch };
}

// ─── Dashboard ────────────────────────────────────────────────────

export function useAdminDashboard() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminService.getDashboard();
      setDashboard(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to load dashboard");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { dashboard, isLoading, error, fetch };
}

// ─── Clinics ──────────────────────────────────────────────────────

export function useAdminClinics() {
  const [clinics, setClinics] = useState<AdminClinic[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (params?: { region_id?: string }) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminService.getClinics(params);
      setClinics(data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to load clinics");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createClinic = useCallback(async (payload: CreateClinicPayload) => {
    const created = await adminService.createClinic(payload);
    setClinics((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateClinic = useCallback(async (id: string, payload: Partial<CreateClinicPayload>) => {
    const updated = await adminService.updateClinic(id, payload);
    setClinics((prev) => prev.map((c) => (c.clinic_id === id ? updated : c)));
    return updated;
  }, []);

  const toggleClinic = useCallback(async (id: string, activate: boolean) => {
    if (activate) {
      await adminService.activateClinic(id);
    } else {
      await adminService.deactivateClinic(id);
    }
    setClinics((prev) =>
      prev.map((c) => (c.clinic_id === id ? { ...c, is_active: activate, status: activate ? "active" : "pending_closure" } : c))
    );
  }, []);

  const assignClinicAdmin = useCallback(async (id: string, payload: ClinicAdminAssignPayload) => {
    const updated = await adminService.assignClinicAdmin(id, payload);
    setClinics((prev) => prev.map((c) => (c.clinic_id === id ? updated : c)));
    return updated;
  }, []);

  const deleteClinic = useCallback(async (id: string) => {
    await adminService.deleteClinic(id);
    setClinics((prev) => prev.filter((c) => c.clinic_id !== id));
  }, []);

  return { clinics, isLoading, error, fetch, createClinic, updateClinic, toggleClinic, assignClinicAdmin, deleteClinic };
}

// ─── Staff ────────────────────────────────────────────────────────

export function useAdminStaff() {
  const [staff, setStaff] = useState<AdminStaffMember[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (params?: { clinic_id?: string; role?: string; search?: string; skip?: number; limit?: number }) => {
    setIsLoading(true);
    setError(null);
    try {
      const { staff: list, total: count } = await adminService.getStaff(params);
      setStaff(list);
      setTotal(count);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to load staff");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const registerStaff = useCallback(async (payload: RegisterStaffPayload) => {
    const created = await adminService.registerStaff(payload);
    setStaff((prev) => [created, ...prev]);
    return created;
  }, []);

  const updateStaff = useCallback(async (id: string, payload: Partial<RegisterStaffPayload>) => {
    const updated = await adminService.updateStaff(id, payload);
    setStaff((prev) => prev.map((s) => (s.id === id ? updated : s)));
    return updated;
  }, []);

  const toggleStaff = useCallback(async (id: string, activate: boolean, role?: string) => {
    if (activate) {
      await adminService.reactivateStaff(id, role);
    } else {
      await adminService.deactivateStaff(id, role);
    }
    setStaff((prev) =>
      prev.map((s) => (s.id === id ? { ...s, is_active: activate } : s))
    );
  }, []);

  const deleteStaff = useCallback(async (id: string, role?: string) => {
    await adminService.deleteStaff(id, role);
    setStaff((prev) => prev.filter((s) => s.id !== id));
  }, []);

  return { staff, total, isLoading, error, fetch, registerStaff, updateStaff, toggleStaff, deleteStaff };
}

// ─── Patients ─────────────────────────────────────────────────────

export function useAdminPatients() {
  const [patients, setPatients] = useState<AdminPatient[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async (params?: { clinic_id?: string; status?: string; search?: string; skip?: number; limit?: number }) => {
    setIsLoading(true);
    setError(null);
    try {
      const { patients: list, total: count } = await adminService.getPatients(params);
      setPatients(list);
      setTotal(count);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Failed to load patients");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const registerPatient = useCallback(async (payload: { email: string; first_name: string; last_name: string; phone?: string; gender?: string; dob?: string; address?: string; primary_clinic_id: string; emergency_contact_name?: string; emergency_contact_phone?: string }) => {
    const created = await adminService.registerPatient(payload);
    setPatients((prev) => [created, ...prev]);
    return created;
  }, []);

  const approvePatient = useCallback(async (id: string) => {
    await adminService.approvePatient(id);
    setPatients((prev) =>
      prev.map((p) => (p.id === id ? { ...p, approval_status: "approved" as const } : p))
    );
  }, []);

  const rejectPatient = useCallback(async (id: string) => {
    await adminService.rejectPatient(id);
    setPatients((prev) =>
      prev.map((p) => (p.id === id ? { ...p, approval_status: "rejected" as const } : p))
    );
  }, []);

  const updatePatient = useCallback(async (id: string, payload: { first_name?: string; last_name?: string; phone?: string; gender?: string; dob?: string; address?: string; emergency_contact_name?: string; emergency_contact_phone?: string }) => {
    const updated = await adminService.updatePatient(id, payload);
    setPatients((prev) => prev.map((p) => (p.id === id ? updated : p)));
    return updated;
  }, []);

  const deletePatient = useCallback(async (id: string) => {
    await adminService.deletePatient(id);
    setPatients((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { patients, total, isLoading, error, fetch, registerPatient, updatePatient, approvePatient, rejectPatient, deletePatient };
}
