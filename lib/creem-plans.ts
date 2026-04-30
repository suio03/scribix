// Creem product-id ↔ tier/cycle mapping. Driven by env so dev and prod can
// point at separate Creem products without code changes.

import type { BillingCycle, Tier } from "./plans";

export type PaidTier = "basic" | "pro";

export type CreemPlan = {
  tier: PaidTier;
  cycle: BillingCycle;
};

const ENV_KEYS: Record<`${PaidTier}_${BillingCycle}`, string> = {
  basic_monthly: "CREEM_BASIC_MONTHLY_PRODUCT_ID",
  basic_yearly: "CREEM_BASIC_YEARLY_PRODUCT_ID",
  pro_monthly: "CREEM_PRO_MONTHLY_PRODUCT_ID",
  pro_yearly: "CREEM_PRO_YEARLY_PRODUCT_ID",
};

function entries(): Array<[string, CreemPlan]> {
  const out: Array<[string, CreemPlan]> = [];
  for (const [key, envName] of Object.entries(ENV_KEYS)) {
    const id = process.env[envName];
    if (!id) continue;
    const [tier, cycle] = key.split("_") as [PaidTier, BillingCycle];
    out.push([id, { tier, cycle }]);
  }
  return out;
}

export function findPlanByProductId(productId: string | null | undefined): CreemPlan | null {
  if (!productId) return null;
  for (const [id, plan] of entries()) {
    if (id === productId) return plan;
  }
  return null;
}

export function productIdFor(tier: PaidTier, cycle: BillingCycle): string | null {
  return process.env[ENV_KEYS[`${tier}_${cycle}`]] ?? null;
}

export const TIER_RANK: Record<Tier, number> = { free: 0, basic: 1, pro: 2 };
