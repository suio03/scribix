"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

export function TrackToolVisit({ slug }: { slug: string }) {
  useEffect(() => {
    trackEvent("tool_visit", { tool_slug: slug });
  }, [slug]);
  return null;
}

const SIGNIN_FLAG = "scribix:signin_pending";

// Flag is set just before OAuth redirect; sessionStorage survives the round-trip
// so we can fire signin_success exactly once when the user returns signed in.
export function markSignInPending() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SIGNIN_FLAG, "1");
  } catch {}
}

export function TrackSignInSuccess() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem(SIGNIN_FLAG)) {
        sessionStorage.removeItem(SIGNIN_FLAG);
        trackEvent("signin_success", { method: "google" });
      }
    } catch {}
  }, []);
  return null;
}
