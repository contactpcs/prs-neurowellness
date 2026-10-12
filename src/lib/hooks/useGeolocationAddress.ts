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
    village?: string;
    county?: string;
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
        });
        fetch(`${REVERSE_GEOCODE_API}?${params}`, {
          headers: { Accept: "application/json" },
        })
          .then((res) => res.json())
          .then((data: NominatimResult) => {
            const a = data.address;
            if (!a || !(a.postcode || a.city || a.state)) {
              setAddress(null);
              setStatus("error");
              return;
            }
            setAddress({
              pincode: a.postcode || "",
              city: a.city || a.town || a.village || a.county || "",
              state: a.state || "",
              country: a.country || "India",
            });
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
