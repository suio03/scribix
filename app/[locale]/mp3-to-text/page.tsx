import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { getPathname } from "@/i18n/navigation";
import { languageAlternates, urlFor } from "@/lib/metadata-url";
import { GoogleOneTap } from "@/app/components/GoogleOneTap";
import { LandingChrome } from "@/app/components/LandingChrome";
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
  mergeItemDefinitions,
  type ComparisonRow,
  type FaqItem,
  type FitListItem,
  type GridCard,
  type InsightCard,
  type LandingStep,
  type ProofItem,
  type TableRow,
  type ToolLandingIcon,
} from "@/app/components/marketing/ToolLandingSections";
import {
  AudioUploadCard,
  type AudioUploadCardCopy,
} from "@/app/components/upload/AudioUploadCard";
import { Shell } from "@/app/components/Shell";
import { getSidebarUsage } from "@/app/components/sidebarUsage";
import { TrackToolVisit } from "@/app/components/Track";

const PATH = "/mp3-to-text";

type ProofItemCopy = Omit<ProofItem, "key" | "icon">;
type LandingStepCopy = Omit<LandingStep, "key" | "n" | "icon">;
type GridCardCopy = Omit<GridCard, "key" | "icon">;
type InsightCardCopy = Omit<InsightCard, "key" | "icon" | "link"> & {
  link?: Omit<NonNullable<InsightCard["link"]>, "href">;
};

const HERO_PROOF_DEFINITIONS = [
  { key: "freeMinutes", icon: "BadgeCheck" },
  { key: "languageDetection", icon: "Globe" },
  { key: "speakerLabels", icon: "Users" },
  { key: "privacy", icon: "ShieldCheck" },
] as const satisfies ReadonlyArray<{ key: string; icon: ToolLandingIcon }>;

const STEP_DEFINITIONS = [
  { key: "signIn", n: "01", icon: "Lock" },
  { key: "upload", n: "02", icon: "FileAudio" },
  { key: "export", n: "03", icon: "Download" },
] as const satisfies ReadonlyArray<{
  key: string;
  n: string;
  icon: ToolLandingIcon;
}>;

const USE_CASE_DEFINITIONS = [
  { key: "podcasts", icon: "Mic" },
  { key: "interviews", icon: "Users" },
  { key: "lectures", icon: "Search" },
  { key: "captions", icon: "Captions" },
] as const satisfies ReadonlyArray<{ key: string; icon: ToolLandingIcon }>;

const CAPABILITY_DEFINITIONS = [
  { key: "languageDetection", icon: "Globe" },
  { key: "speakerLabels", icon: "Users" },
  { key: "timestamps", icon: "Clock3" },
  { key: "exports", icon: "Download" },
] as const satisfies ReadonlyArray<{ key: string; icon: ToolLandingIcon }>;

const INSIGHT_DEFINITIONS = [
  { key: "quality", icon: "Sparkles" },
  { key: "privacy", icon: "Lock", linkHref: "/privacy" },
] as const satisfies ReadonlyArray<{
  key: string;
  icon: ToolLandingIcon;
  linkHref?: string;
}>;

type Mp3ToTextCopy = {
  hero: {
    issue: string;
    issueLabel: string;
    title: string;
    descriptionStart: string;
    stat: string;
    descriptionEnd: string;
    primaryCta: string;
    signedInPrimaryCta: string;
    secondaryCta: string;
    proof: ProofItemCopy[];
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
    steps: LandingStepCopy[];
  };
  useCases: {
    number: string;
    label: string;
    title: string;
    accentTitle: string;
    items: GridCardCopy[];
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
    items: GridCardCopy[];
  };
  insights: {
    items: InsightCardCopy[];
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
  const t = await getTranslations({ locale, namespace: "Mp3ToText.metadata" });

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

export default async function Mp3ToTextPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  const newTranscriptPath = getPathname({ href: "/dashboard/new", locale });
  const postSignInPath = getPathname({ href: PATH, locale });
  const homePath = getPathname({ href: "/", locale });
  const sidebarUsage = await getSidebarUsage(session);
  const t = await getTranslations("Mp3ToText");
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
  } as Mp3ToTextCopy;

  return (
    <Shell>
      <JsonLd copy={copy} locale={locale} />
      {!session && process.env.GOOGLE_ID ? (
        <GoogleOneTap clientId={process.env.GOOGLE_ID} />
      ) : null}
      <TrackToolVisit slug="mp3-to-text" />
      <LandingChrome
        signedIn={!!session}
        className="landing-refresh tool-landing-refresh"
        usage={sidebarUsage}
        postSignInPath={newTranscriptPath}
        signOutRedirect={homePath}
        userImage={session?.user?.image ?? null}
        userLabel={session?.user?.name ?? session?.user?.email ?? null}
        primary={
          <ToolHero
            {...copy.hero}
            signedIn={!!session}
            secondaryHref="/audio-to-text"
            proof={mergeItemDefinitions(
              copy.hero.proof,
              HERO_PROOF_DEFINITIONS,
              "Mp3ToText.hero.proof"
            )}
            description={
              <>
                {copy.hero.descriptionStart}{" "}
                <span className="font-mono tabular text-ink">
                  {copy.hero.stat}
                </span>
                {copy.hero.descriptionEnd}
              </>
            }
          >
            <AudioUploadCard
              signedIn={!!session}
              postSignInPath={postSignInPath}
              copy={copy.upload}
              accept="audio/mpeg,.mp3"
              toolSlug="mp3-to-text"
              tier={sidebarUsage?.tier}
            />
          </ToolHero>
        }
        marketing={
          <>
            <QuickAnswerSection {...copy.quickAnswer} />
            <OverviewSection {...copy.overview} />
            <StepsSection
              {...copy.howItWorks}
              steps={mergeItemDefinitions(
                copy.howItWorks.steps,
                STEP_DEFINITIONS,
                "Mp3ToText.howItWorks.steps"
              )}
            />
            <UseCaseGridSection
              {...copy.useCases}
              items={mergeItemDefinitions(
                copy.useCases.items,
                USE_CASE_DEFINITIONS,
                "Mp3ToText.useCases.items"
              )}
            />
            <DemoTranscriptSection {...copy.demo} />
            <FeatureGridSection
              {...copy.capabilities}
              items={mergeItemDefinitions(
                copy.capabilities.items,
                CAPABILITY_DEFINITIONS,
                "Mp3ToText.capabilities.items"
              )}
            />
            <InsightCardsSection
              items={mergeItemDefinitions(
                copy.insights.items,
                INSIGHT_DEFINITIONS,
                "Mp3ToText.insights.items"
              ).map((item) => {
                const linkHref =
                  "linkHref" in item ? item.linkHref : undefined;
                return {
                  ...item,
                  link:
                    item.link && linkHref
                      ? { ...item.link, href: linkHref }
                      : undefined,
                };
              })}
            />
            <ApproachComparisonSection {...copy.comparison} />
            <FaqSection {...copy.faq} />
            <FinalToolCta {...copy.finalCta} signedIn={!!session} />
          </>
        }
      />
    </Shell>
  );
}

function JsonLd({ copy, locale }: { copy: Mp3ToTextCopy; locale: string }) {
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
