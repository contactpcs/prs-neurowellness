"use client";

import { useCallback } from "react";
import { useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import type { RootState } from "@/store/store";
import { useAppDispatch } from "@/store/hooks";
import { login, register, logout, restoreSession, refreshUser, clearError } from "@/store/slices/authSlice";
import { ROUTES, USER_ROLES } from "@/lib/constants";
import type { LoginCredentials, RegisterData } from "@/types/auth.types";

// Real backend role strings, exact match — super_admin/regional_admin/
// clinic_admin are three distinct portals, not one collapsed "admin".
// Shared by both post-login and post-consent routing so they never drift.
function dashboardRouteForRoles(roles: string[]): string {
  const roleList = roles.map((r: string) => String(r).toLowerCase());
  if (roleList.includes("super_admin")) return ROUTES.ADMIN_DASHBOARD;
  if (roleList.includes("regional_admin")) return ROUTES.REGIONAL_ADMIN_DASHBOARD;
  if (roleList.includes("clinic_admin")) return ROUTES.CLINIC_ADMIN_DASHBOARD;
  if (roles.includes(USER_ROLES.PATIENT)) return ROUTES.PATIENT_DASHBOARD;
  if (roles.includes(USER_ROLES.DOCTOR)) return ROUTES.DOCTOR_DASHBOARD;
  if (roles.includes(USER_ROLES.RECEPTIONIST)) return ROUTES.RECEPTIONIST_DASHBOARD;
  if (roles.includes(USER_ROLES.CLINICAL_ASSISTANT)) return ROUTES.CA_DASHBOARD;
  return ROUTES.CA_DASHBOARD;
}

// A self-registered patient stays inactive through the whole 6-step wizard —
// logging back in mid-way must resume wherever they left off, not always
// bounce to /consent (which has nothing pending to show once they're past
// that step, and which comes AFTER disease-selection in this wizard's
// order — see patient-registration/* pages).
function resumeRouteForSelfRegisteredPatient(registrationStatus: string | undefined): string {
  switch (registrationStatus) {
    case "demographics_complete": return "/patient-registration/disease-selection";
    case "disease_selected": return ROUTES.CONSENT;
    case "consent_signed": return "/patient-registration/anamnesis";
    case "anamnesis_complete": return "/patient-registration/assessment";
    default: return "/patient-registration/pending"; // general_prs_complete / registration_complete, awaiting approval
  }
}

export function useAuth() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, isRestoring, error } = useSelector((s: RootState) => s.auth);

  const handleLogin = useCallback(async (credentials: LoginCredentials) => {
    const result = await dispatch(login(credentials));
    if (login.fulfilled.match(result)) {
      const roles = result.payload?.roles || [];

      // Consent gate — a newly-registered (or not-yet-signed) account is
      // sent to the consent screen (staff/receptionist-registered patients)
      // or resumed wherever they left off (self-registered patients, whose
      // wizard has steps both before AND after consent).
      if (result.payload?.is_active === false) {
        if (roles.includes(USER_ROLES.PATIENT) && result.payload?.self_registered) {
          router.push(resumeRouteForSelfRegisteredPatient(result.payload?.registration_status));
        } else {
          router.push(ROUTES.CONSENT);
        }
        return result;
      }

      router.push(dashboardRouteForRoles(roles));
    }
    return result;
  }, [dispatch, router]);

  // Called after signing onboarding consent — profiles.is_active flipped
  // server-side already, this just re-reads /auth/me into the store so the
  // app sees it, then routes straight into the portal. No re-login needed.
  const completeConsent = useCallback(async () => {
    const result = await dispatch(refreshUser());
    if (refreshUser.fulfilled.match(result)) {
      router.push(dashboardRouteForRoles(result.payload?.roles || []));
    }
    return result;
  }, [dispatch, router]);

  const handleRegister = useCallback(async (data: RegisterData) => {
    return dispatch(register(data));
  }, [dispatch]);

  const handleLogout = useCallback(() => {
    dispatch(logout());
    router.push(ROUTES.LOGIN);
  }, [dispatch, router]);

  const restore = useCallback(() => {
    dispatch(restoreSession());
  }, [dispatch]);

  return {
    user, isAuthenticated, isLoading, isRestoring, error,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    restoreSession: restore,
    completeConsent,
    clearError: () => dispatch(clearError()),
    hasRole: (role: string) => user?.roles?.includes(role as any) ?? false,
    isDoctor: user?.roles?.includes(USER_ROLES.DOCTOR) ?? false,
    isPatient: user?.roles?.includes(USER_ROLES.PATIENT) ?? false,
    isClinicalAssistant: user?.roles?.includes(USER_ROLES.CLINICAL_ASSISTANT) ?? false,
    isReceptionist: user?.roles?.includes(USER_ROLES.RECEPTIONIST) ?? false,
    isAdmin: (user?.roles ?? []).some(
      (r) =>
        r === USER_ROLES.PLATFORM_ADMIN ||
        r === USER_ROLES.CLINICAL_ADMIN ||
        String(r).toLowerCase().includes("admin")
    ),
  };
}
