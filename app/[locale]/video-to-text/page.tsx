import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { getPathname, Link } from "@/i18n/navigation";
import { languageAlternates, urlFor } from "@/lib/metadata-url";
import { FAQ } from "@/app/components/FAQ";
import { Features } from "@/app/components/Features";
import { FinalCTA } from "@/app/components/FinalCTA";
import { Generator } from "@/app/components/Generator";
import { GoogleOneTap } from "@/app/components/GoogleOneTap";
import { HowItWorks } from "@/app/components/HowItWorks";
import { LandingChrome } from "@/app/components/LandingChrome";
import { Partners } from "@/app/components/Partners";
import { Shell } from "@/app/components/Shell";
import { getSidebarUsage } from "@/app/components/sidebarUsage";
import { TrackToolVisit } from "@/app/components/Track";
import { UseCases } from "@/app/components/UseCases";

const PATH = "/video-to-text";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const canonical = urlFor(locale, PATH);
  const t = await getTranslations({
    locale,
    namespace: "VideoToText.metadata",
  });

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

export default async function VideoToTextPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [session, audioLinkT, metadataT] = await Promise.all([
    auth(),
    getTranslations({ locale, namespace: "HomeAudioToTextLink" }),
    getTranslations({ locale, namespace: "VideoToText.metadata" }),
  ]);
  const pagePath = getPathname({ href: PATH, locale });
  const homePath = getPathname({ href: "/", locale });
  const newTranscriptPath = getPathname({ href: "/dashboard/new", locale });
  const sidebarUsage = await getSidebarUsage(session);
  const pageUrl = urlFor(locale, PATH).href;
  const jsonLd = buildJsonLd(locale, pageUrl, metadataT("description"));

  return (
    <Shell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      {!session && process.env.GOOGLE_ID ? (
        <GoogleOneTap clientId={process.env.GOOGLE_ID} />
      ) : null}
      <TrackToolVisit slug="video-to-text" />
      <LandingChrome
        signedIn={!!session}
        usage={sidebarUsage}
        postSignInPath={newTranscriptPath}
        signOutRedirect={homePath}
        userImage={session?.user?.image ?? null}
        userLabel={session?.user?.name ?? session?.user?.email ?? null}
        primary={
          <Generator
            signedIn={!!session}
            postSignInPath={pagePath}
            tier={sidebarUsage?.tier}
            billingCycle={sidebarUsage?.billingCycle}
            toolSlug="video-to-text"
          />
        }
        marketing={
          <>
            <section className="home-audio-link px-4 sm:px-8">
              <div className="mx-auto border-t border-line pt-4">
                <p className="text-[14px] leading-[1.6] text-muted">
                  {audioLinkT("prefix")} {" "}
                  <Link
                    href="/audio-to-text"
                    className="font-medium text-ink underline decoration-accent decoration-2 underline-offset-4"
                  >
                    {audioLinkT("link")}
                  </Link>
                  {audioLinkT("suffix")}
                </p>
              </div>
            </section>
            <Features />
            <HowItWorks />
            <UseCases />
            <FAQ />
            <FinalCTA />
          </>
        }
        publicFooterExtra={<Partners />}
      />
    </Shell>
  );
}

function buildJsonLd(locale: string, pageUrl: string, description: string) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${pageUrl}#software`,
    name: "Scribix Video to Text",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: pageUrl,
    inLanguage: locale,
    description,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: "0",
      highPrice: "20",
      offerCount: 3,
    },
  };
}
