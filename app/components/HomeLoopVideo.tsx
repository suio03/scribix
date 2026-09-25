"use client";

import { useEffect, useRef } from "react";

/**
 * Silent homepage loop: plays while at least 30% visible, pauses offscreen or
 * in a hidden tab, and shows only the poster to reduced-motion viewers.
 */
export function HomeLoopVideo({
  src,
  poster,
  className,
  label,
}: {
  src: string;
  poster: string;
  className?: string;
  label?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const update = () => {
      if (visible && !document.hidden && !reducedMotion.matches) {
        void video.play().catch(() => {
          // Keep the poster visible when the browser blocks autoplay.
        });
      } else {
        video.pause();
      }
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting && entry.intersectionRatio >= 0.3;
        update();
      },
      { threshold: [0, 0.3] },
    );
    observer.observe(video);
    document.addEventListener("visibilitychange", update);
    reducedMotion.addEventListener("change", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      reducedMotion.removeEventListener("change", update);
      video.pause();
    };
  }, []);

  return (
    <video
      ref={videoRef}
      src={src}
      poster={poster}
      className={className}
      muted
      loop
      playsInline
      preload="none"
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
