export type PlausibleEvents = {
  tool_visit: { tool_slug: string };
  transcribe_success: {
    tool_slug: string;
    source?: "upload" | "record";
    input_type?: "audio" | "video" | "unknown";
    duration_sec?: number;
  };
  transcribe_fail: {
    tool_slug: string;
    source?: "upload" | "record";
    input_type?: "audio" | "video" | "unknown";
    error_code: string;
    error_message?: string;
  };
  signin_success: { method?: string };
  download_click: { format: string };
};

declare global {
  interface Window {
    plausible?: <K extends keyof PlausibleEvents>(
      eventName: K,
      options?: { props: PlausibleEvents[K] }
    ) => void;
    clarity?: (
      command: "event" | "set",
      key: string,
      value?: string | number | boolean | null
    ) => void;
  }
}

function sendToClarity<K extends keyof PlausibleEvents>(
  eventName: K,
  props?: PlausibleEvents[K]
) {
  if (typeof window === "undefined" || !window.clarity) return;

  const clarity = window.clarity;

  clarity("event", eventName);

  if (!props) return;

  Object.entries(props).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    const clarityValue =
      typeof value === "object"
        ? JSON.stringify(value)
        : (value as string | number | boolean);

    clarity("set", `${String(eventName)}_${key}`, clarityValue);
  });
}

export function trackEvent<K extends keyof PlausibleEvents>(
  eventName: K,
  props?: PlausibleEvents[K]
) {
  if (typeof window === "undefined") return;

  window.plausible?.(eventName, { props: props ?? ({} as PlausibleEvents[K]) });
  sendToClarity(eventName, props);
}
