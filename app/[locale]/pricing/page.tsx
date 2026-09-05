import type { Metadata } from "next";
import {
  Captions,
  Check,
  ChevronDown,
  Crop,
  Download,
  Film,
  Minus,
  Palette,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Footer } from "@/app/components/Footer";
import { ProductTopbar } from "@/app/components/ProductTopbar";
import { WorkspaceChrome } from "@/app/components/WorkspaceChrome";
import {
  PricingPlans,
  type PlanCopy,
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
  showcasePricingRows,
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

type ProductFeatureCopy = {
  title: string;
  body: string;
};

type PlanComparisonRow = {
  key: string;
  label: string;
  values: Record<"free" | "pro", string>;
};

const PRODUCT_FEATURE_ICONS = [
  Sparkles,
  Film,
  Captions,
  Crop,
  Palette,
  Download,
] as const satisfies readonly LucideIcon[];

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
  const videoT = await getTranslations("VideoHome");
  const transcriptT = await getTranslations("Features");
  const plans = buildPublicPricingPlans(t);
  const featureRows = buildPricingFeatureRows(t);
  const englishShowcase = locale === "en";
  const pricingFeatureRows = (
    englishShowcase
      ? showcasePricingRows(featureRows)
      : compactPricingRows(featureRows, t)
  ).filter((feature) => feature.key !== "youtubeCaptionImports");
  const faqCopy = t.raw("faqs") as Array<Omit<FaqCopy, "key">>;
  const faqs: FaqCopy[] = faqCopy.map((faq, index) => ({
    key: `faq-${index + 1}`,
    question: faq.question,
    answer: t(`faqs.${index}.answer`, PRICING_FACTS),
  }));
  const chooseLabels = Object.fromEntries(
    plans.map((plan) => [plan.id, t("chooseLabel", { plan: plan.name })])
  ) as Record<PlanId, string>;
  const productFeatures = englishShowcase
    ? (videoT.raw("features.items") as ProductFeatureCopy[])
    : [];
  const transcriptComparisonRows: PlanComparisonRow[] = englishShowcase
    ? [
        {
          key: "speaker-labels-detail",
          label: transcriptT("items.0.title"),
          values: { free: t("included"), pro: t("included") },
        },
        {
          key: "timestamps-detail",
          label: transcriptT("items.2.title"),
          values: { free: t("included"), pro: t("included") },
        },
        {
          key: "transcript-exports-detail",
          label: transcriptT("items.3.title"),
          values: { free: t("exportFormats"), pro: t("exportFormats") },
        },
      ]
    : [];

  const content = (
    <div className="pricing-surface">
      <main>
        <section className="border-b border-line bg-paper px-4 py-10 sm:px-8 sm:py-12">
          <div className="mx-auto max-w-[1100px]">
            <h1 className="max-w-[760px] font-display text-[42px] font-medium leading-[1.03] tracking-tight sm:text-[56px]">
              {t("h1")}
            </h1>
          </div>
        </section>

        <section className="px-4 py-8 sm:px-8 sm:py-10">
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
              featureStyle={englishShowcase ? "checklist" : "specs"}
              featureRows={pricingFeatureRows}
              noCreditCard={t("noCreditCard")}
              plans={plans}
              signedIn={!!session}
              supportUpgradeLabel={t("supportUpgradeLabel")}
              unavailableLabel={t("unavailableLabel")}
            />
            <PlanComparison
              description={t("paidIncludedDescription")}
              extraRows={transcriptComparisonRows}
              plans={plans}
              rows={featureRows}
              title={t("paidIncludedTitle")}
            />
            {englishShowcase ? (
              <PricingFeatureShowcase
                features={productFeatures}
                intro={videoT("features.intro")}
                label={videoT("features.label")}
                title={videoT("features.title")}
              />
            ) : null}
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

function PlanComparison({
  description,
  extraRows,
  plans,
  rows,
  title,
}: {
  description: string;
  extraRows: PlanComparisonRow[];
  plans: PlanCopy[];
  rows: PlanFeatureCopy[];
  title: string;
}) {
  const publicPlans = plans.filter(
    (plan): plan is PlanCopy & { id: "free" | "pro" } =>
      plan.id === "free" || plan.id === "pro"
  );
  const rowsByKey = new Map(rows.map((row) => [row.key, row]));
  const coreRows = [
    "monthlyMinutes",
    "transcriptFiles",
    "accuracyModel",
    "aiSummaries",
    "aiTranslation",
    "speakerLabels",
    "processingQueue",
    "exports",
    "maxFileLength",
    "maxFileSize",
    "youtubeCaptionImports",
    "maxYoutubeCaptionVideo",
  ]
    .map((key) => rowsByKey.get(key as PlanFeatureCopy["key"]))
    .filter((row): row is PlanFeatureCopy => Boolean(row))
    .map<PlanComparisonRow>((row) => ({
      key: row.key,
      label: row.label,
      values: { free: row.values.free, pro: row.values.pro },
    }));
  const comparisonRows = [
    ...coreRows.slice(0, 2),
    ...extraRows,
    ...coreRows.slice(2),
  ];

  return (
    <section
      id="compare-plans"
      className="mt-16 scroll-mt-24 border-t border-line pt-12 sm:mt-20 sm:pt-16"
    >
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-end">
        <h2 className="max-w-[14ch] font-display text-[36px] font-semibold leading-[1.05] tracking-[-0.04em] sm:text-[48px]">
          {title}
        </h2>
        <p className="max-w-[62ch] text-[15px] leading-[1.75] text-muted lg:justify-self-end">
          {description}
        </p>
      </div>

      <div className="mt-9 overflow-x-auto rounded-xl border border-line bg-card shadow-[0_24px_64px_-52px_color-mix(in_srgb,var(--accent)_48%,transparent)]">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-paper/80">
              <th className="w-[42%] px-5 py-5 sm:px-6">
                <span className="sr-only">Feature</span>
              </th>
              {publicPlans.map((plan) => (
                <th
                  key={plan.id}
                  className={`w-[29%] px-5 py-5 font-display text-[20px] font-semibold sm:px-6 ${
                    plan.id === "pro" ? "bg-accent-soft/35 text-accent" : "text-ink"
                  }`}
                  scope="col"
                >
                  {plan.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map((row) => (
              <tr key={row.key} className="border-b border-line last:border-b-0">
                <th
                  className="px-5 py-4 text-[13.5px] font-semibold text-ink sm:px-6"
                  scope="row"
                >
                  {row.label}
                </th>
                {publicPlans.map((plan) => {
                  const value = row.values[plan.id];
                  const unavailable = isUnavailableValue(value);
                  const Icon = unavailable ? Minus : Check;

                  return (
                    <td
                      key={plan.id}
                      className={`px-5 py-4 text-[13px] leading-5 sm:px-6 ${
                        plan.id === "pro" ? "bg-accent-soft/18" : ""
                      }`}
                    >
                      <span className="flex items-start gap-2.5">
                        <span
                          className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${
                            unavailable
                              ? "bg-ink/[0.04] text-muted"
                              : plan.id === "pro"
                                ? "bg-accent text-paper"
                                : "bg-accent-soft text-accent"
                          }`}
                        >
                          <Icon size={12} strokeWidth={2.2} />
                        </span>
                        <span className={unavailable ? "text-muted" : "text-ink"}>
                          {value}
                        </span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function isUnavailableValue(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === "no" || normalized.startsWith("not available");
}

function PricingFeatureShowcase({
  features,
  intro,
  label,
  title,
}: {
  features: ProductFeatureCopy[];
  intro: string;
  label: string;
  title: string;
}) {
  return (
    <section className="mt-16 border-t border-line pt-12 sm:mt-20 sm:pt-16">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-accent">
            {label}
          </p>
          <h2 className="mt-4 max-w-[14ch] font-display text-[36px] font-semibold leading-[1.05] tracking-[-0.04em] sm:text-[48px]">
            {title}
          </h2>
        </div>
        <p className="max-w-[58ch] text-[15px] leading-[1.75] text-muted lg:justify-self-end">
          {intro}
        </p>
      </div>

      <div className="mt-10 grid gap-px overflow-hidden border border-line bg-line md:grid-cols-2 lg:grid-cols-3">
        {features.map((feature, index) => {
          const Icon = PRODUCT_FEATURE_ICONS[index];
          return (
            <article key={feature.title} className="min-h-[220px] bg-card p-6 sm:p-7">
              {Icon ? (
                <span className="grid size-10 place-items-center rounded-xl bg-accent-soft text-accent">
                  <Icon size={18} strokeWidth={1.6} />
                </span>
              ) : null}
              <h3 className="mt-8 font-display text-[20px] font-semibold tracking-[-0.025em]">
                {feature.title}
              </h3>
              <p className="mt-3 text-[13.5px] leading-[1.7] text-muted">
                {feature.body}
              </p>
            </article>
          );
        })}
      </div>
    </section>
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
