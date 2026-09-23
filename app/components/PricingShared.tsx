"use client";

import { useLocale, useTranslations } from "next-intl";
import { PRICING_V2 } from "@/lib/pricing-v2";

export type Cycle = "monthly" | "yearly";
export type PaidPlanId = "starter" | "pro";

export const YEARLY_DISCOUNT_PERCENT = Math.round(
  (1 - PRICING_V2.starter.yearlyUsd / (12 * PRICING_V2.starter.monthlyUsd)) * 100
);

export function planIdForTier(tier: "free" | "basic" | "pro"): "free" | PaidPlanId {
  return tier === "basic" ? "starter" : tier;
}

export function useUsd() {
  const locale = useLocale();
  return (value: number) => new Intl.NumberFormat(locale, {
    style: "currency", currency: "USD", minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function paidPlanPrice(id: PaidPlanId, cycle: Cycle) {
  const plan = PRICING_V2[id];
  return cycle === "yearly"
    ? { perMonth: plan.yearlyUsd / 12, billed: plan.yearlyUsd }
    : { perMonth: plan.monthlyUsd, billed: plan.monthlyUsd };
}

export function BillingCycleToggle({
  cycle,
  onChange,
  size = "md",
}: {
  cycle: Cycle;
  onChange: (cycle: Cycle) => void;
  size?: "sm" | "md";
}) {
  const t = useTranslations("PricingV2.billing");
  const option = (value: Cycle, label: React.ReactNode) => (
    <button type="button" aria-pressed={cycle === value} onClick={() => onChange(value)}
      className={`inline-flex items-center gap-2 rounded-full font-semibold transition ${size === "sm" ? "min-h-9 px-3.5 text-[13px]" : "min-h-10 px-4 text-sm"} ${cycle === value ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}>
      {label}
    </button>
  );
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-line bg-card p-1" role="group" aria-label={t("label")}>
      {option("monthly", t("monthly"))}
      {option("yearly", <>
        {t("yearly")}
        <span className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-bold leading-none ${cycle === "yearly" ? "bg-paper/20 text-paper" : "bg-amber-100 text-amber-800"}`}>
          {t("discountBadge", { percent: YEARLY_DISCOUNT_PERCENT })}
        </span>
      </>)}
    </div>
  );
}
