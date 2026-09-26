"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useLocale } from "next-intl";
import styles from "./HomePartners.module.css";

const EMPTY_HTML = { __html: "" };

export default function HomePartners() {
  const pathname = usePathname();
  const locale = useLocale();
  const isHome = pathname === "/" && locale === "en";
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = container.current;
    if (!isHome || !element) return;
    let list: HTMLUListElement | null = null;
    let originals: HTMLElement[] = [];
    const measure = () => {
      if (!list || !originals.length) return;
      const gap = parseFloat(getComputedStyle(list).columnGap) || 0;
      const distance = originals.reduce((total, item) => total + item.getBoundingClientRect().width + gap, 0);
      list.style.setProperty("--partner-loop-distance", `${distance}px`);
      list.style.setProperty("--partner-loop-duration", `${distance / 32}s`);
      list.dataset.autoLoop = String(distance - gap > element.clientWidth);
    };
    const resize = new ResizeObserver(measure);
    resize.observe(element);
    const attach = () => {
      const next = element.querySelector<HTMLUListElement>("[data-partner-layout='home'] ul");
      if (next === list) return;
      list = next;
      if (!list) return;
      originals = Array.from(list.children).filter((item): item is HTMLElement => item instanceof HTMLElement && !item.hasAttribute("data-loop-copy"));
      // Keep every original crawlable link. A second visual sequence makes the
      // end and start identical, so the animation never travels backwards.
      for (const item of originals) {
        const copy = item.cloneNode(true) as HTMLElement;
        copy.setAttribute("data-loop-copy", "");
        copy.setAttribute("aria-hidden", "true");
        copy.querySelectorAll("a").forEach(link => link.setAttribute("tabindex", "-1"));
        list.appendChild(copy);
      }
      measure();
    };
    const mutation = new MutationObserver(attach);
    mutation.observe(element, { childList: true, subtree: true });
    attach();
    return () => {
      mutation.disconnect();
      resize.disconnect();
      list?.querySelectorAll("[data-loop-copy]").forEach(copy => copy.remove());
      list?.removeAttribute("data-auto-loop");
    };
  }, [isHome]);

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
    <div className={styles.carousel}>
      <div
        ref={container}
        data-partner-links-slot="home"
        className="text-muted"
        suppressHydrationWarning
        dangerouslySetInnerHTML={EMPTY_HTML}
      />
      <Link href="/partners" className="inline-flex min-h-11 items-center gap-2 text-[13px] text-muted underline underline-offset-4 transition-colors hover:text-ink">
        View all partners <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
