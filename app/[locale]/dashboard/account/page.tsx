import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { redirect } from "@/i18n/navigation";
import { auth, signOut } from "@/auth";
import { BillingPortalButton } from "@/app/components/BillingPortalButton";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { quotaMinutesFor, type BillingCycle, type Tier } from "@/lib/plans";
import { allowancePeriodEndsAt } from "@/lib/quota-period";

export default async function AccountPage() {
  const locale = await getLocale();
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/", locale });
    return null;
  }

  const { env } = getCloudflareContext();
  const row = await getOrCreateCurrentUser(env.DB, session);
  const t = await getTranslations("Dashboard.account");
  const billingPortalT = await getTranslations("Dashboard.billingPortal");

  const tier: Tier = row?.tier ?? "free";
  const cycle = row?.billing_cycle ?? null;
  const usedMin = row?.minutes_used_this_period ?? 0;
  const quotaMin = quotaMinutesFor(tier, cycle);

  return (
    <main className="mx-auto max-w-[720px] px-4 py-12 sm:px-8">
      <h1 className="font-display text-3xl font-semibold tracking-tight">{t("title")}</h1>

      <dl className="mt-10 space-y-6 rounded-2xl border border-line p-6">
        <Field label={t("email")} value={row?.email ?? session?.user?.email ?? t("noValue")} />
        <Field label={t("name")} value={row?.full_name ?? session?.user?.name ?? t("noValue")} />
        <Field label={t("plan")} value={planLabel(t, tier, cycle, row?.subscription_status ?? null)} />
        <Field
          label={tier === "free" ? t("freeTrialUsage") : t("usageThisPeriod")}
          value={t("usageValue", { used: usedMin, quota: quotaMin })}
        />
        {tier !== "free" && (
          <Field
            label={t("periodResets")}
            value={
              row
                ? formatDate(allowancePeriodEndsAt(row), locale)
                : t("noValue")
            }
          />
        )}
      </dl>

      {tier === "free" ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/dashboard/billing"
            className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-paper hover:bg-accent"
          >
            {t("upgradePlan")}
          </Link>
        </div>
      ) : null}

      {row?.customer_id?.startsWith("ctm_") ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <BillingPortalButton
            label={billingPortalT("manage")}
            openingLabel={billingPortalT("opening")}
            errorLabel={billingPortalT("genericError")}
          />
        </div>
      ) : null}

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
        className="mt-8"
      >
        <button
          type="submit"
          className="rounded-full border border-line px-4 py-2 text-[13px] font-medium hover:bg-ink/5"
        >
          {t("signOut")}
        </button>
      </form>
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
