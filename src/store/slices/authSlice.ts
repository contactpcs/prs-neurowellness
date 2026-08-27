import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { authService } from "@/lib/api/services";
import { STORAGE_KEYS } from "@/lib/constants";
import type { User, LoginCredentials, RegisterData } from "@/types/auth.types";

function splitFullName(fullName: string | undefined): { first_name: string; last_name: string } {
  const cleaned = (fullName || "").trim().replace(/\s+/g, " ");
  if (!cleaned) return { first_name: "", last_name: "" };
  const parts = cleaned.split(" ");
  return {
    first_name: parts[0] || "",
    last_name: parts.slice(1).join(" "),
  };
}

function normalizeUser(rawUser: any): User {
  const nameFromFull = splitFullName(rawUser?.full_name);
  const roles: string[] = Array.isArray(rawUser?.roles)
    ? rawUser.roles
    : (rawUser?.role ? [rawUser.role] : []);

  return {
    id: rawUser?.id || rawUser?.user_id || "",
    email: rawUser?.email || "",
    first_name: rawUser?.first_name || rawUser?.firstName || nameFromFull.first_name,
    last_name: rawUser?.last_name || rawUser?.lastName || nameFromFull.last_name,
    roles: roles.map((r) => String(r).toLowerCase()) as any,
    permissions: Array.isArray(rawUser?.permissions) ? rawUser.permissions : [],
    clinic_id: rawUser?.clinic_id ?? undefined,
    clinic_name: rawUser?.clinic_name ?? undefined,
    clinic_city: rawUser?.clinic_city ?? undefined,
    region_id: rawUser?.region_id ?? undefined,
    phone: rawUser?.phone ?? undefined,
    date_of_birth: rawUser?.date_of_birth ?? undefined,
    gender: rawUser?.gender ?? undefined,
    approval_status: rawUser?.approval_status ?? rawUser?.account_status ?? rawUser?.status ?? undefined,
    is_active: rawUser?.is_active ?? true,
    consent_signed: rawUser?.consent_signed ?? true,
    consent_type_required: rawUser?.consent_type_required ?? null,
    self_registered: rawUser?.self_registered ?? undefined,
    patient_id: rawUser?.patient_id ?? undefined,
    registration_status: rawUser?.registration_status ?? undefined,
    doctor_id: rawUser?.doctor_id ?? undefined,
    email_verified: rawUser?.email_verified ?? true,
    phone_verified: rawUser?.phone_verified ?? true,
  };
}

export interface PasswordChallenge {
  username: string;
  session: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isRestoring: boolean; // true while restoreSession is in-flight on page load
  error: string | null;
  // Set when Cognito's NEW_PASSWORD_REQUIRED challenge fires (a staff
  // account's first login after AdminCreateUser's auto-emailed temp
  // password) — the login page swaps to a "set new password" form instead
  // of showing this as a plain error.
  passwordChallenge: PasswordChallenge | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isRestoring: true, // start true — session restore runs immediately on mount
  error: null,
  passwordChallenge: null,
};

// AnavaException's real shape is {error:{code,message,details}} — FastAPI's
// own {detail:...} only ever appears for raw Pydantic validation errors,
// never a custom exception like the ones /auth/login actually raises.
function extractApiError(error: any): { code?: string; message?: string; details?: any } {
  const data = error?.response?.data;
  if (data?.error) return data.error;
  if (typeof data?.detail === "string") return { message: data.detail };
  return { message: error?.message };
}

export const login = createAsyncThunk(
  "auth/login",
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      const response = await authService.login(credentials);

      if (!response.user) {
        return rejectWithValue("User data missing from response");
      }

      const normalizedUser = normalizeUser(response.user);

      // Enforce approval gate for patients
      if (normalizedUser.roles.includes("patient")) {
        const status = (normalizedUser.approval_status ?? "").toLowerCase();
        if (status === "pending") {
          return rejectWithValue("You will be able to log in once your account is approved.");
        }
        if (status === "rejected") {
          return rejectWithValue("Your account has been rejected. Please contact reception.");
        }
      }

      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.access_token);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refresh_token);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(normalizedUser));

      return normalizedUser;
    } catch (error: any) {
      const apiError = extractApiError(error);
      if (apiError.code === "NEW_PASSWORD_REQUIRED") {
        const session = apiError.details?.[0]?.session;
        return rejectWithValue({ passwordChallenge: { username: credentials.username, session } });
      }
      const rawMessage = apiError.message || "Login failed";
      const lower = rawMessage.toLowerCase();
      let errorMessage = rawMessage;
      if (lower.includes("pending") || lower.includes("not approved") || lower.includes("awaiting approval")) {
        errorMessage = "You will be able to log in once your account is approved.";
      } else if (lower.includes("rejected") || lower.includes("account denied")) {
        errorMessage = "Your account has been rejected. Please contact reception.";
      }
      return rejectWithValue(errorMessage);
    }
  }
);

// Completes Cognito's NEW_PASSWORD_REQUIRED challenge — same session shape
// as login() itself once it succeeds.
export const completeNewPassword = createAsyncThunk(
  "auth/completeNewPassword",
  async (data: { username: string; newPassword: string; session: string }, { rejectWithValue }) => {
    try {
      const response = await authService.completeNewPassword(data.username, data.newPassword, data.session);
      if (!response.user) return rejectWithValue("User data missing from response");
      const normalizedUser = normalizeUser(response.user);
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.access_token);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refresh_token);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(normalizedUser));
      return normalizedUser;
    } catch (error: any) {
      const apiError = extractApiError(error);
      return rejectWithValue(apiError.message || "Could not set new password");
    }
  }
);

// Self-registration logs the patient in immediately (inactive, self_registered=TRUE)
// so they can continue the rest of the wizard — same session shape as login().
export const register = createAsyncThunk(
  "auth/register",
  async (userData: RegisterData, { rejectWithValue }) => {
    try {
      const response = await authService.register(userData);
      if (!response.user) return rejectWithValue("User data missing from response");
      const normalizedUser = normalizeUser(response.user);
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.access_token);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refresh_token);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(normalizedUser));
      return normalizedUser;
    } catch (error: any) {
      const detail = error.response?.data?.error?.message || error.response?.data?.detail;
      return rejectWithValue(
        typeof detail === "string" ? detail : "Registration failed. Please try again."
      );
    }
  }
);

// Real (cognito-mode) patient signup wizard's final step — same session
// shape as register() above, called once the OTP is verified and the real
// password is set (see PatientSignupComplete in patient-registration/).
export const completePatientSignup = createAsyncThunk(
  "auth/completePatientSignup",
  async (
    data: Parameters<typeof authService.patientSignupComplete>[0],
    { rejectWithValue }
  ) => {
    try {
      const response = await authService.patientSignupComplete(data);
      if (!response.user) return rejectWithValue("User data missing from response");
      const normalizedUser = normalizeUser(response.user);
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.access_token);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refresh_token);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(normalizedUser));
      return normalizedUser;
    } catch (error: any) {
      const detail = error.response?.data?.error?.message || error.response?.data?.detail;
      return rejectWithValue(
        typeof detail === "string" ? detail : "Registration failed. Please try again."
      );
    }
  }
);

// Re-reads /auth/me and updates the stored session — used right after
// signing onboarding consent, where profiles.is_active flips server-side
// but the existing token/localStorage snapshot is still stale. Avoids the
// forced re-login a full login() would require.
export const refreshUser = createAsyncThunk(
  "auth/refreshUser",
  async (_, { rejectWithValue }) => {
    try {
      const me = await authService.me();
      const normalizedUser = normalizeUser({ ...me, roles: [me.role] });
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(normalizedUser));
      return normalizedUser;
    } catch {
      return rejectWithValue("Failed to refresh session");
    }
  }
);

// Re-validates against the server on every app load/reopen instead of
// trusting the cached localStorage snapshot — that snapshot can predate a
// receptionist's approval or a just-completed PRS assessment (both flip
// server-side state without this tab knowing), and blindly trusting it sent
// already-approved/already-PRS-complete users back through the registration
// wizard on every reopen until they did a full re-login. login()/refreshUser()
// already re-fetch fresh; restoreSession() now does too.
export const restoreSession = createAsyncThunk(
  "auth/restoreSession",
  async (_, { rejectWithValue }) => {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!token) return rejectWithValue("No session to restore");
    try {
      const me = await authService.me();
      const normalizedUser = normalizeUser({ ...me, roles: [me.role] });
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(normalizedUser));
      return normalizedUser;
    } catch {
      // Token invalid/expired, or /auth/me genuinely failed — either way a
      // stale local snapshot can't be trusted for gating. Clear it and force
      // a real login rather than silently falling back to old cached state.
      localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      localStorage.removeItem(STORAGE_KEYS.USER);
      return rejectWithValue("Session expired or invalid");
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    updateUserInStore: (state, action: { payload: Partial<User> }) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        if (typeof window !== "undefined") {
          localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(state.user));
        }
      }
    },
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.isRestoring = false;
      state.error = null;
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
        localStorage.removeItem(STORAGE_KEYS.USER);
      }
    },
    clearError: (state) => {
      state.error = null;
    },
    clearPasswordChallenge: (state) => {
      state.passwordChallenge = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        const payload = action.payload as string | { passwordChallenge: PasswordChallenge };
        if (payload && typeof payload === "object" && "passwordChallenge" in payload) {
          state.passwordChallenge = payload.passwordChallenge;
        } else {
          state.error = payload as string;
        }
      })
      .addCase(completeNewPassword.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(completeNewPassword.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
        state.passwordChallenge = null;
      })
      .addCase(completeNewPassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(register.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(completePatientSignup.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(completePatientSignup.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(completePatientSignup.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(restoreSession.pending, (state) => {
        state.isRestoring = true;
      })
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.isRestoring = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(restoreSession.rejected, (state) => {
        state.isRestoring = false;
        // No session in localStorage — user must log in
      })
      .addCase(refreshUser.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = true;
      });
  },
});

export const { logout, clearError, clearPasswordChallenge, updateUserInStore } = authSlice.actions;
export default authSlice.reducer;
