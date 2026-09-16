// Language-preference dropdown — the languages this clinic network's
// patients/staff actually speak, not an exhaustive ISO list.
export const LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "mr", label: "Marathi" },
  { code: "te", label: "Telugu" },
  { code: "ta", label: "Tamil" },
  { code: "kn", label: "Kannada" },
  { code: "ml", label: "Malayalam" },
  { code: "bn", label: "Bengali" },
  { code: "gu", label: "Gujarati" },
  { code: "pa", label: "Punjabi" },
  { code: "ur", label: "Urdu" },
  { code: "or", label: "Odia" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "ja", label: "Japanese" },
  { code: "zh", label: "Chinese" },
  { code: "de", label: "German" },
  { code: "nl", label: "Dutch" },
  { code: "si", label: "Sinhala" },
  { code: "ne", label: "Nepali" },
  { code: "ru", label: "Russian" },
  { code: "ar", label: "Arabic" },
];

export function languageLabel(code?: string | null): string {
  return LANGUAGE_OPTIONS.find((l) => l.code === code)?.label ?? (code ?? "");
}
