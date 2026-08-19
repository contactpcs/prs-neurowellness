"use client";

import { Play, Pause, PlayCircle, Square, CheckCircle2, AlertTriangle, Activity } from "lucide-react";
import type { SessionEvent } from "@/types/deviceSession.types";

const EVENT_META: Record<string, { label: string; icon: typeof Play; tone: string }> = {
  started: { label: "Session started", icon: Play, tone: "text-success-600" },
  paused: { label: "Session paused", icon: Pause, tone: "text-amber-600" },
  resumed: { label: "Session resumed", icon: PlayCircle, tone: "text-success-600" },
  stopped: { label: "Session stopped early", icon: Square, tone: "text-danger-600" },
  completed: { label: "Session completed", icon: CheckCircle2, tone: "text-success-600" },
  ae_recorded: { label: "Adverse event recorded", icon: AlertTriangle, tone: "text-danger-600" },
};

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** Full timestamped audit trail for the Session Summary screen — reads
 * core.device_session_events directly (via GET /events), no client-side
 * reconstruction from the other child tables. */
export function SessionLogTimeline({ events }: { events: SessionEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-neutral-400">No events recorded.</p>;
  }

  return (
    <ol className="space-y-3">
      {events.map((e) => {
        const meta = EVENT_META[e.event_type] ?? { label: e.event_type.replace(/_/g, " "), icon: Activity, tone: "text-neutral-500" };
        const Icon = meta.icon;
        return (
          <li key={e.event_id} className="flex items-start gap-3">
            <div className={`mt-0.5 ${meta.tone}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-neutral-800 capitalize">{meta.label}</p>
              <p className="text-xs text-neutral-400">{fmtTime(e.occurred_at)} · {e.actor_role}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
