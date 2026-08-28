import { cn } from "@/lib/utils/cn";
import { getSeverityBgColor } from "@/lib/utils/format";

// Matches the design system's StatusChip tone palette exactly
// (components/patterns/PageShell.jsx) — success/warning/danger/info/neutral.
const TONES: Record<string, string> = {
  success: "bg-success-50 text-success-700",
  warning: "bg-warning-50 text-warning-700",
  danger: "bg-danger-50 text-danger-700",
  info: "bg-primary-50 text-primary-700",
  neutral: "bg-neutral-100 text-neutral-600",
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "severity";
  severityLevel?: string;
  tone?: keyof typeof TONES;
  className?: string;
}

export function Badge({ children, variant = "default", severityLevel, tone, className }: BadgeProps) {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";
  const colors = variant === "severity" && severityLevel
    ? getSeverityBgColor(severityLevel)
    : tone
      ? TONES[tone]
      : "bg-primary-100 text-primary-800";

  return <span className={cn(base, colors, className)}>{children}</span>;
}
