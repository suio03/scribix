import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Footer } from "@/app/components/Footer";
import { Header } from "@/app/components/Header";
import { Partners } from "@/app/components/Partners";
import { Shell } from "@/app/components/Shell";
import { Sidebar } from "@/app/components/Sidebar";
import { getSidebarUsage } from "@/app/components/sidebarUsage";

const SITE = "https://scribix.io";
const PATH = "/pricing";

type PlanId = "free" | "starter" | "pro";

type PlanCopy = {
  id: PlanId;
  name: string;
  price: string;
  cadence: string;
  minutes: string;
  unitValue: string;
  summary: string;
  fileLimit: string;
  queue: string;
  aiOutputs: string;
  annual?: string;
};

type FaqCopy = {
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
    description: t("description"),
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
  const homePath = getPathname({ href: "/", locale });
  const dashboardPath = getPathname({ href: "/dashboard", locale });
  const sidebarUsage = await getSidebarUsage(session);
  const t = await getTranslations("PricingPage");
  const plans = t.raw("plans") as PlanCopy[];
  const faqs = t.raw("faqs") as FaqCopy[];

  return (
    <Shell
      sidebar={
        <Sidebar
          usage={sidebarUsage}
          signedIn={!!session}
          signInRedirect={dashboardPath}
          signOutRedirect={homePath}
          userImage={session?.user?.image ?? null}
          userLabel={session?.user?.name ?? session?.user?.email ?? null}
        />
      }
    >
      <Header showSidebarToggle />
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
            <div className="grid gap-4 lg:grid-cols-3">
              {plans.map((plan) => (
                <PlanCard
                  key={plan.id}
                  annualPrefix={t("annualPrefix")}
                  bestValue={t("bestValue")}
                  buttonTitle={t("buttonTitle")}
                  chooseLabel={t("chooseLabel", { plan: plan.name })}
                  noCreditCard={t("noCreditCard")}
                  plan={plan}
                  soonLabel={t("soonLabel")}
                  specLabels={{
                    minutes: t("specLabels.minutes"),
                    unitValue: t("specLabels.unitValue"),
                    fileLimit: t("specLabels.fileLimit"),
                    queue: t("specLabels.queue"),
                    aiOutputs: t("specLabels.aiOutputs"),
                  }}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-line bg-card px-4 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-[1100px]">
            <h2 className="font-display text-[34px] font-medium tracking-tight">
              {t("faqTitle")}
            </h2>
            <div className="mt-6 divide-y divide-line border-y border-line">
              {faqs.map((faq) => (
                <details key={faq.question} className="group">
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
      <Partners />
    </Shell>
  );
}

function PlanCard({
  annualPrefix,
  bestValue,
  buttonTitle,
  chooseLabel,
  noCreditCard,
  plan,
  soonLabel,
  specLabels,
}: {
  annualPrefix: string;
  bestValue: string;
  buttonTitle: string;
  chooseLabel: string;
  noCreditCard: string;
  plan: PlanCopy;
  soonLabel: string;
  specLabels: Record<"minutes" | "unitValue" | "fileLimit" | "queue" | "aiOutputs", string>;
}) {
  const primary = plan.id === "pro";

  return (
    <article
      className={`relative flex min-h-[560px] flex-col border p-6 transition ${
        primary
          ? "border-ink bg-ink text-paper shadow-[8px_8px_0_0_var(--accent)]"
          : "border-line bg-card hover:border-ink/35"
      }`}
    >
      {primary ? (
        <div className="absolute right-5 top-5 inline-flex items-center gap-1.5 bg-accent px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-paper">
          {bestValue}
        </div>
      ) : null}

      <div className="mt-7">
        <h2 className="font-display text-[31px] font-medium tracking-tight">
          {plan.name}
        </h2>
        <p
          className={`mt-2 min-h-[54px] text-[14.5px] leading-[1.65] ${
            primary ? "text-paper/68" : "text-muted"
          }`}
        >
          {plan.summary}
        </p>
      </div>

      <div className="mt-8">
        <div className="flex items-end gap-2">
          <span className="font-display text-[56px] font-medium leading-none tracking-tight tabular">
            {plan.price}
          </span>
          <span
            className={`pb-1.5 font-mono text-[11px] uppercase tracking-[0.16em] ${
              primary ? "text-paper/55" : "text-muted"
            }`}
          >
            {plan.cadence}
          </span>
        </div>
        {plan.annual ? (
          <p
            className={`mt-2 font-mono text-[11px] uppercase tracking-[0.16em] ${
              primary ? "text-rec" : "text-accent"
            }`}
          >
            {annualPrefix} {plan.annual}
          </p>
        ) : (
          <p className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
            {noCreditCard}
          </p>
        )}
      </div>

      <dl className="mt-8 grid gap-3 border-t border-current/15 pt-6">
        <Spec label={specLabels.minutes} value={plan.minutes} primary={primary} />
        <Spec label={specLabels.unitValue} value={plan.unitValue} primary={primary} />
        <Spec label={specLabels.fileLimit} value={plan.fileLimit} primary={primary} />
        <Spec label={specLabels.queue} value={plan.queue} primary={primary} />
        <Spec label={specLabels.aiOutputs} value={plan.aiOutputs} primary={primary} />
      </dl>

      <button
        type="button"
        aria-disabled="true"
        title={buttonTitle}
        className={`mt-auto inline-flex h-12 items-center justify-center gap-2 border px-4 text-[14px] font-medium transition ${
          primary
            ? "border-paper bg-paper text-ink"
            : "border-ink bg-ink text-paper"
        }`}
      >
        {chooseLabel}
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] opacity-60">
          {soonLabel}
        </span>
      </button>
    </article>
  );
}

function Spec({
  label,
  value,
  primary = false,
}: {
  label: string;
  value: string;
  primary?: boolean;
}) {
  return (
    <div className="grid grid-cols-[94px_minmax(0,1fr)] gap-3 text-[14px]">
      <dt
        className={`font-mono text-[10px] uppercase tracking-[0.16em] ${
          primary ? "text-paper/45" : "text-muted"
        }`}
      >
        {label}
      </dt>
      <dd className={primary ? "text-paper/88" : "text-ink/88"}>{value}</dd>
    </div>
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
