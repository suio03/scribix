import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Footer } from "@/app/components/Footer";
import { GoogleOneTap } from "@/app/components/GoogleOneTap";
import { Header } from "@/app/components/Header";
import {
  ApproachComparisonSection,
  DemoTranscriptSection,
  FaqSection,
  FeatureGridSection,
  FinalToolCta,
  InsightCardsSection,
  OverviewSection,
  QuickAnswerSection,
  StepsSection,
  ToolHero,
  UseCaseGridSection,
  type ComparisonRow,
  type FaqItem,
  type FitListItem,
  type GridCard,
  type InsightCard,
  type LandingStep,
  type ProofItem,
  type TableRow,
} from "@/app/components/marketing/ToolLandingSections";
import {
  AudioUploadCard,
  type AudioUploadCardCopy,
} from "@/app/components/upload/AudioUploadCard";
import { Partners } from "@/app/components/Partners";
import { Shell } from "@/app/components/Shell";
import { TrackToolVisit } from "@/app/components/Track";

const SITE = "https://scribix.io";
const PATH = "/audio-to-text";

type AudioToTextCopy = {
  hero: {
    issue: string;
    issueLabel: string;
    title: string;
    accentTitle: string;
    descriptionStart: string;
    stat: string;
    descriptionEnd: string;
    primaryCta: string;
    signedInPrimaryCta: string;
    secondaryCta: string;
    secondaryHref: string;
    proof: ProofItem[];
  };
  upload: AudioUploadCardCopy;
  quickAnswer: {
    kicker: string;
    title: string;
    body: string;
  };
  overview: {
    number: string;
    label: string;
    rows: TableRow[];
    bestFor: FitListItem;
    notBestFor: FitListItem;
  };
  howItWorks: {
    number: string;
    label: string;
    title: string;
    accentTitle: string;
    steps: LandingStep[];
  };
  useCases: {
    number: string;
    label: string;
    title: string;
    accentTitle: string;
    items: GridCard[];
  };
  demo: {
    number: string;
    label: string;
    title: string;
    body: string;
    filename: string;
    transcript: string;
  };
  capabilities: {
    number: string;
    label: string;
    title: string;
    accentTitle: string;
    intro: string;
    items: GridCard[];
  };
  insights: {
    items: InsightCard[];
  };
  comparison: {
    number: string;
    label: string;
    title: string;
    headers: [string, string, string];
    rows: ComparisonRow[];
  };
  faq: {
    number: string;
    label: string;
    title: string;
    accentTitle: string;
    intro: string;
    items: FaqItem[];
  };
  finalCta: {
    kicker: string;
    title: string;
    body: string;
    primaryCta: string;
    signedInPrimaryCta: string;
    stats: Array<{ value: string; label: string }>;
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
  const t = await getTranslations({ locale, namespace: "AudioToText.metadata" });

  return {
    title: t("title"),
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

export default async function AudioToTextPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  const postSignInPath = getPathname({ href: "/dashboard/new", locale });
  const t = await getTranslations("AudioToText");
  const copy = {
    hero: t.raw("hero"),
    upload: t.raw("upload"),
    quickAnswer: t.raw("quickAnswer"),
    overview: t.raw("overview"),
    howItWorks: t.raw("howItWorks"),
    useCases: t.raw("useCases"),
    demo: t.raw("demo"),
    capabilities: t.raw("capabilities"),
    insights: t.raw("insights"),
    comparison: t.raw("comparison"),
    faq: t.raw("faq"),
    finalCta: t.raw("finalCta"),
    jsonLd: t.raw("jsonLd"),
  } as AudioToTextCopy;

  return (
    <Shell>
      <JsonLd copy={copy} locale={locale} />
      {!session && process.env.GOOGLE_ID ? (
        <GoogleOneTap clientId={process.env.GOOGLE_ID} />
      ) : null}
      <TrackToolVisit slug="audio-to-text" />
      <Header />
      <main>
        <ToolHero
          {...copy.hero}
          signedIn={!!session}
          description={
            <>
              {copy.hero.descriptionStart}{" "}
              <span className="font-mono tabular text-ink">{copy.hero.stat}</span>
              {copy.hero.descriptionEnd}
            </>
          }
        >
          <AudioUploadCard
            signedIn={!!session}
            postSignInPath={postSignInPath}
            copy={copy.upload}
          />
        </ToolHero>
        <QuickAnswerSection {...copy.quickAnswer} />
        <OverviewSection {...copy.overview} />
        <StepsSection {...copy.howItWorks} />
        <UseCaseGridSection {...copy.useCases} />
        <DemoTranscriptSection {...copy.demo} />
        <FeatureGridSection {...copy.capabilities} />
        <InsightCardsSection {...copy.insights} />
        <ApproachComparisonSection {...copy.comparison} />
        <FaqSection {...copy.faq} />
        <FinalToolCta {...copy.finalCta} signedIn={!!session} />
      </main>
      <Footer />
      <Partners />
    </Shell>
  );
}

function JsonLd({ copy, locale }: { copy: AudioToTextCopy; locale: string }) {
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
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          description: copy.jsonLd.offerDescription,
        },
        featureList: copy.jsonLd.featureList,
      },
      {
        "@type": "HowTo",
        name: copy.jsonLd.howToName,
        description: copy.jsonLd.howToDescription,
        step: copy.jsonLd.howToSteps.map((name, i) => ({
          "@type": "HowToStep",
          position: i + 1,
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
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}

function languageAlternates(path: string): Record<string, string> {
  const languages: Record<string, string> = {
    "x-default": urlFor(routing.defaultLocale, path).href,
  };
  for (const locale of routing.locales) {
    languages[locale] = urlFor(locale, path).href;
  }
  return languages;
}

function urlFor(locale: string, path: string): URL {
  const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
  return new URL(`${prefix}${path}`, SITE);
}
