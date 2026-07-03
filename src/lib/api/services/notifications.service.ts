import apiClient from "../client";
import { ENDPOINTS } from "../endpoints";
import type { Notification } from "@/types/domain.types";

/** NotificationRead (real backend) uses notification_id/recipient_id/body —
 * mapped onto the old id/user_id/message field names the app expects. */
function mapNotification(n: Record<string, unknown>): Notification {
  return {
    id: String(n.notification_id ?? ""),
    user_id: String(n.recipient_id ?? ""),
    title: String(n.title ?? ""),
    message: String(n.body ?? ""),
    type: String(n.type ?? ""),
    is_read: Boolean(n.is_read),
    created_at: String(n.created_at ?? ""),
  };
}

export const notificationsService = {
  /** unread_count isn't part of the list response — a separate real
   * endpoint (/notifications/unread-count) is composed in alongside it. */
  async getNotifications(params?: { skip?: number; limit?: number }): Promise<{ notifications: Notification[]; total: number; unread_count: number }> {
    const [listRes, unreadRes] = await Promise.all([
      apiClient.get(ENDPOINTS.NOTIFICATIONS.LIST, { params }),
      apiClient.get("/notifications/unread-count"),
    ]);
    const raw: Record<string, unknown>[] = Array.isArray(listRes.data) ? listRes.data : [];
    const notifications = raw.map(mapNotification);
    return {
      notifications,
      total: notifications.length,
      unread_count: unreadRes.data?.unread_count ?? 0,
    };
  },

  async markAllRead(): Promise<void> {
    await apiClient.patch(ENDPOINTS.NOTIFICATIONS.READ_ALL, { notification_ids: null });
  },

  async markRead(notificationId: string): Promise<void> {
    await apiClient.patch(ENDPOINTS.NOTIFICATIONS.READ(notificationId), { notification_ids: [notificationId] });
  },
};
