// Country drives the mobile dial code shown next to phone fields — not an
// exhaustive world list, just the countries this clinic network actually
// serves patients from today plus a few common ones.
export const COUNTRY_OPTIONS = [
  { name: "India",          dialCode: "+91" },
  { name: "United States",  dialCode: "+1" },
  { name: "United Kingdom", dialCode: "+44" },
  { name: "United Arab Emirates", dialCode: "+971" },
  { name: "Singapore",      dialCode: "+65" },
  { name: "Australia",      dialCode: "+61" },
  { name: "Canada",         dialCode: "+1" },
  { name: "Nepal",          dialCode: "+977" },
  { name: "Sri Lanka",      dialCode: "+94" },
  { name: "China",          dialCode: "+86" },
  { name: "Japan",          dialCode: "+81" },
  { name: "France",         dialCode: "+33" },
  { name: "Russia",         dialCode: "+7" },
];

export function dialCodeForCountry(country: string | undefined | null): string {
  return COUNTRY_OPTIONS.find((c) => c.name === country)?.dialCode ?? "+91";
}
