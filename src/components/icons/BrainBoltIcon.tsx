import type { SVGProps } from "react";

// Brain outline with a lightning bolt through it (treatment protocol /
// neuromodulation). Drawn lucide-style (24x24, currentColor stroke) so it
// sits alongside lucide icons and picks up text-* colour classes.
export function BrainBoltIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <g transform="translate(0 1.2)">
        {/* left lobe outline */}
        <path d="M14 1.5C12.5 1.1 10.2 1 8.6 2.8 6 2.5 4 4 3.6 6 1.6 6.6.8 8.4.8 9.6c0 1.8 1.6 3.3 4.5 3.3h2.1" />
        {/* right lobe, underside and front fold */}
        <path d="M16.6 2.2c1.7.3 3 1.6 3.1 3.2 1.7.6 2.9 2.3 2.9 4 0 .4-.1.8-.3 1.1.5.7.7 1.5.7 2.2 0 1.5-1.1 2.7-2.5 2.7-1.5 0-3.1-1.8-5.7-1.9-1.2-.1-2.4.3-3.4.5-2.1.4-3.8-.1-3.8-1.7 0-1.4 1.1-2.7 2.3-3.1" />
        {/* brain stem */}
        <path d="M11.9 14.8c0 .8.6 1.2 1.2 1.6 1.4.9 2.2 2.2 2.8 3.6.3.6 1.1.4 1-.2-.1-.8-.4-1.6-.7-2.3 1.7.4 3.3-.5 3.8-1.9" />
        {/* left folds */}
        <path d="M3 9.5c.6-1 2.2-1.5 4.1.1" />
        <path d="M10 5.2c-2.4-.4-4.2 1-4.2 3.2" />
        {/* right folds */}
        <path d="M17 8c1.6.4 2.8 2 1.7 3.2" />
        <path d="M13.5 12.4c1.4-.2 2.7-1.4 4.5-1.3 1.1 0 2 .6 2.4 1.5" />
        {/* lightning bolt */}
        <path d="M15.6 1.6 10.9 7.6h2.2L11.6 12l4.7-5.9h-2.4Z" fill="currentColor" strokeWidth={0.8} />
      </g>
    </svg>
  );
}
