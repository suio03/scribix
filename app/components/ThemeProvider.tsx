"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { parseTheme, SYSTEM_THEME_QUERY, THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";

const ThemeContext = createContext<{
  theme: ThemePreference;
  setTheme: (theme: ThemePreference) => void;
} | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setPreference] = useState<ThemePreference>("system");

  useEffect(() => {
    const media = window.matchMedia(SYSTEM_THEME_QUERY);
    let current: ThemePreference = "system";
    try { current = parseTheme(localStorage.getItem(THEME_STORAGE_KEY)); } catch {}
    const apply = () => {
      document.documentElement.classList.toggle("dark", current === "dark" || (current === "system" && media.matches));
      setPreference(current);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        current = parseTheme(event.newValue);
        apply();
      }
    };
    const onPreference = (event: Event) => {
      current = (event as CustomEvent<ThemePreference>).detail;
      apply();
    };
    apply();
    media.addEventListener("change", apply);
    window.addEventListener("storage", onStorage);
    window.addEventListener("scribix-theme-change", onPreference);
    return () => {
      media.removeEventListener("change", apply);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("scribix-theme-change", onPreference);
    };
  }, []);

  const setTheme = (next: ThemePreference) => {
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch {}
    window.dispatchEvent(new CustomEvent("scribix-theme-change", { detail: next }));
  };

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme requires ThemeProvider");
  return context;
}
