"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Check, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { getPathname, Link } from "@/i18n/navigation";
import { V2_PLANS } from "@/lib/plans";
import { PRICING_V2 } from "@/lib/pricing-v2";
import type { UpgradeContext } from "@/app/api/billing/upgrade-context/route";
import { BillingPortalButton } from "./BillingPortalButton";
import { PaddleCheckoutButton } from "./PaddleCheckoutButton";
import {
  BillingCycleToggle,
  paidPlanPrice,
  planIdForTier,
  useUsd,
  type Cycle,
  type PaidPlanId,
} from "./PricingShared";

export type UpgradeReason =
  | "plan"
  | "translation"
  | "summary"
  | "chat"
  | "quota"
  | "duration"
  | "file_size"
  | "video_storage";

export function UpgradePlanModal({
  reason,
  open,
  onClose,
}: {
  reason: UpgradeReason | null;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("Dashboard.viewer");
  const pricingT = useTranslations("PricingV2");
  const portalT = useTranslations("Dashboard.billingPortal");
  const locale = useLocale();
  const usd = useUsd();
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [context, setContext] = useState<UpgradeContext | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadFailed(false);
    fetch("/api/billing/upgrade-context", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<UpgradeContext> : Promise.reject())
      .then((value) => { if (!cancelled) setContext(value); })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; };
  }, [open]);

  if (!open || !reason || typeof document === "undefined") return null;
  const copy = reason === "plan"
    ? { title: safeT(t, "upgradePlanModalTitle", "Upgrade your plan"), body: pricingT("modal.body") }
    : upgradeReasonCopy(reason, t);
  const currentPlan = context ? planIdForTier(context.tier) : null;
  const offered: PaidPlanId[] = currentPlan === "starter" ? ["pro"] : ["starter", "pro"];
  const checkoutSuccessPath = getPathname({
    href: { pathname: "/dashboard", query: { checkout: "ok" } }, locale,
  });
  const highlights: Record<PaidPlanId, string[]> = {
    starter: [
      pricingT("plans.starter.highlight1"),
      pricingT("plans.starter.highlight2"),
      pricingT("plans.socialAccounts", { count: PRICING_V2.starter.socialAccounts }),
    ],
    pro: [
      pricingT("modal.proEverything"),
      pricingT("plans.pro.highlight1", { questions: PRICING_V2.pro.askAiQuestions }),
      pricingT("plans.socialAccounts", { count: PRICING_V2.pro.socialAccounts }),
    ],
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="upgrade-plan-title"
      className="surface-modal-backdrop fixed inset-0 z-[110] flex items-center justify-center bg-ink/35 px-4 py-4 backdrop-blur-sm"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="surface-modal max-h-[calc(100vh-2rem)] w-full max-w-[720px] overflow-y-auto rounded-2xl border border-line bg-paper shadow-[0_30px_80px_-35px_rgba(14,13,11,0.45)]">
        <div className="flex items-start justify-between gap-4 px-5 pt-5 sm:px-7 sm:pt-7">
          <div>
            <h2 id="upgrade-plan-title" className="font-display text-[24px] font-semibold tracking-tight text-ink">{copy.title}</h2>
            <p className="mt-1.5 max-w-[540px] text-[14px] leading-6 text-muted">{copy.body}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={safeT(t, "closeUpgrade", "Close upgrade modal")}
            className="inline-grid size-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-ink/5 hover:text-ink"><X size={17} /></button>
        </div>

        {currentPlan === "pro" ? (
          <div className="px-5 pb-6 pt-5 sm:px-7 sm:pb-7">
            <p className="rounded-xl border border-line bg-card px-4 py-3 text-[14px] text-ink">{pricingT("modal.onPro")}</p>
            <Link href="/dashboard/billing" onClick={onClose}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-ink px-5 text-[14px] font-semibold text-paper transition hover:opacity-85">
              {pricingT("actions.manage")}
            </Link>
          </div>
        ) : (
          <div className="px-5 pb-5 pt-5 sm:px-7 sm:pb-6">
            {offered.length > 1 || currentPlan === null ? (
              <BillingCycleToggle cycle={cycle} onChange={setCycle} size="sm" />
            ) : null}
            <div className={`mt-4 grid gap-3 ${offered.length > 1 ? "sm:grid-cols-2" : ""}`}>
              {offered.map((id) => {
                const price = paidPlanPrice(id, cycle);
                const recommended = id === "starter" || offered.length === 1;
                return (
                  <article key={id} className={`flex flex-col rounded-xl border p-5 ${recommended ? "border-accent bg-card" : "border-line bg-card"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-[20px] font-semibold text-ink">{pricingT(`plans.${id}.name`)}</h3>
                      {recommended && offered.length > 1 ? (
                        <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-paper">{pricingT("plans.recommended")}</span>
                      ) : null}
                    </div>
                    <div className="mt-3 flex items-end gap-1.5">
                      <span className="font-display text-[36px] font-semibold leading-none tracking-[-0.04em] text-ink">{usd(price.perMonth)}</span>
                      <span className="pb-1 text-[13px] text-muted">{pricingT("billing.perMonth")}</span>
                    </div>
                    <p className="mt-1.5 text-[12px] text-muted">{cycle === "yearly"
                      ? pricingT("billing.billedYearly", { price: usd(price.billed) })
                      : pricingT("billing.billedMonthly")}</p>
                    <p className="mt-4 text-[13.5px] font-semibold text-ink">{pricingT("values.monthlyMinutes", { minutes: PRICING_V2[id].processingMinutes })}</p>
                    <ul className="mt-3 space-y-2">{highlights[id].map((highlight) => (
                      <li key={highlight} className="flex items-start gap-2 text-[13px] leading-5 text-ink"><Check size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />{highlight}</li>
                    ))}</ul>
                    <div className="mt-auto pt-5">
                      <PlanAction id={id} cycle={cycle} context={context} loadFailed={loadFailed}
                        checkoutSuccessPath={checkoutSuccessPath} recommended={recommended}
                        labels={{
                          get: pricingT("actions.getPlan", { plan: pricingT(`plans.${id}.name`) }),
                          change: pricingT("actions.changePlan"),
                          soon: pricingT("actions.checkoutSoon"),
                          loading: pricingT("modal.loading"),
                          unavailable: pricingT("modal.loadError"),
                          opening: portalT("opening"),
                          portalError: portalT("genericError"),
                        }} />
                    </div>
                  </article>
                );
              })}
            </div>
            {context && !context.checkoutEnabled ? (
              <p className="mt-3 text-[12.5px] leading-5 text-muted" role="status">{pricingT("modal.checkoutUnavailable")}</p>
            ) : null}
            <Link href="/pricing#compare-plans" onClick={onClose}
              className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted underline-offset-4 transition hover:text-ink hover:underline">
              {pricingT("modal.compareLink")} <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" />
            </Link>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function PlanAction({
  id,
  cycle,
  context,
  loadFailed,
  checkoutSuccessPath,
  recommended,
  labels,
}: {
  id: PaidPlanId;
  cycle: Cycle;
  context: UpgradeContext | null;
  loadFailed: boolean;
  checkoutSuccessPath: string;
  recommended: boolean;
  labels: Record<"get" | "change" | "soon" | "loading" | "unavailable" | "opening" | "portalError", string>;
}) {
  const className = `min-h-11 w-full rounded-xl px-5 text-[14px] font-semibold transition hover:opacity-85 ${recommended ? "bg-accent text-paper" : "bg-ink text-paper"}`;
  if (!context) {
    return (
      <button type="button" disabled className={`${className} cursor-default opacity-60`}>
        {loadFailed ? labels.unavailable : labels.loading}
      </button>
    );
  }
  // Paid subscribers change plans in the Paddle portal; new checkout rejects them.
  if (context.tier !== "free") {
    return <BillingPortalButton className={`${className} disabled:cursor-wait disabled:opacity-60`}
      label={labels.change} openingLabel={labels.opening} errorLabel={labels.portalError} />;
  }
  if (!context.checkoutEnabled) {
    return <button type="button" disabled className={`${className} cursor-not-allowed opacity-60`}>{labels.soon}</button>;
  }
  return (
    <PaddleCheckoutButton tier={id === "starter" ? "basic" : "pro"} cycle={cycle} version="v2"
      signedIn={context.signedIn} checkoutSuccessPath={checkoutSuccessPath} className={className}>
      {labels.get}
    </PaddleCheckoutButton>
  );
}

function upgradeReasonCopy(
  reason: UpgradeReason,
  t: ((key: string) => string) & { has?: (key: string) => boolean }
) {
  if (reason === "summary") return {
    title: safeT(t, "upgradeSummaryModalTitle", "Create AI notes"),
    body: safeT(t, "upgradeSummaryModalBody", "Upgrade to turn completed transcripts into an overview, key points, and action items."),
  };
  if (reason === "chat") return {
    title: safeT(t, "upgradeChatModalTitle", "Ask this transcript"),
    body: safeTValues(t, "upgradeChatModalBody", `Starter includes ${V2_PLANS.basic.aiQuestionsPerMonth} and Pro includes ${V2_PLANS.pro.aiQuestionsPerMonth} Ask AI questions per month.`,
      { starterCount: V2_PLANS.basic.aiQuestionsPerMonth, proCount: V2_PLANS.pro.aiQuestionsPerMonth }),
  };
  if (reason === "quota") return {
    title: safeT(t, "upgradeQuotaModalTitle", "Keep transcribing"),
    body: safeT(t, "upgradeQuotaModalBody", "Upgrade to add more transcription minutes and continue without waiting."),
  };
  if (reason === "duration") return {
    title: safeT(t, "upgradeDurationModalTitle", "Transcribe this longer file"),
    body: safeT(t, "upgradeDurationModalBody", "Choose a plan whose per-file duration limit covers this recording."),
  };
  if (reason === "file_size") return {
    title: safeT(t, "upgradeFileSizeModalTitle", "Upload this larger video"),
    body: safeT(t, "upgradeFileSizeModalBody", "Paid plans support larger direct video uploads. Audio files still have a 1 GB limit."),
  };
  if (reason === "video_storage") return {
    title: safeT(t, "upgradeVideoStorageModalTitle", "Keep your source videos"),
    body: safeT(t, "upgradeVideoStorageModalBody", "Upgrade to retain more source-video storage and keep creating clips without re-uploading."),
  };
  return {
    title: safeT(t, "upgradeTranslationModalTitle", "Translate this transcript"),
    body: safeT(t, "upgradeTranslationModalBody", "Upgrade to translate completed transcripts into supported languages with speaker-aligned output."),
  };
}

function safeT(t: ((key: string) => string) & { has?: (key: string) => boolean }, key: string, fallback: string): string {
  try {
    if (typeof t.has === "function" && !t.has(key)) return fallback;
    return t(key);
  } catch { return fallback; }
}

function safeTValues(
  t: ((key: string, values?: Record<string, string | number>) => string) & { has?: (key: string) => boolean },
  key: string,
  fallback: string,
  values: Record<string, string | number>
): string {
  try {
    if (typeof t.has === "function" && !t.has(key)) return fallback;
    return t(key, values);
  } catch { return fallback; }
}
