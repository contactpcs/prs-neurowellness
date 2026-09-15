import { useEffect, useRef, useState } from "react";

export interface PincodeLocation {
  city: string;
  state: string;
  country: string;
}

interface PostOfficeResult {
  Status: string;
  PostOffice?: Array<{ District: string; State: string; Country: string }>;
}

/** India Post's free, keyless pincode lookup — the only public API this app
 * calls that isn't its own backend, so it goes through a plain fetch rather
 * than the JWT-authed apiClient instance. */
const PINCODE_API = "https://api.postalpincode.in/pincode";

/** Debounced city/state/country lookup for a 6-digit Indian pincode. Give it
 * the raw pincode string as typed; it fires ~500ms after typing stops and
 * only for a complete 6-digit code, matching the debounce-via-effect pattern
 * used elsewhere in the app (PaymentsHistorySection's search box). */
export function usePincodeLookup(pincode: string | undefined) {
  const [result, setResult] = useState<PincodeLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const lastLookedUp = useRef<string | null>(null);

  useEffect(() => {
    const code = (pincode || "").trim();
    if (!/^\d{6}$/.test(code)) {
      setNotFound(false);
      return;
    }
    if (code === lastLookedUp.current) return;

    const timer = setTimeout(() => {
      setLoading(true);
      setNotFound(false);
      fetch(`${PINCODE_API}/${code}`)
        .then((res) => res.json())
        .then((data: PostOfficeResult[]) => {
          lastLookedUp.current = code;
          const po = data?.[0]?.PostOffice?.[0];
          if (data?.[0]?.Status === "Success" && po) {
            setResult({ city: po.District, state: po.State, country: po.Country || "India" });
          } else {
            setResult(null);
            setNotFound(true);
          }
        })
        .catch(() => {
          setResult(null);
          setNotFound(true);
        })
        .finally(() => setLoading(false));
    }, 500);

    return () => clearTimeout(timer);
  }, [pincode]);

  return { location: result, loading, notFound };
}
