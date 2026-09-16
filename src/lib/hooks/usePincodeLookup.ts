import { useEffect, useRef, useState } from "react";

export interface PincodeLocation {
  city: string;
  state: string;
  country: string;
}

interface PostOfficeResult {
  Status: string;
  PostOffice?: Array<{
    Name: string;
    BranchType: string;
    Block: string;
    District: string;
    State: string;
    Country: string;
  }>;
}

/** India Post's free, keyless pincode lookup — the only public API this app
 * calls that isn't its own backend, so it goes through a plain fetch rather
 * than the JWT-authed apiClient instance. */
const PINCODE_API = "https://api.postalpincode.in/pincode";

/** Debounced city/state/country lookup for a 6-digit Indian pincode. Give it
 * the raw pincode string as typed; it fires ~500ms after typing stops and
 * only for a complete 6-digit code, matching the debounce-via-effect pattern
 * used elsewhere in the app (PaymentsHistorySection's search box). */
export function usePincodeLookup(pincode: string | undefined, skip?: boolean) {
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
    // Set programmatically (e.g. by "Use my location") rather than typed —
    // that flow already resolved city/state itself and knows better than a
    // pincode->district lookup, which would otherwise immediately overwrite
    // the more accurate geolocation result the instant it sets the pincode.
    if (skip) { lastLookedUp.current = code; return; }
    if (code === lastLookedUp.current) return;

    const timer = setTimeout(() => {
      setLoading(true);
      setNotFound(false);
      fetch(`${PINCODE_API}/${code}`)
        .then((res) => res.json())
        .then((data: PostOfficeResult[]) => {
          lastLookedUp.current = code;
          const offices = data?.[0]?.PostOffice ?? [];
          // `District` is the district (e.g. "Krishna"), not the town the
          // pincode actually covers — India Post's own town-level name is
          // `Block` (e.g. "Nuzvid" for pincode 521201, district "Krishna").
          // Prefer the Head Post Office's Block/Name since it's the town
          // the pincode is centered on; a Sub Post Office can belong to a
          // smaller locality within that same town.
          const po = offices.find((o) => o.BranchType === "Head Post Office") ?? offices[0];
          if (data?.[0]?.Status === "Success" && po) {
            setResult({ city: po.Block || po.District, state: po.State, country: po.Country || "India" });
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
