import { useCallback, useState } from "react";
import type { PincodeLocation } from "./usePincodeLookup";

export interface GeoAddress extends PincodeLocation {
  pincode: string;
}

interface NominatimResult {
  address?: {
    postcode?: string;
    city?: string;
    town?: string;
    municipality?: string;
    village?: string;
    suburb?: string;
    city_district?: string;
    county?: string;
    state_district?: string;
    state?: string;
    country?: string;
  };
}

/** OpenStreetMap's free, keyless reverse-geocoder — no billing/API-key setup,
 * matching the India Post pincode lookup's zero-config approach. Usage
 * policy caps this at ~1 req/sec, which a single button click is nowhere
 * near. https://operations.osmfoundation.org/policies/nominatim/ */
const REVERSE_GEOCODE_API = "https://nominatim.openstreetmap.org/reverse";

type Status = "idle" | "requesting" | "loading" | "denied" | "unsupported" | "error";

/** Browser geolocation -> reverse-geocoded pincode/city/state, behind an
 * explicit `locate()` call so the permission prompt only fires on user
 * action (a "Use my location" button), never on page load. */
export function useGeolocationAddress() {
  const [address, setAddress] = useState<GeoAddress | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("unsupported");
      return;
    }
    setStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setStatus("loading");
        const params = new URLSearchParams({
          lat: String(coords.latitude),
          lon: String(coords.longitude),
          format: "jsonv2",
          addressdetails: "1",
          zoom: "18",
        });
        fetch(`${REVERSE_GEOCODE_API}?${params}`, {
          headers: { Accept: "application/json" },
        })
          .then((res) => res.json())
          .then((data: NominatimResult) => {
            console.log("[useGeolocationAddress] Nominatim response:", data);
            const a = data.address;
            if (!a || !(a.postcode || a.city || a.state)) {
              setAddress(null);
              setStatus("error");
              return;
            }
            // Nominatim's India results often carry `city` alongside a
            // district-level `county`/`state_district` at the same time
            // (e.g. Hyderabad's own address also has county: "Secunderabad
            // mandal") — `city` must win whenever present. Only fall back
            // to district-level fields for genuinely rural points where no
            // city/town/village exists at all; suburb/city_district come
            // before county/state_district since those are still
            // locality-level, not the district.
            const resolved: GeoAddress = {
              pincode: a.postcode || "",
              city:
                a.city || a.town || a.municipality || a.village ||
                a.suburb || a.city_district ||
                a.county || a.state_district || "",
              state: a.state || "",
              country: a.country || "India",
            };
            console.log("[useGeolocationAddress] resolved address:", resolved);
            setAddress(resolved);
            setStatus("idle");
          })
          .catch(() => {
            setAddress(null);
            setStatus("error");
          });
      },
      () => {
        setAddress(null);
        setStatus("denied");
      },
      { timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  return { locate, address, status };
}
