"use client";

import { useEffect } from "react";
import { signIn } from "next-auth/react";

const ONE_TAP_COOLDOWN_KEY = "scribix:google-one-tap-cooldown-until";
const ONE_TAP_COOLDOWN_MS = 60 * 60 * 1000;

type GsiId = {
  initialize: (config: {
    client_id: string;
    callback: (response: { credential: string }) => void;
    use_fedcm_for_prompt?: boolean;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
    context?: "signin" | "signup" | "use";
  }) => void;
  prompt: (listener?: (notification: PromptMomentNotification) => void) => void;
  disableAutoSelect: () => void;
};

type PromptMomentNotification = {
  isSkippedMoment: () => boolean;
  isDismissedMoment: () => boolean;
  getDismissedReason?: () => "credential_returned" | "cancel_called" | "flow_restarted" | string;
};

declare global {
  interface Window {
    google?: { accounts?: { id?: GsiId } };
  }
}

function getCooldownUntil(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(ONE_TAP_COOLDOWN_KEY);
  if (!raw) return 0;
  const value = Number(raw);
  return Number.isFinite(value) ? value : 0;
}

function setCooldown(ms: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ONE_TAP_COOLDOWN_KEY, String(Date.now() + ms));
}

function clearCooldown() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ONE_TAP_COOLDOWN_KEY);
}

export function GoogleOneTap({ clientId }: { clientId: string }) {
  useEffect(() => {
    if (!clientId) return;
    if (Date.now() < getCooldownUntil()) return;
    let cancelled = false;

    const tick = setInterval(() => {
      if (cancelled) return;
      const id = window.google?.accounts?.id;
      if (!id) return;
      clearInterval(tick);

      id.initialize({
        client_id: clientId,
        callback: async (response) => {
          const result = await signIn("google-onetap", {
            idToken: response.credential,
            redirect: false,
          });
          if (result?.ok) {
            clearCooldown();
            window.location.reload();
          }
        },
        use_fedcm_for_prompt: true,
        auto_select: false,
        cancel_on_tap_outside: false,
        context: "signin",
      });
      id.prompt((notification) => {
        if (notification.isDismissedMoment()) {
          const reason = notification.getDismissedReason?.();
          if (reason !== "credential_returned") {
            setCooldown(ONE_TAP_COOLDOWN_MS);
          }
          return;
        }

        if (notification.isSkippedMoment()) {
          setCooldown(ONE_TAP_COOLDOWN_MS);
        }
      });
    }, 100);

    return () => {
      cancelled = true;
      clearInterval(tick);
    };
  }, [clientId]);

  return null;
}
