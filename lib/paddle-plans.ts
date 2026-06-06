import type { BillingCycle, Tier } from "@/lib/plans";

export type PaddlePaidTier = Exclude<Tier, "free">;

export type PaddlePlan = {
  tier: PaddlePaidTier;
  cycle: BillingCycle;
  priceId: string;
};

type PaddlePlanEnv = Pick<
  CloudflareEnv,
  | "PADDLE_BASIC_MONTHLY_PRICE_ID"
  | "PADDLE_BASIC_YEARLY_PRICE_ID"
  | "PADDLE_PRO_MONTHLY_PRICE_ID"
  | "PADDLE_PRO_YEARLY_PRICE_ID"
>;

export function getPaddlePlan(
  env: PaddlePlanEnv,
  tier: string,
  cycle: string
): PaddlePlan | null {
  if (!isPaddlePaidTier(tier) || !isBillingCycle(cycle)) return null;
  const priceId = getPaddlePriceId(env, tier, cycle);
  if (!priceId) return null;
  return { tier, cycle, priceId };
}

export function getPaddlePriceId(
  env: PaddlePlanEnv,
  tier: PaddlePaidTier,
  cycle: BillingCycle
): string | null {
  const key = `PADDLE_${tier === "basic" ? "BASIC" : "PRO"}_${
    cycle === "monthly" ? "MONTHLY" : "YEARLY"
  }_PRICE_ID` as keyof PaddlePlanEnv;
  return env[key]?.trim() || null;
}

export function findPaddlePlanByPriceId(
  env: PaddlePlanEnv,
  priceId: string | null | undefined
): PaddlePlan | null {
  if (!priceId) return null;
  const plans: Array<[PaddlePaidTier, BillingCycle, string | undefined]> = [
    ["basic", "monthly", env.PADDLE_BASIC_MONTHLY_PRICE_ID],
    ["basic", "yearly", env.PADDLE_BASIC_YEARLY_PRICE_ID],
    ["pro", "monthly", env.PADDLE_PRO_MONTHLY_PRICE_ID],
    ["pro", "yearly", env.PADDLE_PRO_YEARLY_PRICE_ID],
  ];
  const match = plans.find(([, , value]) => value?.trim() === priceId);
  return match ? { tier: match[0], cycle: match[1], priceId } : null;
}

export function isPaddlePaidTier(value: string): value is PaddlePaidTier {
  return value === "basic" || value === "pro";
}

export function isBillingCycle(value: string): value is BillingCycle {
  return value === "monthly" || value === "yearly";
}
