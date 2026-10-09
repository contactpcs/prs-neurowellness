import type { SVGProps } from "react";

// Head-worn stimulation device: side-profile head wearing a headband with an
// electrode, wired to a handheld controller. Drawn lucide-style (24x24,
// currentColor stroke) so it sits alongside lucide icons and picks up
// text-* colour classes.
export function NeuroDeviceIcon({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
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
      <g transform="translate(0 2)">
        {/* crown of head, above the band */}
        <path d="M12.4 3.5C13.8 1.5 15.5 .6 17.2 .6c2.8 0 4.8 1.9 5.2 4.8" />
        {/* back of head and neck */}
        <path d="M22.3 7c-.1 1-.8 2-1.7 3.3-1.1 1.5-1.2 3.7 0 6.1" />
        {/* face profile: forehead, nose, lips, chin, throat */}
        <path d="M11.2 5.2c.4 1 .4 1.8-.2 2.6L9.6 9.9c-.2.5.2 1 1 1.1-.1.5 0 .9.2 1.2-.2.5-.1 1 .2 1.4.1.6.6.9 1.3.9h1.4c.4 0 .6.3.6.7v.5" />
        {/* headband */}
        <path d="M10.7 3.2 23 5.7l-.3 1.3-12.3-2.4Z" />
        {/* electrode */}
        <circle cx="17.3" cy="6.9" r="1.05" />
        {/* lead wire looping under the face to the controller */}
        <path d="M18.1 8c.2 2 .1 4.5-.2 6.3-.9 2.5-2.9 3.2-5.4 3.2-3 0-4.6-1.5-4.6-3.2l-.3-4.8c-.1-1.5-1.2-2.1-2.2-2-1.2.1-1.9 1.3-1.9 3.2" />
        {/* handheld controller */}
        <rect x="2.75" y="10.7" width="1.4" height=".9" fill="currentColor" />
        <rect x="1.1" y="11.6" width="4.6" height="7.9" rx="1.2" />
        <rect x="2.15" y="13.6" width="2.5" height="1.4" rx=".2" />
        <circle cx="2.75" cy="16.9" r=".25" fill="currentColor" />
        <circle cx="4.05" cy="16.9" r=".25" fill="currentColor" />
      </g>
    </svg>
  );
}
