"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    let next = document.documentElement.classList.contains("dark");
    try {
      const saved = localStorage.getItem("scribix-theme");
      if (saved === "dark" || saved === "light") next = saved === "dark";
    } catch {}
    document.documentElement.classList.toggle("dark", next);
    document.cookie = `scribix-theme=${next ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
    setIsDark(next);
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    document.cookie = `scribix-theme=${next ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
    try {
      localStorage.setItem("scribix-theme", next ? "dark" : "light");
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={`inline-grid size-9 place-items-center rounded-lg text-muted transition hover:bg-card hover:text-ink ${className}`}
    >
      {isDark ? <Sun size={16} strokeWidth={1.6} /> : <Moon size={16} strokeWidth={1.6} />}
    </button>
  );
}
