"use client";

import { useEffect, type RefObject } from "react";

/** Play a silent video (or synchronized pair) only while its preview is visible. */
export function useHomeVideoLoop<T extends HTMLElement>(
  ref: RefObject<T | null>,
) {
  useEffect(() => {
    const target = ref.current;
    if (!target) return;
    const videos =
      target instanceof HTMLVideoElement
        ? [target]
        : Array.from(target.querySelectorAll("video"));
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const update = () => {
      for (const video of videos) {
        if (visible && !document.hidden && !reducedMotion.matches) {
          video.muted = true;
          void video.play().catch(() => {
            // Keep the poster visible when the browser blocks autoplay.
          });
        } else video.pause();
      }
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting && entry.intersectionRatio >= 0.15;
        update();
      },
      { threshold: [0, 0.15] },
    );
    observer.observe(target);
    document.addEventListener("visibilitychange", update);
    reducedMotion.addEventListener("change", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      reducedMotion.removeEventListener("change", update);
      videos.forEach((video) => video.pause());
    };
  }, [ref]);
}
