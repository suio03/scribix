import type { BillingCycle, PlanVersion, Tier } from "@/lib/plans";

export type PaddlePaidTier = Exclude<Tier, "free">;

export type PaddlePlan = {
  tier: PaddlePaidTier;
  cycle: BillingCycle;
  priceId: string;
  version: PlanVersion;
};

type PaddlePlanEnv = Pick<
  CloudflareEnv,
  | "PADDLE_BASIC_MONTHLY_PRICE_ID"
  | "PADDLE_BASIC_YEARLY_PRICE_ID"
  | "PADDLE_PRO_MONTHLY_PRICE_ID"
  | "PADDLE_PRO_YEARLY_PRICE_ID"
> & Partial<Record<
  | "PADDLE_V2_STARTER_MONTHLY_PRICE_ID"
  | "PADDLE_V2_STARTER_YEARLY_PRICE_ID"
  | "PADDLE_V2_PRO_MONTHLY_PRICE_ID"
  | "PADDLE_V2_PRO_YEARLY_PRICE_ID"
  | "PADDLE_HISTORICAL_PRO_MONTHLY_PRICE_ID"
  | "PADDLE_HISTORICAL_PRO_YEARLY_PRICE_ID",
  string
>>;

export function getV2PaddlePlan(env: PaddlePlanEnv, tier: string, cycle: string): PaddlePlan | null {
  if (!isPaddlePaidTier(tier) || !isBillingCycle(cycle)) return null;
  const plan = v2Plans(env).find(([candidateTier, candidateCycle]) =>
    candidateTier === tier && candidateCycle === cycle);
  const priceId = plan?.[2]?.trim();
  return priceId ? { tier, cycle, priceId, version: "v2" } : null;
}

export function findPaddlePlanByPriceId(
  env: PaddlePlanEnv,
  priceId: string | null | undefined
): PaddlePlan | null {
  if (!priceId) return null;
  const plans: Array<[PaddlePaidTier, BillingCycle, string | undefined, PlanVersion]> = [
    ["basic", "monthly", env.PADDLE_BASIC_MONTHLY_PRICE_ID, "legacy"],
    ["basic", "yearly", env.PADDLE_BASIC_YEARLY_PRICE_ID, "legacy"],
    ["pro", "monthly", env.PADDLE_PRO_MONTHLY_PRICE_ID, "legacy"],
    ["pro", "yearly", env.PADDLE_PRO_YEARLY_PRICE_ID, "legacy"],
    // Historical prices are recognized for renewals, but never offered at checkout.
    ["pro", "monthly", env.PADDLE_HISTORICAL_PRO_MONTHLY_PRICE_ID, "legacy"],
    ["pro", "yearly", env.PADDLE_HISTORICAL_PRO_YEARLY_PRICE_ID, "legacy"],
    ...v2Plans(env).map(([tier, cycle, id]): [PaddlePaidTier, BillingCycle, string | undefined, PlanVersion] =>
      [tier, cycle, id, "v2"]),
  ];
  const match = plans.find(([, , value]) => value?.trim() === priceId);
  return match ? { tier: match[0], cycle: match[1], priceId, version: match[3] } : null;
}

function v2Plans(env: PaddlePlanEnv): Array<[PaddlePaidTier, BillingCycle, string | undefined]> {
  return [
    ["basic", "monthly", env.PADDLE_V2_STARTER_MONTHLY_PRICE_ID],
    ["basic", "yearly", env.PADDLE_V2_STARTER_YEARLY_PRICE_ID],
    ["pro", "monthly", env.PADDLE_V2_PRO_MONTHLY_PRICE_ID],
    ["pro", "yearly", env.PADDLE_V2_PRO_YEARLY_PRICE_ID],
  ];
}

export function isPaddlePaidTier(value: string): value is PaddlePaidTier {
  return value === "basic" || value === "pro";
}

export function isBillingCycle(value: string): value is BillingCycle {
  return value === "monthly" || value === "yearly";
}
