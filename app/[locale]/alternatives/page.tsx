import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { ContentShell, JsonLd } from "@/app/components/guides/ContentShell";
import { ALTERNATIVES } from "@/lib/alternatives/registry";
import { socialImages } from "@/lib/metadata-url";

const title = "AI Video Clipping Alternatives & Comparisons";
const description = "Compare video clipping tools by workflow, editing features and plan limits. Find an alternative that fits how you turn long conversations into short clips.";
const canonical = "https://scribix.io/alternatives";

export const metadata: Metadata = {
  title, description,
  alternates: { canonical, languages: {} },
  openGraph: { title, description, url: canonical, siteName: "Scribix", type: "website", images: socialImages },
  twitter: { card: "summary_large_image", title, description, images: socialImages },
};

export function generateStaticParams() {
  return [{ locale: "en" }];
}

export default async function AlternativesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (locale !== "en") redirect({ href: "/alternatives", locale: "en" });
  setRequestLocale("en");

  return (
    <ContentShell section="alternatives" showLanguageSwitcher={false}>
      <JsonLd value={{
        "@context": "https://schema.org", "@type": "CollectionPage",
        name: title, description, url: canonical, inLanguage: "en",
        hasPart: ALTERNATIVES.map(article => ({
          "@type": "Article", name: article.title, url: `https://scribix.io${article.path}`,
        })),
      }} />
      <div className="mx-auto max-w-[1240px] px-5 pb-20 pt-16 sm:px-8 sm:pt-24">
        <p className="guide-eyebrow">Alternatives / The creator’s shortlist</p>
        <h1 className="guide-title mt-6 max-w-[900px]">Find the right fit<br />for your next clip.</h1>
        <p className="mt-7 max-w-[650px] text-lg text-muted">Explore alternatives to the tools you know. Compare the editing workflow, plan limits and practical tradeoffs before you choose.</p>
        <div className="mt-14 border-t border-line pt-7">
          <h2 className="guide-eyebrow">Explore comparisons</h2>
          <div className="mt-6 grid gap-6">
            {ALTERNATIVES.map(article => (
              <Link key={article.path} href={article.path} className="group grid gap-7 rounded-3xl border border-line bg-card p-6 transition hover:border-accent sm:p-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:items-center">
                <div className="flex min-h-[220px] flex-col justify-center rounded-2xl bg-accent-soft p-7 sm:p-10" aria-hidden="true">
                  <span className="font-mono text-xs uppercase text-accent">{article.label}</span>
                  <p className="mt-5 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">A different tool.<br />Your kind of workflow.</p>
                </div>
                <div>
                  <p className="guide-eyebrow">Feature &amp; workflow comparison</p>
                  <h3 className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.035em]">{article.title}</h3>
                  <p className="mt-4 text-muted">{article.description}</p>
                  <span className="mt-6 inline-flex min-h-11 items-center font-semibold text-accent">Explore the comparison <span className="ml-4" aria-hidden="true">↗</span></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </ContentShell>
  );
}
