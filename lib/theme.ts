export const THEME_STORAGE_KEY = "scribix-theme";
export const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";
export const THEME_OPTIONS = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_OPTIONS)[number];

export function parseTheme(value: string | null): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

// Runs before the body is painted; only constant application values are interpolated.
export const themeInitScript = `(() => {
  let theme = "system";
  try { theme = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}); } catch {}
  document.documentElement.classList.toggle("dark", theme === "dark" || (theme !== "light" && matchMedia(${JSON.stringify(SYSTEM_THEME_QUERY)}).matches));
})();`;
