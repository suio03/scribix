import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { FAQ } from "@/app/components/FAQ";
import { Features } from "@/app/components/Features";
import { FinalCTA } from "@/app/components/FinalCTA";
import { Footer } from "@/app/components/Footer";
import { Generator } from "@/app/components/Generator";
import { GoogleOneTap } from "@/app/components/GoogleOneTap";
import { Header } from "@/app/components/Header";
import { HowItWorks } from "@/app/components/HowItWorks";
import { Partners } from "@/app/components/Partners";
import { Shell } from "@/app/components/Shell";
import { Sidebar } from "@/app/components/Sidebar";
import { getSidebarUsage } from "@/app/components/sidebarUsage";
import { TrackToolVisit } from "@/app/components/Track";
import { UseCases } from "@/app/components/UseCases";
import { getPathname } from "@/i18n/navigation";
import { languageAlternates, urlFor } from "@/lib/metadata-url";

const PATH = "/ai-note-taker";

type AiNoteTakerStructuredCopy = {
  faq: {
    items: Array<{ q: string; a: string }>;
  };
  jsonLd: {
    appName: string;
    appDescription: string;
    offerDescription: string;
    featureList: string[];
    howToName: string;
    howToDescription: string;
    howToSteps: string[];
  };
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const canonical = urlFor(locale, PATH);
  const t = await getTranslations({ locale, namespace: "AiNoteTaker.metadata" });

  return {
    title: { absolute: t("title") },
    description: t("description"),
    alternates: {
      canonical,
      languages: languageAlternates(PATH),
    },
    openGraph: {
      title: t("openGraphTitle"),
      description: t("openGraphDescription"),
      type: "website",
      siteName: "Scribix",
      url: canonical,
    },
    twitter: {
      card: "summary_large_image",
      title: t("twitterTitle"),
      description: t("twitterDescription"),
    },
  };
}

export default async function AiNoteTakerPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [session, t] = await Promise.all([
    auth(),
    getTranslations("AiNoteTaker"),
  ]);
  const sidebarUsage = await getSidebarUsage(session);
  const newTranscriptPath = getPathname({ href: "/dashboard/new", locale });
  const postSignInPath = getPathname({ href: PATH, locale });
  const homePath = getPathname({ href: "/", locale });
  const dashboardPath = getPathname({ href: "/dashboard", locale });
  const structuredCopy = {
    faq: t.raw("faq"),
    jsonLd: t.raw("jsonLd"),
  } as AiNoteTakerStructuredCopy;

  return (
    <Shell
      sidebar={
        <Sidebar
          usage={sidebarUsage}
          signedIn={!!session}
          signInRedirect={dashboardPath}
          newTranscriptRedirect={newTranscriptPath}
          signOutRedirect={homePath}
          userImage={session?.user?.image ?? null}
          userLabel={session?.user?.name ?? session?.user?.email ?? null}
        />
      }
    >
      <JsonLd copy={structuredCopy} locale={locale} />
      {!session && process.env.GOOGLE_ID ? (
        <GoogleOneTap clientId={process.env.GOOGLE_ID} />
      ) : null}
      <TrackToolVisit slug="ai-note-taker" />
      <div className="home-refresh landing-refresh tool-landing-refresh">
        <Header showSidebarToggle />
        <main>
        <Generator
          signedIn={!!session}
          postSignInPath={postSignInPath}
          tier={sidebarUsage?.tier}
          billingCycle={sidebarUsage?.billingCycle}
          namespace="AiNoteTaker.hero"
          toolSlug="ai-note-taker"
        />
        <Features namespace="AiNoteTaker.features" />
        <HowItWorks namespace="AiNoteTaker.howItWorks" />
        <UseCases namespace="AiNoteTaker.useCases" />
        <FAQ namespace="AiNoteTaker.faq" />
        <FinalCTA namespace="AiNoteTaker.finalCta" />
        </main>
        <Footer />
        <Partners />
      </div>
    </Shell>
  );
}

function JsonLd({
  copy,
  locale,
}: {
  copy: AiNoteTakerStructuredCopy;
  locale: string;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: copy.jsonLd.appName,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        url: urlFor(locale, PATH).href,
        description: copy.jsonLd.appDescription,
        offers: {
          "@type": "AggregateOffer",
          priceCurrency: "USD",
          lowPrice: "0",
          highPrice: "20",
          description: copy.jsonLd.offerDescription,
        },
        featureList: copy.jsonLd.featureList,
      },
      {
        "@type": "HowTo",
        name: copy.jsonLd.howToName,
        description: copy.jsonLd.howToDescription,
        step: copy.jsonLd.howToSteps.map((name, index) => ({
          "@type": "HowToStep",
          position: index + 1,
          name,
        })),
      },
      {
        "@type": "FAQPage",
        mainEntity: copy.faq.items.map((faq) => ({
          "@type": "Question",
          name: faq.q,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.a,
          },
        })),
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
      }}
    />
  );
}
