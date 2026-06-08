"use client";

import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { usePaddle } from "@/app/components/PaddleProvider";
import { trackEvent } from "@/lib/analytics";
import type { BillingCycle, Tier } from "@/lib/plans";

type CheckoutResponse = {
  transactionId?: string;
  url?: string | null;
  error?: string;
};

export function PaddleCheckoutButton({
  tier,
  cycle,
  signedIn,
  checkoutSuccessPath,
  children,
  className,
}: {
  tier: Exclude<Tier, "free">;
  cycle: BillingCycle;
  signedIn: boolean;
  checkoutSuccessPath: string;
  children: React.ReactNode;
  className: string;
}) {
  const paddle = usePaddle();
  const paddleRef = useRef(paddle);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    paddleRef.current = paddle;
  }, [paddle]);

  async function startCheckout() {
    setFailed(false);
    trackEvent("checkout_click", { tier, cycle, signed_in: signedIn });
    if (!signedIn) {
      await signIn(undefined, { callbackUrl: window.location.href });
      return;
    }

    setPending(true);
    try {
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

      const readyPaddle = await getReadyPaddle();
      if (!readyPaddle) {
        console.warn("Paddle checkout could not open because Paddle.js is not initialized.");
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

      // Paddle's hosted URL is only a last-resort artifact from the transaction
      // API. The production pricing CTA should follow the ai-music path and
      // open the pre-created transaction directly in the overlay.
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
        trackEvent("checkout_fail", {
          tier,
          cycle,
          transaction_id: json.transactionId,
          stage: "open_overlay",
          error_code: "paddle_overlay_open_failed",
          error_message: error instanceof Error ? error.message : undefined,
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

  async function getReadyPaddle() {
    const existing = paddleRef.current;
    if (existing) return existing;

    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      await pause(100);
      if (paddleRef.current) return paddleRef.current;
    }

    return null;
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
