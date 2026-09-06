import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { getPathname } from "@/i18n/navigation";
import { Shell } from "../components/Shell";
import { getSidebarUsage } from "../components/sidebarUsage";
import { LandingChrome } from "../components/LandingChrome";
import { GoogleOneTap } from "../components/GoogleOneTap";
import { Partners } from "../components/Partners";
import { TrackToolVisit } from "../components/Track";
import { VideoHomeHero } from "../components/VideoHomeHero";
import { VideoHomeMarketing } from "../components/VideoHomeMarketing";

const SITE_URL = "https://scribix.io";

function buildJsonLd(locale: string, pageUrl: string, description: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#org`,
        name: "Scribix",
        url: SITE_URL,
        logo: `${SITE_URL}/brand/scribix.svg`,
      },
      {
        "@type": "WebSite",
        "@id": `${pageUrl}#site`,
        url: pageUrl,
        name: "Scribix",
        inLanguage: locale,
        publisher: { "@id": `${SITE_URL}/#org` },
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${pageUrl}#software`,
        name: "Scribix",
        applicationCategory: "MultimediaApplication",
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
      },
    ],
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [session, metadata] = await Promise.all([
    auth(),
    getTranslations({ locale, namespace: "SiteMetadata" }),
  ]);
  const postSignInPath = getPathname({ href: "/dashboard/new", locale });
  const homePath = getPathname({ href: "/", locale });
  const sidebarUsage = await getSidebarUsage(session);
  const pageUrl = new URL(homePath, SITE_URL).toString();
  const jsonLd = buildJsonLd(locale, pageUrl, metadata("description"));

  return (
    <Shell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {!session && process.env.GOOGLE_ID ? (
        <GoogleOneTap clientId={process.env.GOOGLE_ID} />
      ) : null}
      <TrackToolVisit slug="home" />
      <LandingChrome
        signedIn={!!session}
        className={`landing-refresh tool-landing-refresh video-marketing-home ${
          session ? "" : "prism-home"
        }`}
        postSignInPath={postSignInPath}
        signOutRedirect={homePath}
        usage={sidebarUsage}
        userImage={session?.user?.image ?? null}
        userLabel={session?.user?.name ?? session?.user?.email ?? null}
        primary={
          <VideoHomeHero
            signedIn={!!session}
            postSignInPath={postSignInPath}
            tier={sidebarUsage?.tier ?? "free"}
          />
        }
        marketing={<VideoHomeMarketing />}
        publicFooterExtra={<Partners />}
      />
    </Shell>
  );
}
