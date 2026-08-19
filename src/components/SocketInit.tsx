"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { upsertOne } from "@/store/slices/appointmentsSlice";
import { STORAGE_KEYS } from "@/lib/constants";
import type { Appointment } from "@/types/domain.types";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || "";

export function SocketInit() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!SOCKET_URL) return;
    const token = localStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);
    if (!token) return;

    let socket: import("socket.io-client").Socket | null = null;

    import("socket.io-client").then(({ io }) => {
      socket = io(SOCKET_URL, {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnectionAttempts: 5,
      });

      const onAppt = ({ appointment }: { appointment: Appointment }) => {
        if (appointment) dispatch(upsertOne(appointment));
      };

      socket.on("appointment:created",  onAppt);
      socket.on("appointment:updated",  onAppt);
      socket.on("appointment:cancelled", onAppt);
    });

    return () => { socket?.disconnect(); };
  }, [dispatch]);

  return null;
}
