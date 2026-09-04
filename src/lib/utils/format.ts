export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatScore(score: number, maxScore: number): string {
  return `${score}/${maxScore}`;
}

export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export function getSeverityColor(level: string): string {
  const colors: Record<string, string> = {
    minimal: "text-severity-minimal",
    normal: "text-severity-normal",
    mild: "text-severity-mild",
    moderate: "text-severity-moderate",
    "moderately-severe": "text-severity-moderately-severe",
    severe: "text-severity-severe",
    "extremely-severe": "text-severity-extremely-severe",
    critical: "text-severity-critical",
  };
  return colors[level] || "text-neutral-500";
}

export function getSeverityBgColor(level: string): string {
  const colors: Record<string, string> = {
    minimal: "bg-severity-minimal/15 text-severity-minimal",
    normal: "bg-severity-normal/15 text-severity-normal",
    mild: "bg-severity-mild/15 text-severity-mild",
    moderate: "bg-severity-moderate/15 text-severity-moderate",
    "moderately-severe": "bg-severity-moderately-severe/15 text-severity-moderately-severe",
    severe: "bg-severity-severe/15 text-severity-severe",
    "extremely-severe": "bg-severity-extremely-severe/15 text-severity-extremely-severe",
    critical: "bg-severity-critical/15 text-severity-critical",
  };
  return colors[level] || "bg-neutral-100 text-neutral-800";
}
