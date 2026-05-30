import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { getPathname, Link } from "@/i18n/navigation";
import { Shell } from "../components/Shell";
import { Sidebar } from "../components/Sidebar";
import { Header } from "../components/Header";
import { Generator } from "../components/Generator";
import { TrustStrip } from "../components/TrustStrip";
import { Features } from "../components/Features";
import { HowItWorks } from "../components/HowItWorks";
import { UseCases } from "../components/UseCases";
import { Comparison } from "../components/Comparison";
import { Testimonials } from "../components/Testimonials";
import { Pricing } from "../components/Pricing";
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
        "Convert any video or audio to text. Speaker labels, word-level timestamps, 200+ languages, TXT/SRT/VTT export.",
      offers: {
        "@type": "AggregateOffer",
        priceCurrency: "USD",
        lowPrice: "0",
        highPrice: "19",
        offerCount: 5,
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
  const audioLinkT = await getTranslations("HomeAudioToTextLink");

  return (
    <Shell /* sidebar={<Sidebar />} */>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      {!session && process.env.GOOGLE_ID ? (
        <GoogleOneTap clientId={process.env.GOOGLE_ID} />
      ) : null}
      <TrackToolVisit slug="home" />
      <Header />
      <main>
        <Generator signedIn={!!session} postSignInPath={postSignInPath} />
        <section className="px-4 pb-8 sm:px-8">
          <div className="mx-auto max-w-[1100px] border-t border-line pt-5">
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
        <TrustStrip />
        <Features />
        <HowItWorks />
        <UseCases />
        <Comparison />
        <Testimonials />
        {/* <Pricing /> */}
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
      <Partners />
    </Shell>
  );
}
