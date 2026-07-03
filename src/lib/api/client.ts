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

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      clearSessionAndSignalLogout();
    }
    return Promise.reject(error);
  }
);

export default apiClient;
