"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { observePendingSignIn } from "@/lib/signin-tracking";
export { markSignInPending } from "@/lib/signin-tracking";
import { trackEvent } from "@/lib/analytics";

export function TrackToolVisit({ slug }: { slug: string }) {
  useEffect(() => {
    trackEvent("tool_visit", { tool_slug: slug });
  }, [slug]);
  return null;
}

export function TrackSignInSuccess() {
  const pathname = usePathname();
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let checks = 0;
    const check = async () => {
      const finished = await observePendingSignIn();
      if (!cancelled && !finished && ++checks < 12) timer = setTimeout(check, 5_000);
    };
    void check();
    return () => { cancelled = true; if (timer !== undefined) clearTimeout(timer); };
  }, [pathname]);
  return null;
}
