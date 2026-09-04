"use client";

import { useEffect, useState } from "react";
import type { SessionStatus } from "@/types/deviceSession.types";

function fmt(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Big countdown header for the live session. Ticks locally every second
 * between reloads — remainingSeconds is recomputed from server anchors
 * (started_at/paused_at) each time the hook reloads, this just interpolates
 * between those reloads so the display doesn't visibly stall. Freezes
 * automatically while paused (sessionStatus governs the interval, not a
 * separate prop) since a paused session's server-computed remaining time
 * doesn't change until resumed. */
export function CountdownTimer({
  remainingSeconds,
  totalSeconds,
  sessionStatus,
}: {
  remainingSeconds: number;
  totalSeconds: number;
  sessionStatus: SessionStatus;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (sessionStatus !== "in_progress") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [sessionStatus]);

  const displaySeconds = sessionStatus === "in_progress" ? Math.max(0, remainingSeconds - tick) : remainingSeconds;
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
