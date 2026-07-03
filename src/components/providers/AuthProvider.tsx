"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/hooks";
import { ROUTES, STORAGE_KEYS } from "@/lib/constants";
import { clearSessionAndSignalLogout, isTokenExpired } from "@/lib/api/client";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user, isRestoring, restoreSession } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // Consent gate on every page load, not just fresh logins — an inactive
  // account that refreshes or deep-links elsewhere gets sent back here.
  useEffect(() => {
    if (isRestoring || !user) return;
    if (user.is_active === false && pathname !== ROUTES.CONSENT && pathname !== ROUTES.LOGIN) {
      router.replace(ROUTES.CONSENT);
    }
  }, [isRestoring, user, pathname, router]);

  // Handle 401 responses from the axios interceptor without a full page reload.
  // client.ts dispatches this event instead of setting window.location.href.
  useEffect(() => {
    const handleUnauthorized = () => router.replace(ROUTES.LOGIN);
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, [router]);

  // Proactive expiry check — logs out an idle tab even if no API call is
  // in flight to trigger the 401 path above (client.ts's request
  // interceptor only catches expiry at call-time).
  useEffect(() => {
    const interval = setInterval(() => {
      const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
      if (token && isTokenExpired(token)) {
        clearSessionAndSignalLogout();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  return <>{children}</>;
}
