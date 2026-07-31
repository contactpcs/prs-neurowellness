"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, CheckCircle, Loader2 } from "lucide-react";
import { receptionService } from "@/lib/api/services/reception.service";
import { Card, PageLoader, Button } from "@/components/ui";
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
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            Notifications
            {unread > 0 && (
              <span className="text-xs font-semibold text-white bg-red-500 rounded-full px-2 py-0.5">{unread}</span>
            )}
          </h1>
          <p className="text-sm text-neutral-500 mt-0.5">{notifications.length} total</p>
        </div>
        {unread > 0 && (
          <Button onClick={handleMarkAllRead} disabled={markingAll} variant="outline">
            {markingAll && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Mark all as read
          </Button>
        )}
      </div>

      <Card>
        <div className="divide-y divide-neutral-100">
          {notifications.length === 0 && (
            <div className="px-6 py-14 text-center">
              <Bell className="h-8 w-8 text-neutral-200 mx-auto mb-2" />
              <p className="text-sm text-neutral-400">No notifications yet.</p>
            </div>
          )}

          {notifications.map((n) => (
            <div key={n.id} className={`flex items-start gap-3 px-5 py-4 ${!n.is_read ? "bg-blue-50/40" : ""}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${!n.is_read ? "bg-blue-500" : "bg-transparent"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{categoryLabel(n.type)}</p>
                <p className="text-sm text-neutral-800 mt-0.5 leading-snug">{n.message}</p>
                <p className="text-xs text-neutral-400 mt-1">{n.created_at ? timeAgo(n.created_at) : ""}</p>
              </div>
              {!n.is_read && (
                <button
                  onClick={() => handleMarkRead(n.id)}
                  disabled={markingId === n.id}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium flex-shrink-0 disabled:opacity-50"
                >
                  {markingId === n.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
