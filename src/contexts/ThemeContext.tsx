"use client";

import React, { createContext, useContext, useEffect } from "react";

// App is light-only. Dark mode is intentionally disabled.
type Theme = "light";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "light",
  toggleTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.documentElement.classList.remove("dark");
    try {
      localStorage.removeItem("theme");
    } catch {}
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: "light", toggleTheme: () => {} }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
