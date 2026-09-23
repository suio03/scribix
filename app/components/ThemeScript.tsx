"use client";

import { themeInitScript } from "@/lib/theme";

// The server-rendered copy runs before first paint. Client remounts, such as
// locale switches, render an inert data block because ThemeProvider already
// owns the class and React warns about executable client-created scripts.
export function ThemeScript() {
  return (
    <script
      suppressHydrationWarning
      type={typeof window === "undefined" ? undefined : "text/plain"}
      dangerouslySetInnerHTML={{ __html: themeInitScript }}
    />
  );
}
