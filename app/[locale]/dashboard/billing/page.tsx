import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getLocale, getTranslations } from "next-intl/server";
import { getPathname, Link, redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { BillingPortalButton } from "@/app/components/BillingPortalButton";
import { UpgradePlanButton } from "@/app/components/UpgradePlanButton";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { quotaMinutesFor, type Tier } from "@/lib/plans";
import { allowancePeriodEndsAt } from "@/lib/quota-period";

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
  const [row, billingT, accountT, pricingT, portalT, sp] = await Promise.all([
    getOrCreateCurrentUser(env.DB, session),
    getTranslations("Dashboard.billing"),
    getTranslations("Dashboard.account"),
    getTranslations("PricingPage"),
    getTranslations("Dashboard.billingPortal"),
    searchParams,
  ]);

  const tier: Tier = row?.tier ?? "free";
  const cycle = row?.billing_cycle ?? null;
  const status = row?.subscription_status ?? null;
  const quotaMin = quotaMinutesFor(tier, cycle);
  const usedMin = Math.max(0, row?.minutes_used_this_period ?? 0);
  const remainingMin = Math.max(0, quotaMin - usedMin);
  const usagePercent = Math.min(100, Math.round((usedMin / Math.max(1, quotaMin)) * 100));
  const canManageBilling = Boolean(row?.customer_id?.startsWith("ctm_"));
  const isPaid = tier !== "free";
  const planName = accountT(
    tier === "free" ? "tierFree" : tier === "basic" ? "tierBasic" : "tierPro"
  );
  const cycleLabel = cycle
    ? pricingT(cycle === "yearly" ? "billingYearly" : "billingMonthly")
    : billingT("noBillingInterval");
  const statusLabel = subscriptionStatusLabel(status, isPaid, billingT);
  const checkoutSuccessPath = getPathname({
    href: { pathname: "/dashboard/billing", query: { checkout: "ok" } },
    locale,
  });

  return (
    <main className="product-surface-refresh billing-refresh mx-auto max-w-[860px] px-4 py-10 sm:px-8 sm:py-12">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {billingT("title")}
        </h1>
        <p className="mt-2 max-w-[62ch] text-sm leading-6 text-ink/60">
          {billingT("description")}
        </p>
      </header>

      {sp.checkout === "ok" ? (
        <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
          <p className="font-medium">{billingT("checkoutOkTitle")}</p>
          <p className="mt-0.5 text-emerald-800/80">{billingT("checkoutOkBody")}</p>
        </div>
      ) : null}

      <section className="mt-8 overflow-hidden rounded-2xl border border-line bg-card shadow-[0_24px_70px_-56px_color-mix(in_srgb,var(--accent)_58%,transparent)]">
        <div className="border-b border-line px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.17em] text-muted">
                {billingT("currentPlan")}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h2 className="font-display text-[30px] font-semibold tracking-[-0.035em] text-ink">
                  {planName}
                </h2>
                <span className="rounded-full border border-accent/20 bg-accent-soft px-2.5 py-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-accent">
                  {statusLabel}
                </span>
              </div>
              <p className="mt-2 max-w-[52ch] text-[13.5px] leading-6 text-muted">
                {isPaid ? billingT("paidPlanDescription") : billingT("freePlanDescription")}
              </p>
            </div>

            <div className="min-w-[190px]">
              {tier === "free" ? (
                <UpgradePlanButton
                  checkoutSuccessPath={checkoutSuccessPath}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-accent px-5 text-[13px] font-semibold text-[var(--action-text)] transition hover:bg-accent/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                >
                  {billingT("upgradePlan")}
                </UpgradePlanButton>
              ) : canManageBilling ? (
                <BillingPortalButton
                  className="min-h-11 w-full rounded-xl bg-ink px-5 text-[13px] font-semibold text-paper transition hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 disabled:cursor-wait disabled:opacity-60"
                  label={billingT("manageSubscription")}
                  openingLabel={portalT("opening")}
                  errorLabel={portalT("genericError")}
                />
              ) : (
                <a
                  href="mailto:hello@scribix.io"
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-ink px-5 text-[13px] font-semibold text-paper transition hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
                >
                  {billingT("contactSupport")}
                </a>
              )}
            </div>
          </div>
        </div>

        {isPaid ? (
          <dl className="grid border-b border-line sm:grid-cols-2">
            <BillingDetail label={billingT("planLabel")} value={planName} />
            <BillingDetail label={billingT("billingInterval")} value={cycleLabel} />
            {row ? (
              <>
                <BillingDetail
                  label={status === "canceled" ? billingT("accessEnds") : billingT("renewalDate")}
                  value={formatDate(row.period_ends_at, locale)}
                />
                <BillingDetail
                  label={billingT("usageResets")}
                  value={formatDate(allowancePeriodEndsAt(row), locale)}
                />
              </>
            ) : null}
          </dl>
        ) : null}

        {isPaid ? (
          <div className="px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
                  {billingT("processingAllowance")}
                </p>
                <p className="mt-1.5 text-[14px] font-medium text-ink">
                  {billingT("usageValue", { used: usedMin, quota: quotaMin })}
                </p>
              </div>
              <p className="text-[12px] tabular-nums text-muted">
                {billingT("remainingValue", { remaining: remainingMin })}
              </p>
            </div>
            <div
              className="mt-3 h-2 overflow-hidden rounded-full bg-paper"
              role="progressbar"
              aria-label={billingT("processingAllowance")}
              aria-valuemin={0}
              aria-valuemax={quotaMin}
              aria-valuenow={Math.min(usedMin, quotaMin)}
            >
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-300"
                style={{ width: `${usagePercent}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="px-5 py-5 sm:px-7 sm:py-6">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.15em] text-muted">
              {billingT("processingAllowance")}
            </p>
            <p className="mt-1.5 text-[18px] font-semibold text-ink">
              {billingT("remainingValue", { remaining: remainingMin })}
            </p>
            <p className="mt-1 text-[12.5px] text-muted">
              {billingT("freeAllowanceLifetime")}
            </p>
          </div>
        )}
      </section>

      <div className={`mt-5 flex flex-col gap-2 text-[12.5px] leading-5 text-muted sm:flex-row sm:items-center ${isPaid ? "sm:justify-between" : "sm:justify-end"}`}>
        {isPaid ? <p>{billingT("portalHelp")}</p> : null}
        {tier === "free" ? (
          <Link
            href="/pricing#compare-plans"
            className="shrink-0 font-semibold text-accent underline decoration-accent/30 underline-offset-4 hover:decoration-accent"
          >
            {billingT("comparePlans")}
          </Link>
        ) : null}
      </div>
    </main>
  );
}

function BillingDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-line px-5 py-4 last:border-b-0 sm:border-b-0 sm:border-r sm:px-7 sm:py-5 sm:[&:nth-child(2n)]:border-r-0 sm:[&:nth-child(n+3)]:border-t">
      <dt className="font-mono text-[9px] font-semibold uppercase tracking-[0.15em] text-muted">
        {label}
      </dt>
      <dd className="mt-1.5 text-[13.5px] font-medium text-ink">{value}</dd>
    </div>
  );
}

function subscriptionStatusLabel(
  status: string | null,
  isPaid: boolean,
  t: (key: string) => string
): string {
  if (!isPaid) return t("statusFree");
  if (status === "canceled") return t("statusCanceled");
  if (status === "expired") return t("statusExpired");
  return t("statusActive");
}

function formatDate(value: string, locale: string): string {
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString(locale, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}
