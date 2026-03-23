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
      const roles = result.payload.roles;
      if (roles.includes(USER_ROLES.PATIENT)) router.push(ROUTES.PATIENT_DASHBOARD);
      else if (roles.includes(USER_ROLES.DOCTOR)) router.push(ROUTES.DOCTOR_DASHBOARD);
      else if (roles.includes(USER_ROLES.CLINICAL_ASSISTANT)) router.push(ROUTES.CA_DASHBOARD);
      else router.push(ROUTES.DOCTOR_DASHBOARD);
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
