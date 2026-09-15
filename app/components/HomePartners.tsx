"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useLocale } from "next-intl";

const EMPTY_HTML = { __html: "" };

export default function HomePartners() {
  const pathname = usePathname();
  const locale = useLocale();
  const isHome = pathname === "/" && locale === "en";
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = container.current;
    if (!isHome || !element || element.querySelector("[data-partner-links-list]")) return;
    const controller = new AbortController();
    // Next.js client navigation does not request a full HTML document. Restore the
    // same fragment on local previews and when returning home without a reload.
    void fetch("/api/partner-links", {
      signal: controller.signal,
      credentials: "omit",
      // Do not reuse a cached rendered fragment while iterating on local styles.
      cache: process.env.NODE_ENV === "development" ? "no-store" : "default",
    })
      .then(async response => {
        if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return;
        const payload: unknown = await response.json();
        if (controller.signal.aborted || !element.isConnected) return;
        if (payload && typeof payload === "object" && "version" in payload && payload.version === 1
          && "html" in payload && typeof payload.html === "string") {
          // The Worker and app endpoint use the same escaped, validated renderer.
          element.innerHTML = payload.html;
        }
      })
      .catch(() => { /* Optional footer content must not interrupt navigation. */ });
    return () => controller.abort();
  }, [isHome]);

  if (!isHome) return null;
  return (
    <div
      ref={container}
      data-partner-links-slot="home"
      className="text-muted"
      suppressHydrationWarning
      dangerouslySetInnerHTML={EMPTY_HTML}
    />
  );
}
