"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// Small, in-memory images only; signed source URLs and video data are not cached.
const thumbnails = new Map<string, string>();

export function VideoProjectThumbnail({ projectId, available, children }: {
  projectId: string;
  available: boolean;
  children: ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<string | null>(null);

  useEffect(() => {
    setImage(null);
    if (!available || !container.current) return;
    const cached = thumbnails.get(projectId);
    if (cached) {
      setImage(cached);
      return;
    }
    const controller = new AbortController();
    let video: HTMLVideoElement | null = null;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const release = () => {
      clearTimeout(timeout);
      if (!video) return;
      video.onloadedmetadata = null;
      video.onseeked = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
      video = null;
    };
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      void (async () => {
        try {
          const response = await fetch(`/api/video-projects/${projectId}/source`, {
            signal: controller.signal,
          });
          if (!response.ok) return;
          const { url } = await response.json() as { url: string };
          if (controller.signal.aborted) return;
          video = document.createElement("video");
          video.crossOrigin = "anonymous";
          video.preload = "metadata";
          video.muted = true;
          video.playsInline = true;
          let sample = 0;
          video.onloadedmetadata = () => {
            if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
              release();
              return;
            }
            video.currentTime = Math.min(3, video.duration / 4);
          };
          video.onseeked = () => {
            if (!video || !video.videoWidth || !video.videoHeight) return;
            try {
              const canvas = document.createElement("canvas");
              const scale = 320 / Math.max(video.videoWidth, video.videoHeight);
              canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
              canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
              const context = canvas.getContext("2d", { willReadFrequently: true });
              if (!context) { release(); return; }
              context.drawImage(video, 0, 0, canvas.width, canvas.height);
              const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
              let brightness = 0;
              for (let index = 0; index < pixels.length; index += 4) {
                brightness += (pixels[index] + pixels[index + 1] + pixels[index + 2]) / 3;
              }
              // Try later frames if the opening is black, then keep the fallback.
              if (brightness / (canvas.width * canvas.height) < 12) {
                if (++sample < 3) video.currentTime = video.duration * (sample === 1 ? 0.4 : 0.7);
                else release();
                return;
              }
              const thumbnail = canvas.toDataURL("image/jpeg", 0.8);
              if (thumbnails.size >= 100) thumbnails.delete(thumbnails.keys().next().value!);
              thumbnails.set(projectId, thumbnail);
              setImage(thumbnail);
              release();
            } catch {
              release();
            }
          };
          video.onerror = release;
          timeout = setTimeout(release, 20_000);
          video.src = url;
        } catch {
          release();
        }
      })();
    });
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      controller.abort();
      release();
    };
  }, [available, projectId]);

  return (
    <div ref={container} className="absolute inset-0" aria-hidden="true">
      {available && image ? (
        // Canvas output is already resized and never needs the image optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" className="h-full w-full object-cover" />
      ) : children}
    </div>
  );
}
