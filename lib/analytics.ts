export type PlausibleEvents = {
  tool_visit: { tool_slug: string };
  transcribe_success: { tool_slug: string; duration_sec?: number };
  transcribe_fail: { tool_slug: string; error_code: string };
  signin_success: { method?: string };
  download_click: { format: string };
};

declare global {
  interface Window {
    plausible?: <K extends keyof PlausibleEvents>(
      eventName: K,
      options?: { props: PlausibleEvents[K] }
    ) => void;
  }
}

export function trackEvent<K extends keyof PlausibleEvents>(
  eventName: K,
  props?: PlausibleEvents[K]
) {
  if (typeof window === "undefined") return;
  window.plausible?.(eventName, { props: props ?? ({} as PlausibleEvents[K]) });
}
