"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks";
import { ROUTES, STORAGE_KEYS } from "@/lib/constants";
import { clearSessionAndSignalLogout, isTokenExpired } from "@/lib/api/client";

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

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // Consent/deactivation gate on every page load, not just fresh logins —
  // an inactive staff/receptionist-registered-patient account that
  // refreshes or deep-links elsewhere gets sent back here. Self-registered
  // patients are exempt (isPublicPath covers /patient-registration/*) —
  // their own wizard deliberately visits disease-selection BEFORE consent,
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

  // Proactive expiry check — logs out an idle tab even if no API call is
  // in flight to trigger the 401 path above (client.ts's request
  // interceptor only catches expiry at call-time). Same public-path
  // exemption — don't clear a token that a public-flow page didn't ask for.
  useEffect(() => {
    const interval = setInterval(() => {
      if (isPublicPath(pathname)) return;
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      if (token && isTokenExpired(token)) {
        clearSessionAndSignalLogout();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [pathname]);

  return <>{children}</>;
}
