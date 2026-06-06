import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Footer } from "@/app/components/Footer";
import { Header } from "@/app/components/Header";
import { Partners } from "@/app/components/Partners";
import { PricingPlans, type PlanCopy, type PlanId } from "@/app/components/PricingPlans";
import { Shell } from "@/app/components/Shell";
import { Sidebar } from "@/app/components/Sidebar";
import { getSidebarUsage } from "@/app/components/sidebarUsage";

const SITE = "https://scribix.io";
const PATH = "/pricing";

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
  const dashboardNewPath = getPathname({ href: "/dashboard/new", locale });
  const checkoutSuccessPath = getPathname({
    href: { pathname: "/dashboard", query: { checkout: "ok" } },
    locale,
  });
  const sidebarUsage = await getSidebarUsage(session);
  const t = await getTranslations("PricingPage");
  const plans = t.raw("plans") as PlanCopy[];
  const faqs = t.raw("faqs") as FaqCopy[];
  const chooseLabels = Object.fromEntries(
    plans.map((plan) => [plan.id, t("chooseLabel", { plan: plan.name })])
  ) as Record<PlanId, string>;

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
            <PricingPlans
              billingLabels={{
                label: t("billingToggleLabel"),
                monthly: t("billingMonthly"),
                yearly: t("billingYearly"),
                yearlyBadge: t("billingYearlyBadge"),
              }}
              bestValue={t("bestValue")}
              checkoutSuccessPath={checkoutSuccessPath}
              chooseLabels={chooseLabels}
              dashboardNewPath={dashboardNewPath}
              noCreditCard={t("noCreditCard")}
              plans={plans}
              signedIn={!!session}
              specLabels={{
                minutes: t("specLabels.minutes"),
                unitValue: t("specLabels.unitValue"),
                fileLimit: t("specLabels.fileLimit"),
                queue: t("specLabels.queue"),
                aiOutputs: t("specLabels.aiOutputs"),
              }}
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
