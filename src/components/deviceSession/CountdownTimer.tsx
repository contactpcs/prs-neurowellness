"use client";

import type { SessionStatus } from "@/types/deviceSession.types";

function fmt(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Big countdown header for the live session. Purely presentational —
 * remainingSeconds already ticks every second because the parent
 * (live/page.tsx) recomputes it from server anchors (started_at/paused_at)
 * on its own 1s interval. This component must NOT keep a second local tick
 * and subtract it again: that double-counts elapsed time and races the
 * display to 00:00 roughly twice as fast as the real remaining time (the
 * bug this comment replaces — canComplete's gate used the parent's correct
 * `remaining` and correctly stayed blocked while this showed 00:00/Complete). */
export function CountdownTimer({
  remainingSeconds,
  totalSeconds,
  sessionStatus,
}: {
  remainingSeconds: number;
  totalSeconds: number;
  sessionStatus: SessionStatus;
}) {
  const displaySeconds = remainingSeconds;
  const progressPct = totalSeconds > 0 ? Math.min(100, Math.max(0, ((totalSeconds - displaySeconds) / totalSeconds) * 100)) : 0;

  const isPaused = sessionStatus === "paused";
  const isDone = displaySeconds <= 0;

  return (
    <div className="flex items-center gap-4">
      <div>
        <div
          className={`text-4xl font-bold tabular-nums ${isPaused ? "text-amber-500" : isDone ? "text-success-600" : "text-neutral-900"}`}
        >
          {fmt(displaySeconds)}
        </div>
        <p className="text-xs text-neutral-400 mt-0.5">
          {isPaused ? "Paused — timer held" : isDone ? "Complete — remove electrodes" : `remaining of ${fmt(totalSeconds)}`}
        </p>
      </div>
      <div className="flex-1 h-2 rounded-full bg-neutral-100 overflow-hidden min-w-[120px]">
        <div
          className={`h-full rounded-full transition-all duration-1000 ${isPaused ? "bg-amber-400" : "bg-brand-gradient"}`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
    </div>
  );
}
