import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getLocale, getTranslations } from "next-intl/server";
import { getPathname, redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { BillingPortalButton } from "@/app/components/BillingPortalButton";
import {
  PricingPlans,
  type PlanCopy,
  type PlanFeatureCopy,
  type PlanId,
} from "@/app/components/PricingPlans";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { quotaMinutesFor, type BillingCycle, type Tier } from "@/lib/plans";

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
  const accountT = await getTranslations("Dashboard.account");
  const pricingT = await getTranslations("PricingPage");
  const billingPortalT = await getTranslations("Dashboard.billingPortal");
  const sp = await searchParams;

  const tier: Tier = row?.tier ?? "free";
  const cycle = row?.billing_cycle ?? null;
  const usedMin = row?.minutes_used_this_period ?? 0;
  const quotaMin = quotaMinutesFor(tier, cycle);
  const plans = pricingT.raw("plans") as PlanCopy[];
  const upgradePlans = plans.filter((plan) => plan.id !== "free");
  const featureRows = pricingT.raw("featureRows") as PlanFeatureCopy[];
  const chooseLabels = Object.fromEntries(
    plans.map((plan) => [plan.id, pricingT("chooseLabel", { plan: plan.name })])
  ) as Record<PlanId, string>;
  const checkoutSuccessPath = getPathname({
    href: { pathname: "/dashboard/billing", query: { checkout: "ok" } },
    locale,
  });
  const dashboardNewPath = getPathname({ href: "/dashboard/new", locale });

  return (
    <main className="mx-auto max-w-[1100px] px-4 py-10 sm:px-8 sm:py-12">
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

      <section className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="rounded-2xl border border-line bg-card p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            {billingT("currentPlan")}
          </p>
          <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight">
            {planLabel(accountT, tier, cycle, row?.subscription_status ?? null)}
          </h2>
          <dl className="mt-6 space-y-4">
            <Field
              label={tier === "free" ? accountT("freeTrialUsage") : accountT("usageThisPeriod")}
              value={accountT("usageValue", { used: usedMin, quota: quotaMin })}
            />
            {tier !== "free" ? (
              <Field
                label={accountT("periodResets")}
                value={row ? formatDate(row.period_ends_at, locale) : accountT("noValue")}
              />
            ) : null}
          </dl>
          {row?.customer_id?.startsWith("ctm_") ? (
            <div className="mt-6">
              <BillingPortalButton
                label={billingPortalT("manage")}
                openingLabel={billingPortalT("opening")}
                errorLabel={billingPortalT("genericError")}
              />
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-line bg-paper p-6">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            {billingT("choosePlanTitle")}
          </h2>
          <p className="mt-2 text-sm leading-6 text-ink/60">
            {billingT("choosePlanDescription")}
          </p>
        </div>
      </section>

      <section className="mt-8">
        <PricingPlans
          billingLabels={{
            label: pricingT("billingToggleLabel"),
            monthly: pricingT("billingMonthly"),
            yearly: pricingT("billingYearly"),
            yearlyBadge: pricingT("billingYearlyBadge"),
          }}
          bestValue={pricingT("bestValue")}
          checkoutSuccessPath={checkoutSuccessPath}
          chooseLabels={chooseLabels}
          currentCycle={cycle}
          currentPlanLabel={pricingT("currentPlanLabel")}
          currentTier={tier}
          dashboardNewPath={dashboardNewPath}
          featureRows={featureRows}
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm text-ink/60">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

function planLabel(
  t: (key: string) => string,
  tier: Tier,
  cycle: BillingCycle | null,
  status: string | null
): string {
  const tierKey = tier === "free" ? "tierFree" : tier === "basic" ? "tierBasic" : "tierPro";
  const name = t(tierKey);
  if (tier === "free") return name;
  const parts: string[] = [name];
  if (cycle) parts.push(t(cycle === "yearly" ? "cycleYearly" : "cycleMonthly"));
  if (status === "canceled") parts.push(t("statusCanceled"));
  if (status === "expired") parts.push(t("statusExpired"));
  return parts.join(" · ");
}

function formatDate(s: string, locale: string) {
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime())
    ? s
    : d.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}
