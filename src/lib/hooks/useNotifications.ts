"use client";

import { useCallback, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  selectNotifications,
  selectNotificationsStatus,
  selectUnreadCount,
  selectNotificationsTotal,
} from "@/store/slices/notificationsSlice";

export function useNotifications() {
  const dispatch       = useAppDispatch();
  const notifications  = useAppSelector(selectNotifications);
  const total          = useAppSelector(selectNotificationsTotal);
  const unreadCount    = useAppSelector(selectUnreadCount);
  const status         = useAppSelector(selectNotificationsStatus);

  useEffect(() => {
    dispatch(fetchNotifications());
  }, [dispatch]);

  const markRead = useCallback((id: string) => dispatch(markNotificationRead(id)), [dispatch]);
  const markAllRead = useCallback(() => dispatch(markAllNotificationsRead()), [dispatch]);
  const refresh = useCallback(() => dispatch(fetchNotifications()), [dispatch]);

  return {
    notifications,
    total,
    unreadCount,
    isLoading: status === "loading",
    isReady: status === "succeeded",
    markRead,
    markAllRead,
    refresh,
  };
}
