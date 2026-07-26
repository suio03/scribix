import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getLocale, getTranslations } from "next-intl/server";
import { getPathname, redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import {
  PricingPlans,
  type PlanId,
} from "@/app/components/PricingPlans";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import type { Tier } from "@/lib/plans";
import { PRICING_FACTS } from "@/lib/pricing-facts";
import {
  buildPricingFeatureRows,
  compactBillingRows,
} from "@/lib/pricing-feature-rows";
import { buildPublicPricingPlans } from "@/lib/pricing-plans";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const locale = await getLocale();
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/", locale });
    return null;
  }

  const { env } = getCloudflareContext();
  const row = await getOrCreateCurrentUser(env.DB, session);
  const billingT = await getTranslations("Dashboard.billing");
  const pricingT = await getTranslations("PricingPage");
  const sp = await searchParams;

  const tier: Tier = row?.tier ?? "free";
  const cycle = row?.billing_cycle ?? null;
  const plans = buildPublicPricingPlans(pricingT);
  const upgradePlans = plans.filter((plan) => plan.id !== "free");
  const featureRows = buildPricingFeatureRows(pricingT);
  const billingFeatureRows = compactBillingRows(featureRows, billingT).filter(
    (feature) => feature.key !== "youtubeCaptionImports"
  );
  const chooseLabels = Object.fromEntries(
    plans.map((plan) => [plan.id, pricingT("chooseLabel", { plan: plan.name })])
  ) as Record<PlanId, string>;
  const checkoutSuccessPath = getPathname({
    href: { pathname: "/dashboard/billing", query: { checkout: "ok" } },
    locale,
  });
  const dashboardNewPath = getPathname({ href: "/dashboard/new", locale });

  return (
    <main className="product-surface-refresh billing-refresh mx-auto max-w-[860px] px-4 py-10 sm:px-8 sm:py-12">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {billingT("title")}
          </h1>
          <p className="mt-2 max-w-[62ch] text-sm leading-6 text-ink/60">
            {billingT("description")}
          </p>
        </div>
      </div>

      {sp.checkout === "ok" ? (
        <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
          <p className="font-medium">{billingT("checkoutOkTitle")}</p>
          <p className="mt-0.5 text-emerald-800/80">{billingT("checkoutOkBody")}</p>
        </div>
      ) : null}

      <section className="mt-8">
        <PricingPlans
          analyticsSource="billing"
          billingLabels={{
            label: pricingT("billingToggleLabel"),
            monthly: pricingT("billingMonthly"),
            yearly: pricingT("billingYearly"),
            yearlyBadge: pricingT("billingYearlyBadge", PRICING_FACTS),
            yearlyNote: pricingT.raw("billingYearlyNote") as string,
          }}
          bestValue={pricingT("bestValue")}
          checkoutSuccessPath={checkoutSuccessPath}
          chooseLabels={chooseLabels}
          currentCycle={cycle}
          currentPlanLabel={pricingT("currentPlanLabel")}
          currentTier={tier}
          dashboardNewPath={dashboardNewPath}
          density="compact"
          featureRows={billingFeatureRows}
          noCreditCard={pricingT("noCreditCard")}
          plans={upgradePlans}
          signedIn={true}
          supportUpgradeLabel={pricingT("supportUpgradeLabel")}
          unavailableLabel={pricingT("unavailableLabel")}
        />
      </section>
    </main>
  );
}
