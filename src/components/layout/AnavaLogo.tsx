// White-line version of the Anava rainbow mark — concentric arcs + dot, all
// white strokes/fill (no colour), for use on dark/brand-colour backgrounds.
export function AnavaLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 68" fill="none" className={className} aria-hidden="true">
      <path d="M5 55 A45 45 0 0 1 95 55" stroke="white" strokeWidth="7" strokeLinecap="round" opacity="0.35" />
      <path d="M17 55 A33 33 0 0 1 83 55" stroke="white" strokeWidth="7" strokeLinecap="round" opacity="0.55" />
      <path d="M29 55 A21 21 0 0 1 71 55" stroke="white" strokeWidth="7" strokeLinecap="round" opacity="0.78" />
      <path d="M41 55 A9 9 0 0 1 59 55" stroke="white" strokeWidth="7" strokeLinecap="round" />
      <circle cx="50" cy="62" r="5" fill="white" />
    </svg>
  );
}
