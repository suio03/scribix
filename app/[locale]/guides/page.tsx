import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { getContentCopy } from "@/lib/guides/copy";
import { urlFor } from "@/lib/metadata-url";
import { setRequestLocale } from "next-intl/server";
import {
  ContentShell,
  ContentCTA,
  JsonLd,
} from "@/app/components/guides/ContentShell";
import { getGuides } from "@/lib/guides/content";
import { contentMetadata } from "@/lib/guides/metadata";

export async function generateMetadata({ params }: { params: Promise<{locale: string}> }) {
  const {locale} = await params;
  const {ui} = getContentCopy(locale);
  return contentMetadata(ui.indexMeta, ui.indexDescription, "/guides", false, locale);
}

export default async function GuidesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const {ui} = getContentCopy(locale);
  const guides = getGuides(locale);
  const visibleGuides = getGuides(locale, process.env.NODE_ENV === "development");
  setRequestLocale(locale);
  return (
    <ContentShell>
      <JsonLd
        value={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: `Scribix / ${ui.guides}`,
          url: urlFor(locale, "/guides").href,
          inLanguage: locale,
          hasPart: guides.map((guide) => ({
            "@type": "Article",
            name: guide.title,
            url: urlFor(locale, `/guides/${guide.slug}`).href,
          })),
        }}
      />
      <div className="mx-auto max-w-[1240px] px-5 pb-20 pt-16 sm:px-8 sm:pt-24">
        <p className="guide-eyebrow">{ui.fieldNotes}</p>
        <h1 className="guide-title mt-6 max-w-[850px]">
          {ui.indexTitle}
        </h1>
        <p className="mt-7 max-w-[570px] text-lg text-muted">
          {ui.indexIntro}
        </p>
        <div className="mt-16 flex items-center justify-between border-t border-line pt-6">
          <h2 className="guide-eyebrow">{ui.list}</h2>
          <span className="font-mono text-xs text-muted">{ui.edition}</span>
        </div>
        <div className="mt-7 grid items-stretch gap-6 md:grid-cols-2">
          {visibleGuides.map((guide) => (
            <Link
              key={guide.slug}
              href={`/guides/${guide.slug}`}
              className="group flex min-w-0 flex-col rounded-[24px] border border-line bg-card p-5 transition hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:p-7"
            >
              <div className="relative aspect-video overflow-hidden rounded-2xl bg-accent-soft" aria-hidden="true">
                {guide.walkthrough ? (
                  <Image
                    src={guide.walkthrough.poster}
                    alt=""
                    fill
                    sizes="(min-width: 1240px) 518px, (min-width: 768px) 45vw, 90vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full flex-col justify-center gap-3 p-5 sm:gap-4 sm:p-7">
                    <span className="font-mono text-xs text-accent">{ui.cardLabel}</span>
                    <div className="space-y-2 text-base font-medium tracking-tight sm:text-xl">
                      {ui.cardLines.map(line => <p key={line}>{line}</p>)}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex flex-1 flex-col pt-6">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <p className="guide-eyebrow">{guide.category} · {guide.readingTime}</p>
                  {guide.draft ? (
                    <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">{ui.previewBadge}</span>
                  ) : null}
                </div>
                <h3 className="mt-4 text-2xl font-semibold leading-tight tracking-[-0.035em] sm:text-3xl">
                  {guide.title}
                </h3>
                <p className="mb-7 mt-4 text-muted">{guide.description}</p>
                <span className="mt-auto font-semibold text-accent">
                  {ui.read} <span aria-hidden="true">↗</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
        <ContentCTA />
      </div>
    </ContentShell>
  );
}
