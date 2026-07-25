import { PRICING_DISPLAY } from "@/lib/plans";
import type { PricingPlanId } from "@/lib/pricing-feature-rows";
import { assertLocalizedItemCount } from "@/lib/localized-items";

export type PlanId = PricingPlanId;

export type PlanCopy = {
  id: PlanId;
  name: string;
  price: string;
  cadence: string;
  summary: string;
  purchaseNote?: string;
  annualPrice?: string;
  annualCadence?: string;
};

type PricingText = {
  (key: string): string;
  raw(key: string): unknown;
};

const PUBLIC_PLAN_DEFINITIONS = [
  { id: "free", messageIndex: 0 },
  { id: "pro", messageIndex: 1 },
] as const satisfies ReadonlyArray<{
  id: Extract<PlanId, "free" | "pro">;
  messageIndex: number;
}>;

export function buildPublicPricingPlans(t: PricingText): PlanCopy[] {
  assertLocalizedItemCount(
    t.raw("plans"),
    PUBLIC_PLAN_DEFINITIONS,
    "PricingPage.plans"
  );

  return PUBLIC_PLAN_DEFINITIONS.map(({ id, messageIndex }) => {
    const messagePath = `plans.${messageIndex}`;
    if (id === "free") {
      return {
        id,
        name: t(`${messagePath}.name`),
        price: formatPrice(0, PRICING_DISPLAY.pro.monthly.currency),
        cadence: t(`${messagePath}.cadence`),
        summary: t(`${messagePath}.summary`),
      };
    }

    return {
      id,
      name: t(`${messagePath}.name`),
      price: formatPrice(
        PRICING_DISPLAY.pro.monthly.amount,
        PRICING_DISPLAY.pro.monthly.currency
      ),
      cadence: t(`${messagePath}.cadence`),
      summary: t(`${messagePath}.summary`),
      purchaseNote: t(`${messagePath}.purchaseNote`),
      annualPrice: formatPrice(
        PRICING_DISPLAY.pro.yearly.amount,
        PRICING_DISPLAY.pro.yearly.currency
      ),
      annualCadence: t(`${messagePath}.annualCadence`),
    };
  });
}

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
