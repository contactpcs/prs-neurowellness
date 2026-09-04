/**
 * Notifications slice — caches the user's notification list with a short TTL.
 * Notifications are time-sensitive but rarely change in a sub-minute window;
 * the cache prevents the bell badge from re-fetching on every navigation.
 */
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { notificationsService } from "@/lib/api/services/notifications.service";
import type { Notification } from "@/types/domain.types";
import type { RootState } from "../store";

const TTL_MS = 60 * 1000; // 1 minute — notifications must stay fresh

type LoadStatus = "idle" | "loading" | "succeeded" | "failed";

interface NotificationsState {
  notifications: Notification[];
  total: number;
  unreadCount: number;
  status: LoadStatus;
  loadedAt: number | null;
  error: string | null;
}

const initialState: NotificationsState = {
  notifications: [],
  total: 0,
  unreadCount: 0,
  status: "idle",
  loadedAt: null,
  error: null,
};

function isFresh(loadedAt: number | null): boolean {
  return loadedAt !== null && Date.now() - loadedAt < TTL_MS;
}

type NotificationQueryParams = { skip?: number; limit?: number };

export const fetchNotifications = createAsyncThunk<
  { notifications: Notification[]; total: number; unread_count: number },
  NotificationQueryParams | undefined,
  { state: RootState }
>(
  "notifications/fetch",
  async (params) => notificationsService.getNotifications(params),
  {
    condition: (params, { getState }) => {
      if (params?.skip !== undefined || params?.limit !== undefined) return true;
      const { status, loadedAt } = getState().notifications;
      if (status === "loading") return false;
      if (status === "succeeded" && isFresh(loadedAt)) return false;
      return true;
    },
  },
);

export const markNotificationRead = createAsyncThunk<
  string,
  string,
  { state: RootState }
>(
  "notifications/markRead",
  async (notificationId) => {
    await notificationsService.markRead(notificationId);
    return notificationId;
  },
);

export const markAllNotificationsRead = createAsyncThunk<
  void,
  void,
  { state: RootState }
>(
  "notifications/markAllRead",
  async () => {
    await notificationsService.markAllRead();
  },
);

const notificationsSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    invalidateNotifications: (state) => {
      state.loadedAt = null;
      state.status = "idle";
    },
    // Pushed live via SSE (lib/sse.ts) — prepends without a network round
    // trip, per Architecture Section 25.1 ("frontend updates the relevant
    // list/badge/toast without a refresh"). The stream's payload is a
    // slice of a real notifications row, not the full Notification shape
    // (no id/user_id/is_read/created_at from the server) — filled in here
    // since nothing about it is server-authoritative anyway; the next real
    // fetchNotifications() call replaces it with the true row.
    notificationReceived: (state, action: { payload: { type: string; title: string; body: string | null; notification_id: string } }) => {
      const msg = action.payload;
      state.notifications.unshift({
        id: msg.notification_id, user_id: "", title: msg.title, message: msg.body ?? "",
        type: msg.type, is_read: false, created_at: new Date().toISOString(),
      });
      state.total += 1;
      state.unreadCount += 1;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (s) => { s.status = "loading"; s.error = null; })
      .addCase(fetchNotifications.fulfilled, (s, a) => {
        s.status = "succeeded";
        s.notifications = a.payload.notifications;
        s.total = a.payload.total;
        s.unreadCount = a.payload.unread_count;
        s.loadedAt = Date.now();
      })
      .addCase(fetchNotifications.rejected, (s, a) => {
        s.status = "failed";
        s.error = a.error.message ?? "Failed to load notifications";
      })
      .addCase(markNotificationRead.fulfilled, (s, a) => {
        const notification = s.notifications.find((n: any) => n.id === a.payload || (n as any).notification_id === a.payload);
        if (notification && !(notification as any).read) {
          (notification as any).read = true;
          if (s.unreadCount > 0) s.unreadCount -= 1;
        }
      })
      .addCase(markAllNotificationsRead.fulfilled, (s) => {
        s.notifications.forEach((n: any) => { (n as any).read = true; });
        s.unreadCount = 0;
      });
  },
});

export const { invalidateNotifications, notificationReceived } = notificationsSlice.actions;
export default notificationsSlice.reducer;

export const selectNotifications       = (s: RootState) => s.notifications.notifications;
export const selectNotificationsTotal  = (s: RootState) => s.notifications.total;
export const selectUnreadCount         = (s: RootState) => s.notifications.unreadCount;
export const selectNotificationsStatus = (s: RootState) => s.notifications.status;
