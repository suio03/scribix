import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Footer } from "@/app/components/Footer";
import { ProductTopbar } from "@/app/components/ProductTopbar";
import { WorkspaceChrome } from "@/app/components/WorkspaceChrome";
import {
  PricingPlans,
  type PlanId,
} from "@/app/components/PricingPlans";
import { Shell } from "@/app/components/Shell";
import { getSidebarUsage } from "@/app/components/sidebarUsage";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import type { BillingCycle, Tier } from "@/lib/plans";
import { PRICING_FACTS } from "@/lib/pricing-facts";
import {
  buildPricingFeatureRows,
  compactPricingRows,
  includedPaidRows,
  type PlanFeatureCopy,
} from "@/lib/pricing-feature-rows";
import { buildPublicPricingPlans } from "@/lib/pricing-plans";

const SITE = "https://scribix.io";
const PATH = "/pricing";

type FaqCopy = {
  key: string;
  question: string;
  answer: string;
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const canonical = metadataUrlFor(locale, PATH);
  const t = await getTranslations({ locale, namespace: "PricingPage.metadata" });

  return {
    title: t("title"),
    description: t("description", PRICING_FACTS),
    alternates: {
      canonical: canonical.toString(),
      languages: pathLanguages(PATH),
    },
    openGraph: {
      title: t("ogTitle"),
      description: t("ogDescription"),
      type: "website",
      siteName: "Scribix",
      url: canonical.toString(),
    },
  };
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  let currentTier: Tier = "free";
  let currentCycle: BillingCycle | null = null;
  if (session) {
    const env = await cf();
    const user = await getOrCreateCurrentUser(env.DB, session);
    currentTier = user?.tier ?? "free";
    currentCycle = user?.billing_cycle ?? null;
  }
  const homePath = getPathname({ href: "/", locale });
  const dashboardNewPath = getPathname({ href: "/dashboard/new", locale });
  const checkoutSuccessPath = getPathname({
    href: { pathname: "/dashboard", query: { checkout: "ok" } },
    locale,
  });
  const sidebarUsage = await getSidebarUsage(session);
  const t = await getTranslations("PricingPage");
  const plans = buildPublicPricingPlans(t);
  const featureRows = buildPricingFeatureRows(t);
  const pricingFeatureRows = compactPricingRows(featureRows, t).filter(
    (feature) => feature.key !== "youtubeCaptionImports"
  );
  const includedPaidFeatures = includedPaidRows(featureRows, t).filter(
    (feature) =>
      (feature.key !== "maxFileSize" && feature.key !== "maxYoutubeCaptionVideo")
  );
  const faqCopy = t.raw("faqs") as Array<Omit<FaqCopy, "key">>;
  const faqs: FaqCopy[] = faqCopy.map((faq, index) => ({
    key: `faq-${index + 1}`,
    question: faq.question,
    answer: t(`faqs.${index}.answer`, PRICING_FACTS),
  }));
  const chooseLabels = Object.fromEntries(
    plans.map((plan) => [plan.id, t("chooseLabel", { plan: plan.name })])
  ) as Record<PlanId, string>;

  const content = (
    <div className="pricing-surface">
      <main>
        <section className="border-b border-line bg-paper px-4 py-14 sm:px-8 sm:py-18">
          <div className="mx-auto max-w-[1100px]">
            <h1 className="max-w-[760px] font-display text-[46px] font-medium leading-[1.03] tracking-tight sm:text-[64px]">
              {t("h1")}
            </h1>
          </div>
        </section>

        <section className="px-4 py-10 sm:px-8 sm:py-14">
          <div className="mx-auto max-w-[1100px]">
            <PricingPlans
              analyticsSource="pricing"
              billingLabels={{
                label: t("billingToggleLabel"),
                monthly: t("billingMonthly"),
                yearly: t("billingYearly"),
                yearlyBadge: t("billingYearlyBadge", PRICING_FACTS),
                yearlyNote: t.raw("billingYearlyNote") as string,
              }}
              bestValue={t("bestValue")}
              checkoutSuccessPath={checkoutSuccessPath}
              chooseLabels={chooseLabels}
              currentCycle={currentCycle}
              currentPlanLabel={t("currentPlanLabel")}
              currentTier={currentTier}
              dashboardNewPath={dashboardNewPath}
              density="compact"
              featureRows={pricingFeatureRows}
              noCreditCard={t("noCreditCard")}
              plans={plans}
              signedIn={!!session}
              supportUpgradeLabel={t("supportUpgradeLabel")}
              unavailableLabel={t("unavailableLabel")}
            />
            <IncludedPaidPlans
              compact
              description={t("paidIncludedDescription")}
              features={includedPaidFeatures}
              title={t("paidIncludedTitle")}
            />
          </div>
        </section>

        <section className="border-t border-line bg-card px-4 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-[1100px]">
            <h2 className="font-display text-[34px] font-medium tracking-tight">
              {t("faqTitle")}
            </h2>
            <div className="mt-6 divide-y divide-line border-y border-line">
              {faqs.map((faq) => (
                <details key={faq.key} className="group">
                  <summary className="flex items-center justify-between gap-6 py-5 text-[16px] font-medium text-ink">
                    {faq.question}
                    <ChevronDown
                      size={18}
                      strokeWidth={1.8}
                      className="shrink-0 text-muted transition group-open:rotate-180"
                    />
                  </summary>
                  <p className="max-w-[72ch] pb-5 text-[14.5px] leading-[1.7] text-muted">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );

  return (
    <Shell>
      {session ? (
        <WorkspaceChrome
          signOutRedirect={homePath}
          usage={sidebarUsage}
          userImage={session.user?.image ?? null}
          userLabel={session.user?.name ?? session.user?.email ?? null}
        >
          {content}
        </WorkspaceChrome>
      ) : (
        <>
          <ProductTopbar
            postSignInPath={dashboardNewPath}
            signOutRedirect={homePath}
          />
          {content}
        </>
      )}
    </Shell>
  );
}

function pathLanguages(path: string): Record<string, string> {
  const languages: Record<string, string> = {
    "x-default": metadataUrlFor(routing.defaultLocale, path).toString(),
  };
  for (const locale of routing.locales) {
    languages[locale] = metadataUrlFor(locale, path).toString();
  }
  return languages;
}

function metadataUrlFor(locale: string, path: string): URL {
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  return new URL(`${prefix}${path}`, SITE);
}

function IncludedPaidPlans({
  compact,
  description,
  features,
  title,
}: {
  compact: boolean;
  description: string;
  features: PlanFeatureCopy[];
  title: string;
}) {
  if (compact) {
    return (
      <section className="mt-8 border border-line bg-card px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-4">
          <p className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
            {title}
          </p>
          <p className="text-[14px] leading-6 text-muted">{description}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-8 border border-line bg-card p-5 sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:items-start">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
            {title}
          </p>
          <p className="mt-2 max-w-[42ch] text-[14px] leading-6 text-muted">
            {description}
          </p>
        </div>
        <dl className="grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-2">
          {features.map((feature) => (
            <div
              key={feature.key}
              className={`px-4 py-4 ${
                feature.key === "aiSummaries" || feature.key === "aiTranslation"
                  ? "bg-ink text-paper"
                  : "bg-paper text-ink"
              }`}
            >
              <dt
                className={`font-mono text-[10px] uppercase tracking-[0.14em] ${
                  feature.key === "aiSummaries" || feature.key === "aiTranslation"
                    ? "text-paper/50"
                    : "text-muted"
                }`}
              >
                {feature.label}
              </dt>
              <dd className="mt-1 text-[14px] font-medium leading-6">
                {feature.values.pro}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
