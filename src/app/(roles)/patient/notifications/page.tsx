"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, Loader2, CheckCheck, ChevronRight } from "lucide-react";
import { Card, PageLoader } from "@/components/ui";
import { useNotifications } from "@/lib/hooks";
import { patientNotificationHref } from "@/lib/utils/notificationLink";

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
  { match: /risk|alert|flag|danger/i, bg: "bg-danger-50", text: "text-danger-700" },
  { match: /cancel|reject|delay|overdue|missed/i, bg: "bg-warning-50", text: "text-warning-700" },
  { match: /pending|awaiting|assigned|assessment|reminder/i, bg: "bg-warning-50", text: "text-warning-700" },
  { match: /approve|confirm|checked.?in|complete|paid/i, bg: "bg-success-50", text: "text-success-700" },
];

function toneFor(type: string) {
  const found = TONE_BY_KEYWORD.find((t) => t.match.test(type));
  return found ? { bg: found.bg, text: found.text } : { bg: "bg-primary-50", text: "text-primary-700" };
}

type Filter = "All" | "Unread" | "Read";

export default function PatientNotificationsPage() {
  const router = useRouter();
  const { notifications, unreadCount, isLoading, markRead, markAllRead } = useNotifications();
  const [filter, setFilter] = useState<Filter>("All");
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const shown = notifications.filter((n) =>
    filter === "All" ? true : filter === "Unread" ? !n.is_read : n.is_read
  );

  const handleMarkRead = async (id: string) => {
    setMarkingId(id);
    try {
      await markRead(id);
    } finally {
      setMarkingId(null);
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await markAllRead();
    } finally {
      setMarkingAll(false);
    }
  };

  const handleOpen = (id: string, href: string, isRead: boolean) => {
    if (!isRead) markRead(id);
    router.push(href);
  };

  if (isLoading && notifications.length === 0) return <PageLoader />;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Notifications</h1>
          <p className="text-sm text-neutral-500 mt-0.5">{unreadCount} unread.</p>
        </div>
        <button
          onClick={handleMarkAllRead}
          disabled={markingAll || unreadCount === 0}
          className="h-[38px] px-3.5 rounded-lg border border-neutral-300 bg-white text-neutral-700 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          {markingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCheck className="h-3.5 w-3.5" />}
          Mark all as read
        </button>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {(["All", "Unread", "Read"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`h-8 px-3.5 rounded-full text-xs font-semibold transition-colors ${
              filter === f ? "bg-primary-600 text-white" : "bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <Card>
        {shown.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <Bell className="h-8 w-8 text-neutral-200 mx-auto mb-2" />
            <p className="text-sm text-neutral-400">No notifications match this filter.</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {shown.map((n) => {
              const tone = toneFor(n.type);
              const href = patientNotificationHref(n);
              const RowTag = href ? "button" : "div";
              return (
                <RowTag
                  key={n.id}
                  onClick={href ? () => handleOpen(n.id, href, n.is_read) : undefined}
                  className={`w-full text-left flex gap-3 px-5 py-4 ${!n.is_read ? "bg-primary-50/40" : ""} ${
                    href ? "hover:bg-neutral-50 transition-colors cursor-pointer" : ""
                  }`}
                >
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
                    <p className="text-sm text-neutral-800 leading-snug">
                      {n.title ? `${n.title} — ` : ""}
                      {n.message}
                    </p>
                    <p className="text-xs text-neutral-400 mt-1">{n.created_at ? timeAgo(n.created_at) : ""}</p>
                  </div>
                  {href ? (
                    <ChevronRight className="h-4 w-4 text-neutral-300 flex-shrink-0 self-center" />
                  ) : !n.is_read ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id); }}
                      disabled={markingId === n.id}
                      title="Mark as read"
                      className="w-7 h-7 rounded-md border border-neutral-300 bg-white text-neutral-500 flex items-center justify-center flex-shrink-0 self-center hover:bg-neutral-50 disabled:opacity-50 transition-colors"
                    >
                      {markingId === n.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    </button>
                  ) : null}
                </RowTag>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
