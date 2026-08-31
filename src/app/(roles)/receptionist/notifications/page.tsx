"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Check, Loader2, CheckCheck } from "lucide-react";
import { receptionService } from "@/lib/api/services/reception.service";
import { Card, PageLoader } from "@/components/ui";
import type { Notification } from "@/types/domain.types";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function categoryLabel(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const TONE_BY_KEYWORD: { match: RegExp; bg: string; text: string }[] = [
  { match: /cancel|reject|delay|overdue/i, bg: "bg-danger-50",  text: "text-danger-700" },
  { match: /pending|awaiting|approval/i,   bg: "bg-warning-50", text: "text-warning-700" },
  { match: /approve|confirm|checked.?in|complete|paid/i, bg: "bg-success-50", text: "text-success-700" },
];

function toneFor(type: string) {
  const found = TONE_BY_KEYWORD.find((t) => t.match.test(type));
  return found ? { bg: found.bg, text: found.text } : { bg: "bg-primary-50", text: "text-primary-700" };
}

export default function ReceptionistNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setIsLoading(true);
    return receptionService.getNotifications()
      .then(({ notifications: n, unread: u }) => { setNotifications(n); setUnread(u); })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handleMarkRead = async (id: string) => {
    setMarkingId(id);
    try {
      await receptionService.markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
    } catch {
      // no-op — the item just stays unread, no destructive side effect
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await receptionService.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
    } catch {
      // no-op
    } finally {
      setMarkingAll(false);
    }
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="flex flex-col gap-5">
      {/* Breadcrumb + header */}
      <div>
        <nav className="flex items-center gap-1.5 mb-1.5 text-xs">
          <span className="text-neutral-700 font-medium">Notifications</span>
        </nav>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-neutral-900">Notifications</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-500">{unread} unread of {notifications.length}</span>
            <button
              onClick={handleMarkAllRead}
              disabled={markingAll || unread === 0}
              className="h-[38px] px-3.5 rounded-lg border border-neutral-300 bg-white text-neutral-700 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 transition-colors flex items-center gap-1.5"
            >
              {markingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
              Mark all as read
            </button>
          </div>
        </div>
      </div>

      <Card>
        {notifications.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Bell className="h-8 w-8 text-neutral-200 mx-auto mb-2" />
            <p className="text-sm text-neutral-400">No notifications yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {notifications.map((n) => {
              const tone = toneFor(n.type);
              return (
                <div key={n.id} className={`flex gap-3 px-5 py-4 ${!n.is_read ? "bg-primary-50/40" : ""}`}>
                  <div className={`w-[34px] h-[34px] rounded-lg ${tone.bg} ${tone.text} flex items-center justify-center flex-shrink-0`}>
                    <Bell className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${tone.bg} ${tone.text}`}>
                        {categoryLabel(n.type)}
                      </span>
                      {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />}
                    </div>
                    <p className="text-sm text-neutral-800 leading-snug">{n.title ? `${n.title} — ` : ""}{n.message}</p>
                    <p className="text-xs text-neutral-400 mt-1">{n.created_at ? timeAgo(n.created_at) : ""}</p>
                  </div>
                  {!n.is_read && (
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      disabled={markingId === n.id}
                      title="Mark as read"
                      className="w-7 h-7 rounded-md border border-neutral-300 bg-white text-neutral-500 flex items-center justify-center flex-shrink-0 self-center hover:bg-neutral-50 disabled:opacity-50 transition-colors"
                    >
                      {markingId === n.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
