"use client";

import { useRef } from "react";
import { useHomeVideoLoop } from "./useHomeVideoLoop";

export function VideoHomeDemo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useHomeVideoLoop(videoRef, false, true);

  return (
    <figure className="video-home-demo mt-10 overflow-hidden rounded-[20px] border border-line bg-[#0c0820] text-[#f8f6ff] shadow-[0_24px_80px_-32px_rgba(96,64,160,0.45)] sm:mt-12 sm:rounded-[32px]">
      <div className="relative">
        <video
          ref={videoRef}
          src="/media/home-demo/scribix-hero-v5.mp4"
          poster="/media/home-demo/scribix-hero-v5.jpg"
          className="block aspect-video w-full object-contain focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-[#ffd600]"
          width={1600}
          height={900}
          autoPlay
          controls={false}
          muted
          loop
          playsInline
          disablePictureInPicture
          disableRemotePlayback
          preload="metadata"
        />
      </div>
    </figure>
  );
}
