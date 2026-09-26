"use client";

import toast, { Toaster } from "react-hot-toast";
import { Bell, CalendarDays, ShieldAlert, Stethoscope, X } from "lucide-react";
import type { SSEMessage } from "@/lib/sse";

const ICON_BY_TYPE: Record<string, typeof Bell> = {
  appointment: CalendarDays,
  clinical: Stethoscope,
  admin: ShieldAlert,
};

/** Minimal popup for one live notification — every role, every portal. The
 * bell/notifications list stays the record; this is only the "something just
 * happened" nudge, so it auto-dismisses and never blocks the page. */
export function showNotificationToast(msg: SSEMessage) {
  const Icon = ICON_BY_TYPE[msg.type] ?? Bell;
  toast.custom(
    (t) => (
      <div
        role="status"
        className={`pointer-events-auto flex w-80 max-w-[calc(100vw-2rem)] items-start gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-lg transition-all duration-200 ${
          t.visible ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0"
        }`}
      >
        <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900">{msg.title}</p>
          {msg.body && <p className="mt-0.5 line-clamp-2 text-xs text-neutral-500">{msg.body}</p>}
        </div>
        <button
          type="button"
          onClick={() => toast.dismiss(t.id)}
          className="flex-shrink-0 rounded p-0.5 text-neutral-400 hover:text-neutral-700"
          aria-label="Dismiss notification"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    ),
    // One popup per notification even if the stream redelivers it.
    { id: msg.notification_id, duration: 5000 },
  );
}

/** Mounted once in the root layout. */
export function NotificationToaster() {
  return <Toaster position="top-right" gutter={8} containerStyle={{ top: 16, right: 16 }} />;
}
