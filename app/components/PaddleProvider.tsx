"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { initializePaddle, type Paddle, type PaddleEventData } from "@paddle/paddle-js";
import { trackEvent } from "@/lib/analytics";

const PaddleContext = createContext<Paddle | null>(null);

type PaddlePublicConfig = {
  clientToken?: string;
  environment?: "sandbox" | "production";
};

export function PaddleProvider({ children }: { children: ReactNode }) {
  const [paddle, setPaddle] = useState<Paddle | null>(null);
  const [config, setConfig] = useState<PaddlePublicConfig>(() => ({
    clientToken: process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
    environment:
      process.env.NEXT_PUBLIC_PADDLE_ENV === "production" ? "production" : "sandbox",
  }));

  const token = config.clientToken;
  const environment = config.environment === "production" ? "production" : "sandbox";

  // [paddle-diag] temporary: confirm whether the client token was inlined at build time.
  console.log("[paddle-diag] build-inlined token present:", Boolean(process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN), "env:", process.env.NEXT_PUBLIC_PADDLE_ENV);

  useEffect(() => {
    if (token) return;
    let canceled = false;

    console.log("[paddle-diag] no build-time token, fetching /api/paddle/config…");
    fetch("/api/paddle/config")
      .then(async (response): Promise<PaddlePublicConfig | null> =>
        response.ok ? ((await response.json()) as PaddlePublicConfig) : null
      )
      .then((nextConfig) => {
        console.log("[paddle-diag] /api/paddle/config returned token present:", Boolean(nextConfig?.clientToken), "env:", nextConfig?.environment);
        if (canceled || !nextConfig?.clientToken) return;
        setConfig({
          clientToken: nextConfig.clientToken,
          environment: nextConfig.environment === "production" ? "production" : "sandbox",
        });
      })
      .catch((error) => {
        console.error("Paddle config load failed:", error);
        trackEvent("checkout_fail", {
          stage: "paddle_config",
          error_code: "paddle_config_load_failed",
          error_message: error instanceof Error ? error.message : undefined,
        });
      });

    return () => {
      canceled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let canceled = false;

    console.log("[paddle-diag] initializing Paddle with token present:", Boolean(token), "environment:", environment);
    initializePaddle({
      token,
      environment,
      eventCallback: trackPaddleCheckoutEvent,
      checkout: {
        settings: {
          displayMode: "overlay",
          theme: "dark",
          variant: "one-page",
        },
      },
    })
      .then((instance) => {
        console.log("[paddle-diag] initializePaddle resolved, instance present:", Boolean(instance));
        if (!canceled && instance) setPaddle(instance);
      })
      .catch((error) => {
        console.error("Paddle initialization failed:", error);
        trackEvent("checkout_fail", {
          stage: "paddle_init",
          error_code: "paddle_initialization_failed",
          error_message: error instanceof Error ? error.message : undefined,
        });
      });

    return () => {
      canceled = true;
    };
  }, [environment, token]);

  return <PaddleContext.Provider value={paddle}>{children}</PaddleContext.Provider>;
}

export function usePaddle() {
  return useContext(PaddleContext);
}

function trackPaddleCheckoutEvent(event: PaddleEventData) {
  const data = event.data;
  const customData = checkoutCustomData(data?.custom_data);
  const common = {
    tier: customData.tier,
    cycle: customData.cycle,
    transaction_id: data?.transaction_id,
    checkout_id: data?.id,
  };

  if (event.name === "checkout.completed") {
    trackEvent("checkout_completed", {
      ...common,
      currency_code: data?.currency_code,
      total: data?.totals?.total,
      payment_method: data?.payment?.method_details?.type,
    });
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
