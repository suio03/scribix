"use client";

import type { ReactNode } from "react";
import { trackVideoAction } from "./video-event-client";

export function VideoUploadLink({ children, className }: { children: ReactNode; className: string }) {
  return (
    <a href="#video-upload" className={className} onClick={() => trackVideoAction("video_home_cta_click")}>
      {children}
    </a>
  );
}
