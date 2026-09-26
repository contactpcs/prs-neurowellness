"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks";
import { useAppDispatch } from "@/store/hooks";
import { ROUTES, STORAGE_KEYS } from "@/lib/constants";
import { TOKEN_REFRESH_SKEW_MS, clearSessionAndSignalLogout, isTokenExpired, refreshAccessToken } from "@/lib/api/client";
import { openEventStream } from "@/lib/sse";
import { logout } from "@/store/slices/authSlice";
import { notificationReceived } from "@/store/slices/notificationsSlice";

// Pages that don't need a session — a stale/expired token cleanup should
// never force-navigate someone away from these (e.g. mid self-registration
// wizard, or just filling out the public register form). Only pages that
// actually require an active login should ever get bounced to /login.
function isPublicPath(pathname: string): boolean {
  return (
    pathname === ROUTES.LOGIN ||
    pathname === ROUTES.REGISTER ||
    pathname === ROUTES.CONSENT ||
    pathname === ROUTES.ACCOUNT_DEACTIVATED ||
    pathname.startsWith("/patient-registration")
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isRestoring, restoreSession } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useAppDispatch();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // One SSE connection per logged-in session (Architecture Section 25.1) —
  // opened here rather than per-page so it survives navigation and there's
  // never more than one. Appointment-related pages listen for the
  // "sse:appointment" window event this dispatches to refetch their own
  // list; everything else just needs the notification bell to update,
  // which the Redux dispatch below handles directly.
  useEffect(() => {
    if (isRestoring || !user) return;
    if (!localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN)) return;
    const source = openEventStream((msg) => {
      dispatch(notificationReceived(msg));
      // Generic fan-out for any live count that needs to refresh (sidebar nav
      // badges) — every message type, not just appointment-specific ones.
      window.dispatchEvent(new CustomEvent("sse:notification", { detail: msg }));
      if (msg.type === "appointment") {
        window.dispatchEvent(new CustomEvent("sse:appointment", { detail: msg }));
      }
    });
    return () => source.close();
  }, [isRestoring, user, dispatch]);

  // Consent/deactivation gate on every page load, not just fresh logins —
  // an inactive staff/receptionist-registered-patient account that
  // refreshes or deep-links elsewhere gets sent back here. Self-registered
  // patients are exempt (isPublicPath covers /patient-registration/*) —
  // their own wizard visits /patient-registration/* pages before consent,
  // and this gate would otherwise hijack that ordering the instant
  // is_active is false. A staff account with consent_signed=true that's
  // still is_active=false was deliberately deactivated by an admin (not
  // newly created) — send it to the deactivated-account page instead of a
  // consent form with nothing pending to sign.
  useEffect(() => {
    if (isRestoring || !user) return;
    if (user.is_active === false && !isPublicPath(pathname)) {
      router.replace(user.consent_signed === false ? ROUTES.CONSENT : ROUTES.ACCOUNT_DEACTIVATED);
    }
  }, [isRestoring, user, pathname, router]);

  // Handle 401 responses from the axios interceptor without a full page reload.
  // client.ts dispatches this event instead of setting window.location.href.
  // Skipped on pages that don't need a session (register/consent/wizard) —
  // a stale expired token cleanup shouldn't yank someone off a public flow.
  useEffect(() => {
    const handleUnauthorized = () => {
      if (isPublicPath(pathname)) return;
      router.replace(ROUTES.LOGIN);
    };
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, [router, pathname]);

  // Proactive renewal — keeps an idle-but-open tab signed in even when no API
  // call is in flight to trigger the on-demand refresh in client.ts. Only when
  // the session genuinely can't be renewed (refresh cookie expired or revoked)
  // is the user logged out. Same public-path exemption — don't touch a token
  // that a public-flow page didn't ask for.
  useEffect(() => {
    const interval = setInterval(async () => {
      if (isPublicPath(pathname)) return;
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      if (token && isTokenExpired(token, TOKEN_REFRESH_SKEW_MS)) {
        if (!(await refreshAccessToken())) clearSessionAndSignalLogout();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [pathname]);

  // Multi-tab logout: the access token lives in localStorage, and the browser
  // fires "storage" in every OTHER tab when it changes. A removal there means
  // the user logged out (or the session died) in another tab — follow it
  // instead of sitting on a page whose token no longer exists.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEYS.ACCESS_TOKEN || e.newValue !== null) return;
      dispatch(logout());
      if (!isPublicPath(pathname)) router.replace(ROUTES.LOGIN);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [dispatch, router, pathname]);

  return <>{children}</>;
}
