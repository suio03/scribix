"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { parseTheme, THEME_OPTIONS } from "@/lib/theme";
import { useTheme } from "./ThemeProvider";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("Theme");
  const Icon = theme === "system" ? Monitor : theme === "dark" ? Moon : Sun;

  return (
    <label
      title={`${t("label")}: ${t(theme)}`}
      className={`relative inline-grid size-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-card hover:text-ink focus-within:ring-2 focus-within:ring-accent ${className}`}
    >
      <Icon size={16} strokeWidth={1.6} aria-hidden="true" />
      <select
        aria-label={t("label")}
        value={theme}
        onChange={(event) => setTheme(parseTheme(event.target.value))}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {THEME_OPTIONS.map((option) => <option key={option} value={option}>{t(option)}</option>)}
      </select>
    </label>
  );
}
