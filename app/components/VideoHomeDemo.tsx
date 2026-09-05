"use client";

import { useRef } from "react";
import { useHomeVideoLoop } from "./useHomeVideoLoop";
import { useTranslations } from "next-intl";

export function VideoHomeDemo() {
  const t = useTranslations("VideoHome.demo");
  const videoRef = useRef<HTMLVideoElement>(null);

  useHomeVideoLoop(videoRef);

  return (
    <figure className="mt-10 overflow-hidden rounded-[20px] border border-line bg-[#0c0820] text-[#f8f6ff] shadow-[0_24px_80px_-32px_rgba(96,64,160,0.45)] sm:mt-12 sm:rounded-[32px]">
      <video
        ref={videoRef}
        src="/media/home-demo/scribix-hero.mp4"
        poster="/media/home-demo/scribix-hero.jpg"
        className="block aspect-video w-full object-contain focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#ffd600]"
        width={1280}
        height={720}
        muted
        loop
        playsInline
        disablePictureInPicture
        preload="none"
        aria-label={t("title")}
        aria-describedby="home-demo-description"
      />
      <figcaption className="border-t border-white/10 px-5 py-4 text-left sm:px-7 sm:py-5">
        <p className="text-[14px] font-semibold sm:text-[16px]">{t("title")}</p>
        <p
          id="home-demo-description"
          className="mt-1.5 max-w-[75ch] text-[13px] leading-relaxed text-[#c3b7dd] sm:text-[14px]"
        >
          {t("description")}
        </p>
      </figcaption>
    </figure>
  );
}
