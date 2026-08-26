import axios from "axios";
import { API_BASE_URL, STORAGE_KEYS } from "@/lib/constants";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

/** Reads the `exp` claim out of a JWT without a library — just base64url
 * decoding the payload segment. Returns null if the token isn't a
 * well-formed JWT (never throws — a malformed token just fails the
 * network call normally instead of crashing here). */
export function getTokenExpiry(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const expiresAt = getTokenExpiry(token);
  return expiresAt !== null && Date.now() >= expiresAt;
}

export function clearSessionAndSignalLogout() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER);
  window.dispatchEvent(new CustomEvent("auth:unauthorized"));
}

apiClient.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (token) {
      if (isTokenExpired(token)) {
        // A stale expired token must never block an otherwise-anonymous call
        // (register, public clinic list, login) — clear it and let the
        // request go out with no Authorization header instead of rejecting
        // it outright. If the endpoint actually needs auth, the server
        // returns a real 401 and the response interceptor below handles it;
        // that's the correct place for "your session is gone" to surface.
        clearSessionAndSignalLogout();
      } else {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  }
  return config;
});

/** FastAPI/Pydantic validation errors (422) return `detail` as an array of
 * {type, loc, msg, input, ctx} objects, not a string — every page's
 * `err?.response?.data?.detail ?? "fallback"` pattern assumes a string and
 * crashes React ("Objects are not valid as a React child") if ever rendered
 * raw. Every other error path (NotFoundError, ValidationError, ...) already
 * returns a plain string detail, so this only ever fires for the 422 case.
 * Normalized once here rather than patched at every call site. */
function isPydanticErrorList(x: unknown): x is Array<{ loc?: unknown[]; msg?: string }> {
  return Array.isArray(x) && x.length > 0 && x.every((e) => e && typeof e === "object" && "msg" in e);
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      clearSessionAndSignalLogout();
    }
    const detail = error.response?.data?.detail;
    if (isPydanticErrorList(detail)) {
      error.response.data.detail = detail
        .map((e) => (Array.isArray(e.loc) && e.loc.length ? `${e.loc[e.loc.length - 1]}: ${e.msg}` : e.msg))
        .join("; ");
    }
    return Promise.reject(error);
  }
);

export default apiClient;
