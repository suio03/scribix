"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { usePaddle } from "@/app/components/PaddleProvider";
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
  successPath,
  children,
  className,
}: {
  tier: Exclude<Tier, "free">;
  cycle: BillingCycle;
  signedIn: boolean;
  successPath: string;
  children: React.ReactNode;
  className: string;
}) {
  const { paddle, initialized } = usePaddle();
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function startCheckout() {
    setFailed(false);
    if (!signedIn) {
      await signIn(undefined, { callbackUrl: window.location.href });
      return;
    }
    if (!initialized || !paddle) {
      setFailed(true);
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/paddle/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, cycle, successPath }),
      });
      const json = (await response.json().catch(() => ({}))) as CheckoutResponse;
      if (!response.ok || !json.transactionId) {
        throw new Error(json.error ?? "checkout_failed");
      }

      // Opening from a pre-created transaction: Paddle.js takes the checkout
      // config (presentation + return URL) from the transaction itself, so we
      // pass ONLY the transactionId. Presentation settings come from
      // initializePaddle(); the return URL is the transaction's checkout.url.
      paddle.Checkout.open({ transactionId: json.transactionId });
    } catch (error) {
      console.error("Paddle checkout failed:", error);
      setFailed(true);
    } finally {
      setPending(false);
    }
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
