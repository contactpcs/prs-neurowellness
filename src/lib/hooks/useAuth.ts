"use client";

import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import type { RootState, AppDispatch } from "@/store/store";
import { login, register, logout, restoreSession, clearError } from "@/store/slices/authSlice";
import { ROUTES, USER_ROLES } from "@/lib/constants";
import type { LoginCredentials, RegisterData } from "@/types/auth.types";

export function useAuth() {
  const dispatch = useDispatch<AppDispatch>();
  const router = useRouter();
  const { user, isAuthenticated, isLoading, error } = useSelector((s: RootState) => s.auth);

  const handleLogin = useCallback(async (credentials: LoginCredentials) => {
    const result = await dispatch(login(credentials));
    if (login.fulfilled.match(result)) {
      const roles = result.payload?.roles || [];
      console.log("handleLogin - roles:", roles);
      console.log("USER_ROLES values:", USER_ROLES);
      console.log("roles.includes(PATIENT):", roles.includes(USER_ROLES.PATIENT));
      console.log("roles.includes(DOCTOR):", roles.includes(USER_ROLES.DOCTOR));
      console.log("roles.includes(CLINICAL_ASSISTANT):", roles.includes(USER_ROLES.CLINICAL_ASSISTANT));
      
      if (roles.includes(USER_ROLES.PATIENT)) {
        console.log("Routing to PATIENT_DASHBOARD");
        router.push(ROUTES.PATIENT_DASHBOARD);
      } else if (roles.includes(USER_ROLES.DOCTOR)) {
        console.log("Routing to DOCTOR_DASHBOARD");
        router.push(ROUTES.DOCTOR_DASHBOARD);
      } else if (roles.includes(USER_ROLES.CLINICAL_ASSISTANT)) {
        console.log("Routing to CA_DASHBOARD");
        router.push(ROUTES.CA_DASHBOARD);
      } else {
        console.log("No role match, defaulting to DOCTOR_DASHBOARD");
        router.push(ROUTES.DOCTOR_DASHBOARD);
      }
    }
    return result;
  }, [dispatch, router]);

  const handleRegister = useCallback(async (data: RegisterData) => {
    const result = await dispatch(register(data));
    if (register.fulfilled.match(result)) {
      router.push(ROUTES.LOGIN);
    }
    return result;
  }, [dispatch, router]);

  const handleLogout = useCallback(() => {
    dispatch(logout());
    router.push(ROUTES.LOGIN);
  }, [dispatch, router]);

  const restore = useCallback(() => {
    dispatch(restoreSession());
  }, [dispatch]);

  return {
    user, isAuthenticated, isLoading, error,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    restoreSession: restore,
    clearError: () => dispatch(clearError()),
    hasRole: (role: string) => user?.roles?.includes(role as any) ?? false,
    isDoctor: user?.roles?.includes(USER_ROLES.DOCTOR) ?? false,
    isPatient: user?.roles?.includes(USER_ROLES.PATIENT) ?? false,
    isClinicalAssistant: user?.roles?.includes(USER_ROLES.CLINICAL_ASSISTANT) ?? false,
  };
}
