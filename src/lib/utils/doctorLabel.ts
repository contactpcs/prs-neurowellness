// Backend returns doctor names unmassaged (first_name || ' ' || last_name,
// or full_name typed in at registration) — title-cased and "Dr."-prefixed
// here so display never depends on how the name was originally typed in,
// and never double-prefixes a name that already carries "Dr.".
function titleCase(s: string): string {
  return s.replace(/\S+/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase());
}

export function doctorLabel(name?: string | null, fallback = "Your Doctor"): string {
  if (!name) return fallback;
  const trimmed = name.trim();
  if (/^dr\.?\s/i.test(trimmed)) return titleCase(trimmed);
  return `Dr. ${titleCase(trimmed)}`;
}
