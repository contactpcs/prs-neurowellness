import axios from "axios";
import { API_BASE_URL, STORAGE_KEYS } from "@/lib/constants";
import { ENDPOINTS } from "@/lib/api/endpoints";

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

/** `skewMs` treats a token that is about to expire as expired, so a request
 * never leaves with a token that dies in flight. */
export function isTokenExpired(token: string, skewMs = 0): boolean {
  const expiresAt = getTokenExpiry(token);
  return expiresAt !== null && Date.now() + skewMs >= expiresAt;
}

/** Refresh a little before expiry rather than at it. */
export const TOKEN_REFRESH_SKEW_MS = 30_000;

let refreshInFlight: Promise<string | null> | null = null;

/** Silent session renewal: POST /auth/refresh with the httpOnly refresh
 * cookie (the browser attaches it; page scripts can't read it) and store the
 * new short-lived access token. Every caller that needs a fresh token at the
 * same moment shares ONE request. Resolves null when the session cannot be
 * renewed (no cookie, expired, revoked, or local-dev mode with no refresh) —
 * the caller then treats the user as logged out.
 *
 * Uses bare axios, not apiClient: its interceptors call this function. */
export function refreshAccessToken(): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!refreshInFlight) {
    refreshInFlight = axios
      .post(`${API_BASE_URL}${ENDPOINTS.AUTH.REFRESH}`, null, { withCredentials: true, timeout: 15000 })
      .then(({ data }) => {
        const token: unknown = data?.access_token;
        if (typeof token !== "string" || !token) return null;
        localStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
        return token;
      })
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/** Ends this device's session on the server (revokes the refresh token,
 * denylists the access token, clears the cookie). Best-effort and never
 * throws — the caller clears local state regardless. Reads the token before
 * its first await, so it can be called right before the local logout wipes
 * storage. */
export async function signOutOnServer(): Promise<void> {
  if (typeof window === "undefined") return;
  const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
  try {
    await axios.post(`${API_BASE_URL}${ENDPOINTS.AUTH.LOGOUT}`, null, {
      withCredentials: true,
      timeout: 5000,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  } catch {
    // Offline / server down: the local logout still happens.
  }
}

export function clearSessionAndSignalLogout() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEYS.ACCESS_TOKEN);
  // Legacy: refresh tokens used to be kept here. Now httpOnly-cookie only.
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem(STORAGE_KEYS.USER);
  window.dispatchEvent(new CustomEvent("auth:unauthorized"));
}

apiClient.interceptors.request.use(async (config) => {
  // The refresh cookie is scoped to /api/v1/auth, so only auth calls need
  // credentials mode on (login/new-password set it, refresh/logout use it).
  if (config.url?.startsWith("/auth/")) config.withCredentials = true;

  // A caller that already set its own Authorization header (auth.service.ts's
  // post-login GET /auth/me, using the token it just received, before that
  // token has been written to localStorage yet) means exactly that — don't
  // clobber it with whatever's sitting in localStorage. Found live: a stale,
  // unexpired token from a PREVIOUS session (browser/tab closed without
  // logout()) was silently overwriting the fresh receptionist token on this
  // exact call, so /auth/me resolved as the old (patient) identity for one
  // request — the receptionist got bounced into the patient-registration
  // wizard on their first login attempt, then landed correctly on retry
  // (by which point the fresh token had already been written to localStorage
  // as a side effect of the first, wrongly-routed attempt).
  if (typeof window !== "undefined" && !config.headers.Authorization) {
    let token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (token && isTokenExpired(token, TOKEN_REFRESH_SKEW_MS)) {
      // Expired (or about to be): renew it silently instead of throwing the
      // session away. Only if the session genuinely can't be renewed does
      // this fall back to the old behaviour — clear it and let the request go
      // out anonymous, so a stale token never blocks a public call
      // (register, clinic list, login); an endpoint that needs auth then
      // returns a real 401 and the response interceptor below handles it.
      token = await refreshAccessToken();
      if (!token) clearSessionAndSignalLogout();
    }
    if (token) config.headers.Authorization = `Bearer ${token}`;
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
    const original = error.config as (typeof error.config & { _refreshed?: boolean }) | undefined;
    if (error.response?.status === 401) {
      // The server rejected a token this client believed was good (expired
      // between the check and the call, or signed out elsewhere). Renew it
      // once and replay the request; only if that fails is the session over.
      // Requests sent without a token (bad password on login, ...) skip this.
      if (original && original.headers?.Authorization && !original._refreshed) {
        original._refreshed = true;
        const token = await refreshAccessToken();
        if (token) {
          original.headers.Authorization = `Bearer ${token}`;
          return apiClient(original);
        }
      }
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
