"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

// Next's router has no way to ask "is there actually a previous entry in
// this tab's history" — sessionStorage counts navigations ourselves across
// the whole app lifetime, so a "Back" button can tell a real prior page
// (browser back is safe) from a fresh tab/direct link/refresh (browser back
// would leave the app entirely or land on an unrelated external referrer).
const NAV_COUNT_KEY = "__nav_count";

function bumpAndGetNavCount(): number {
  try {
    const n = Number(sessionStorage.getItem(NAV_COUNT_KEY) || "0") + 1;
    sessionStorage.setItem(NAV_COUNT_KEY, String(n));
    return n;
  } catch {
    return 1; // storage unavailable — treat every page as if it's the first
  }
}

/** Sends "Back" to wherever the user actually came from (router.back(), real
 * browser history) instead of a hardcoded destination baked into the page.
 * Falls back to `fallbackHref` only when there's no real in-app history to
 * go back to (first page opened in this tab — a direct link, a refresh, or
 * a new tab), so a fallback-only Back button never leaves the app or 404s. */
export function useGoBack(fallbackHref: string) {
  const router = useRouter();
  const navCountAtMount = useRef<number | null>(null);

  useEffect(() => {
    navCountAtMount.current = bumpAndGetNavCount();
  }, []);

  return useCallback(() => {
    const hasInAppHistory = (navCountAtMount.current ?? 1) > 1;
    if (hasInAppHistory) {
      router.back();
    } else {
      router.push(fallbackHref);
    }
  }, [router, fallbackHref]);
}
