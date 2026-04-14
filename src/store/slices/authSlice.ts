import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { authService } from "@/lib/api/services";
import { STORAGE_KEYS, ROUTES } from "@/lib/constants";
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
  };
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

export const login = createAsyncThunk(
  "auth/login",
  async (credentials: LoginCredentials, { rejectWithValue }) => {
    try {
      console.log("Attempting login with:", credentials.email);
      const response = await authService.login(credentials);
      console.log("Login response:", response);
      
      if (!response.user) {
        console.error("No user in response:", response);
        return rejectWithValue("User data missing from response");
      }
      
      const normalizedUser = normalizeUser(response.user);

      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.access_token);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refresh_token);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(normalizedUser));
      
      console.log("Login successful, returning user:", normalizedUser);
      return normalizedUser;
    } catch (error: any) {
      console.error("Login error:", error);
      const errorMessage = error.response?.data?.detail || error.message || "Login failed";
      console.error("Error message:", errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

export const register = createAsyncThunk(
  "auth/register",
  async (userData: RegisterData, { rejectWithValue }) => {
    try {
      const response = await authService.register(userData);
      const normalizedUser = normalizeUser(response.user);
      localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, response.access_token);
      localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, response.refresh_token);
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(normalizedUser));
      return normalizedUser;
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.detail || "Registration failed");
    }
  }
);

export const restoreSession = createAsyncThunk(
  "auth/restoreSession",
  async (_, { rejectWithValue }) => {
    try {
      const userStr = localStorage.getItem(STORAGE_KEYS.USER);
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      if (!userStr || !token) throw new Error("No session");
      const parsed = JSON.parse(userStr);
      return normalizeUser(parsed);
    } catch {
      return rejectWithValue("No session to restore");
    }
  }
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
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
      .addCase(restoreSession.fulfilled, (state, action) => {
        state.user = action.payload;
        state.isAuthenticated = true;
      });
  },
});

export const { logout, clearError } = authSlice.actions;
export default authSlice.reducer;
