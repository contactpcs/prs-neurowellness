"use client";

import { useEffect } from "react";
import { useAuth } from "@/lib/hooks";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { restoreSession } = useAuth();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  return <>{children}</>;
}
