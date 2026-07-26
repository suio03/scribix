import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { getPathname, Link } from "@/i18n/navigation";
import { Shell } from "../components/Shell";
import { Sidebar } from "../components/Sidebar";
import { getSidebarUsage } from "../components/sidebarUsage";
import { Header } from "../components/Header";
import { Generator } from "../components/Generator";
import { Features } from "../components/Features";
import { HowItWorks } from "../components/HowItWorks";
import { UseCases } from "../components/UseCases";
import { FAQ } from "../components/FAQ";
import { FinalCTA } from "../components/FinalCTA";
import { Footer } from "../components/Footer";
import { GoogleOneTap } from "../components/GoogleOneTap";
import { Partners } from "../components/Partners";
import { TrackToolVisit } from "../components/Track";

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://scribix.io/#org",
      name: "Scribix",
      url: "https://scribix.io",
      logo: "https://scribix.io/icon.svg",
    },
    {
      "@type": "WebSite",
      "@id": "https://scribix.io/#site",
      url: "https://scribix.io",
      name: "Scribix",
      publisher: { "@id": "https://scribix.io/#org" },
    },
    {
      "@type": "SoftwareApplication",
      name: "Scribix",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: "https://scribix.io",
      description:
        "Convert video or audio to text with speaker labels, word-level timestamps, automatic language detection, and TXT, DOCX, SRT, VTT, or CSV export.",
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

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const session = await auth();
  const postSignInPath = getPathname({ href: "/dashboard/new", locale });
  const homePath = getPathname({ href: "/", locale });
  const dashboardPath = getPathname({ href: "/dashboard", locale });
  const audioLinkT = await getTranslations("HomeAudioToTextLink");
  const sidebarUsage = await getSidebarUsage(session);

  return (
    <Shell
      sidebar={
        <Sidebar
          usage={sidebarUsage}
          signedIn={!!session}
          signInRedirect={dashboardPath}
          newTranscriptRedirect={postSignInPath}
          signOutRedirect={homePath}
          userImage={session?.user?.image ?? null}
          userLabel={session?.user?.name ?? session?.user?.email ?? null}
        />
      }
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {!session && process.env.GOOGLE_ID ? (
        <GoogleOneTap clientId={process.env.GOOGLE_ID} />
      ) : null}
      <TrackToolVisit slug="home" />
      <div className="home-refresh">
        <Header showSidebarToggle />
        <main>
          <Generator
            signedIn={!!session}
            postSignInPath={homePath}
            tier={sidebarUsage?.tier}
            billingCycle={sidebarUsage?.billingCycle}
          />
          <section className="home-audio-link px-4 sm:px-8">
            <div className="mx-auto border-t border-line pt-4">
              <p className="text-[14px] leading-[1.6] text-muted">
                {audioLinkT("prefix")}{" "}
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
        </main>
        <Footer />
        <Partners />
      </div>
    </Shell>
  );
}
