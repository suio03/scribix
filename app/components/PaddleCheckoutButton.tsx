"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { trackEvent } from "@/lib/analytics";
import type { BillingCycle, Tier } from "@/lib/plans";
import type { Paddle, PaddleEventData } from "@paddle/paddle-js";

type CheckoutResponse = {
  transactionId?: string;
  url?: string | null;
  error?: string;
};

type PaddlePublicConfig = {
  clientToken?: string;
  environment?: "sandbox" | "production";
};

let paddlePromise: Promise<Paddle | null> | null = null;
let paddleConfigPromise: Promise<PaddlePublicConfig | null> | null = null;

export function PaddleCheckoutButton({
  tier,
  cycle,
  signedIn,
  checkoutSuccessPath,
  children,
  className,
  onCheckoutStart,
}: {
  tier: Exclude<Tier, "free">;
  cycle: BillingCycle;
  signedIn: boolean;
  checkoutSuccessPath: string;
  children: React.ReactNode;
  className: string;
  onCheckoutStart?: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function startCheckout() {
    setFailed(false);
    onCheckoutStart?.();
    trackEvent("checkout_click", { tier, cycle, signed_in: signedIn });
    if (!signedIn) {
      await signIn(undefined, { callbackUrl: window.location.href });
      return;
    }

    setPending(true);
    try {
      const paddleRequest = getReadyPaddle({ tier, cycle });
      const checkoutPath = new URL(checkoutSuccessPath, window.location.origin);
      checkoutPath.searchParams.delete("_ptxn");
      checkoutPath.searchParams.set("checkout", "ok");
      checkoutPath.searchParams.set("tier", tier);
      checkoutPath.searchParams.set("cycle", cycle);
      const checkoutSuccessUrl = checkoutPath.toString();

      const response = await fetch("/api/paddle/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          cycle,
          successPath: `${checkoutPath.pathname}${checkoutPath.search}`,
        }),
      });
      const json = (await response.json().catch(() => ({}))) as CheckoutResponse;
      if (!response.ok || !json.transactionId) {
        console.warn("Paddle checkout request failed:", {
          status: response.status,
          error: json.error ?? "checkout_failed",
        });
        trackEvent("checkout_fail", {
          tier,
          cycle,
          stage: "create_checkout",
          error_code: json.error ?? "checkout_failed",
          paddle_status: response.status,
        });
        setFailed(true);
        return;
      }
      trackEvent("checkout_created", {
        tier,
        cycle,
        transaction_id: json.transactionId,
      });
      saveCheckoutContext(json.transactionId, tier, cycle);

      const readyPaddle = await paddleRequest;
      if (!readyPaddle) {
        console.warn("Paddle checkout could not open because Paddle.js is not initialized.");
        trackEvent("paddle_load_fail", {
          tier,
          cycle,
          transaction_id: json.transactionId,
          error_code: "paddle_not_initialized",
        });
        trackEvent("checkout_fail", {
          tier,
          cycle,
          transaction_id: json.transactionId,
          stage: "paddle_ready",
          error_code: "paddle_not_initialized",
        });
        setFailed(true);
        return;
      }

      await pause(500);
      try {
        readyPaddle.Checkout.open({
          transactionId: json.transactionId,
          settings: { successUrl: checkoutSuccessUrl },
        });
        trackEvent("checkout_opened", {
          tier,
          cycle,
          transaction_id: json.transactionId,
        });
      } catch (error) {
        console.error("Paddle overlay open failed:", error);
        const errorMessage = error instanceof Error ? error.message : undefined;
        trackEvent("paddle_load_fail", {
          tier,
          cycle,
          transaction_id: json.transactionId,
          error_code: "paddle_overlay_open_failed",
          error_message: errorMessage,
        });
        trackEvent("checkout_fail", {
          tier,
          cycle,
          transaction_id: json.transactionId,
          stage: "open_overlay",
          error_code: "paddle_overlay_open_failed",
          error_message: errorMessage,
        });
        setFailed(true);
      }
    } catch (error) {
      console.error("Paddle checkout failed:", error);
      trackEvent("checkout_fail", {
        tier,
        cycle,
        stage: "checkout",
        error_code: "checkout_failed",
        error_message: error instanceof Error ? error.message : undefined,
      });
      setFailed(true);
    } finally {
      setPending(false);
    }
  }

  function pause(milliseconds: number) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  return (
    <button
      type="button"
      onClick={startCheckout}
      disabled={pending}
      aria-busy={pending}
      className={`${className} ${pending ? "cursor-wait opacity-70" : ""} ${
        failed ? "ring-2 ring-red-500/70 ring-offset-2 ring-offset-paper" : ""
      }`}
    >
      {children}
    </button>
  );
}

async function getReadyPaddle({
  tier,
  cycle,
}: {
  tier: Exclude<Tier, "free">;
  cycle: BillingCycle;
}): Promise<Paddle | null> {
  if (!paddlePromise) {
    paddlePromise = initializePaddleForCheckout()
      .then((instance) => {
        if (!instance) paddlePromise = null;
        return instance;
      })
      .catch((error) => {
        paddlePromise = null;
        console.error("Paddle initialization failed:", error);
        trackEvent("paddle_load_fail", {
          tier,
          cycle,
          error_code: "paddle_initialization_failed",
          error_message: error instanceof Error ? error.message : undefined,
        });
        return null;
      });
  }

  return paddlePromise;
}

async function initializePaddleForCheckout(): Promise<Paddle | null> {
  const config = await getPaddleConfig();
  if (!config?.clientToken) {
    trackEvent("paddle_load_fail", {
      error_code: "paddle_config_missing",
    });
    return null;
  }

  const { initializePaddle } = await import("@paddle/paddle-js");
  const instance = await initializePaddle({
    token: config.clientToken,
    environment: config.environment === "production" ? "production" : "sandbox",
    eventCallback: trackPaddleCheckoutEvent,
    checkout: {
      settings: {
        displayMode: "overlay",
        theme: "dark",
        variant: "one-page",
      },
    },
  });

  return instance ?? null;
}

async function getPaddleConfig(): Promise<PaddlePublicConfig | null> {
  const bundledConfig: PaddlePublicConfig = {
    clientToken: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
    environment:
      process.env.NEXT_PUBLIC_PADDLE_ENV === "production" ? "production" : "sandbox",
  };
  if (bundledConfig.clientToken) return bundledConfig;

  if (!paddleConfigPromise) {
    paddleConfigPromise = fetch("/api/paddle/config")
      .then(async (response): Promise<PaddlePublicConfig | null> => {
        if (!response.ok) {
          paddleConfigPromise = null;
          return null;
        }

        const config = (await response.json()) as PaddlePublicConfig;
        if (!config.clientToken) paddleConfigPromise = null;
        return config;
      })
      .catch((error) => {
        paddleConfigPromise = null;
        console.error("Paddle config load failed:", error);
        trackEvent("paddle_load_fail", {
          error_code: "paddle_config_load_failed",
          error_message: error instanceof Error ? error.message : undefined,
        });
        return null;
      });
  }

  return paddleConfigPromise;
}

function trackPaddleCheckoutEvent(event: PaddleEventData) {
  const data = event.data;
  const customData = checkoutCustomData(data?.custom_data);
  const stored = readCheckoutContext(data?.transaction_id);
  const common = {
    tier: customData.tier ?? stored?.tier,
    cycle: customData.cycle ?? stored?.cycle,
    transaction_id: data?.transaction_id,
    checkout_id: data?.id,
  };

  if (event.name === "checkout.completed") {
    if (data?.transaction_id && wasCheckoutCompletedTracked(data.transaction_id)) return;
    const props = {
      ...common,
    };
    trackEvent("checkout_completed", props);
    const upgradeContext = readUpgradeContext();
    if (upgradeContext && common.tier && common.cycle) {
      trackEvent("upgrade_checkout_completed", {
        ...upgradeContext,
        tier: common.tier,
        cycle: common.cycle,
        transaction_id: data?.transaction_id,
      });
      clearUpgradeContext();
    }
    if (data?.transaction_id) {
      void fetch("/api/paddle/checkout-observed", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transactionId: data.transaction_id,
        }),
      }).catch(() => {});
    }
    if (data?.transaction_id) markCheckoutCompletedTracked(data.transaction_id);
    return;
  }

  if (event.name === "checkout.closed") {
    trackEvent("checkout_closed", common);
    return;
  }

  if (
    event.name === "checkout.error" ||
    event.name === "checkout.payment.error" ||
    event.name === "checkout.payment.failed"
  ) {
    trackEvent("checkout_fail", {
      tier: customData.tier,
      cycle: customData.cycle,
      transaction_id: data?.transaction_id,
      stage: "checkout",
      error_code: event.code ?? event.name,
      error_message: event.detail,
    });
  }
}

type StoredCheckoutContext = {
  tier: "basic" | "pro";
  cycle: "monthly" | "yearly";
  savedAt: number;
};

type StoredUpgradeContext = {
  reason: "quota" | "duration" | "file_size";
  error_code: string;
  suggested_tier?: "basic" | "pro";
};

const CHECKOUT_CONTEXT_PREFIX = "scribix:checkout:";
const CHECKOUT_COMPLETED_PREFIX = "scribix:checkout_completed:";
const UPGRADE_CONTEXT_KEY = "scribix:upgrade_context";

function saveCheckoutContext(
  transactionId: string,
  tier: "basic" | "pro",
  cycle: "monthly" | "yearly"
): void {
  try {
    sessionStorage.setItem(
      `${CHECKOUT_CONTEXT_PREFIX}${transactionId}`,
      JSON.stringify({ tier, cycle, savedAt: Date.now() })
    );
  } catch {}
}

function readCheckoutContext(transactionId: string | undefined): StoredCheckoutContext | null {
  if (!transactionId) return null;
  try {
    const raw = sessionStorage.getItem(`${CHECKOUT_CONTEXT_PREFIX}${transactionId}`);
    if (!raw) return null;
    const value = JSON.parse(raw) as StoredCheckoutContext;
    if (
      (value.tier !== "basic" && value.tier !== "pro") ||
      (value.cycle !== "monthly" && value.cycle !== "yearly") ||
      !Number.isFinite(value.savedAt) ||
      Date.now() - value.savedAt > 24 * 60 * 60 * 1000
    ) {
      sessionStorage.removeItem(`${CHECKOUT_CONTEXT_PREFIX}${transactionId}`);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function wasCheckoutCompletedTracked(transactionId: string): boolean {
  try {
    return sessionStorage.getItem(`${CHECKOUT_COMPLETED_PREFIX}${transactionId}`) === "1";
  } catch {
    return false;
  }
}

function markCheckoutCompletedTracked(transactionId: string): void {
  try {
    sessionStorage.setItem(`${CHECKOUT_COMPLETED_PREFIX}${transactionId}`, "1");
  } catch {}
}

function readUpgradeContext(): StoredUpgradeContext | null {
  try {
    const raw = sessionStorage.getItem(UPGRADE_CONTEXT_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as StoredUpgradeContext;
    if (
      (value.reason !== "quota" && value.reason !== "duration" && value.reason !== "file_size") ||
      typeof value.error_code !== "string"
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function clearUpgradeContext(): void {
  try {
    sessionStorage.removeItem(UPGRADE_CONTEXT_KEY);
  } catch {}
}

function checkoutCustomData(value: object | null | undefined): {
  tier?: "basic" | "pro";
  cycle?: "monthly" | "yearly";
} {
  if (!value) return {};

  const data = value as Record<string, unknown>;
  return {
    tier: data.tier === "basic" || data.tier === "pro" ? data.tier : undefined,
    cycle: data.cycle === "monthly" || data.cycle === "yearly" ? data.cycle : undefined,
  };
}

export function FreePlanButton({
  signedIn,
  dashboardPath,
  children,
  className,
}: {
  signedIn: boolean;
  dashboardPath: string;
  children: React.ReactNode;
  className: string;
}) {
  const router = useRouter();

  async function startFree() {
    if (signedIn) {
      router.push("/dashboard/new");
      return;
    }
    await signIn(undefined, { callbackUrl: dashboardPath });
  }

  return (
    <button type="button" onClick={startFree} className={className}>
      {children}
    </button>
  );
}
