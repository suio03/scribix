import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { getContentCopy } from "@/lib/guides/copy";
import { routing } from "@/i18n/routing";
import { urlFor } from "@/lib/metadata-url";
import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import {
  ContentShell,
  ContentCTA,
  JsonLd,
} from "@/app/components/guides/ContentShell";
import { PrintButton } from "@/app/components/guides/PrintButton";
import { GUIDES, getGuide } from "@/lib/guides/content";
import { contentMetadata } from "@/lib/guides/metadata";

type Params = Promise<{ locale: string; slug: string }>;
export function generateStaticParams() {
  return routing.locales.flatMap(locale => GUIDES.map(({slug}) => ({locale, slug})));
}
export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const guide = getGuide(slug, locale);
  if (!guide) notFound();
  return {
    ...contentMetadata(
      guide.metadataTitle,
      guide.description,
      `/guides/${slug}`,
      true,
      locale,
    ),
    ...(guide.draft ? { robots: { index: false, follow: false } } : {}),
  };
}

export default async function GuidePage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  const guide = getGuide(slug, locale);
  if (!guide) notFound();
  setRequestLocale(locale);
  const { ui } = getContentCopy(locale);
  const hasChecklist = Boolean(guide.printTitle);
  const url = urlFor(locale, `/guides/${slug}`).href;
  return (
    <ContentShell>
      {!guide.draft ? (
        <JsonLd
          value={{
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "Article",
                headline: guide.title,
                description: guide.description,
                datePublished: guide.published,
                dateModified: guide.published,
                inLanguage: locale,
                author: {
                  "@type": "Organization",
                  name: "Scribix",
                  url: "https://scribix.io",
                },
                publisher: {
                  "@type": "Organization",
                  name: "Scribix",
                  url: "https://scribix.io",
                },
                mainEntityOfPage: url,
              },
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  {
                    "@type": "ListItem",
                    position: 1,
                    name: ui.guides,
                    item: urlFor(locale, "/guides").href,
                  },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: guide.metadataTitle,
                    item: url,
                  },
                ],
              },
            ],
          }}
        />
      ) : null}
      <article className="mx-auto max-w-[1240px] px-5 pb-20 pt-12 sm:px-8 sm:pt-16">
        <header className="guide-article-header border-b border-line pb-12">
          <Link href="/guides" className="text-sm text-muted hover:text-accent">
            ← {ui.all}
          </Link>
          {guide.draft ? (
            <p className="mt-8 rounded-xl border border-line bg-generated p-4 text-sm text-generated-ink">
              {ui.preview}
            </p>
          ) : null}
          <p className="guide-eyebrow mt-10">{guide.category}</p>
          <h1 className="guide-title mt-5 max-w-[970px]">{guide.title}</h1>
          <p className="mt-7 max-w-[680px] text-lg text-muted">{guide.intro}</p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted">
            <span>{ui.by}</span>
            <time dateTime={guide.published}>
              {new Date(`${guide.published}T12:00:00Z`).toLocaleDateString(
                locale,
                {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                },
              )}
            </time>
            <span>{guide.readingTime}</span>
          </div>
          {hasChecklist ? (
            <div className="mt-7">
              <PrintButton label={ui.print} />
              <p className="mt-2 text-xs text-muted">
                {ui.printHelp}
              </p>
            </div>
          ) : null}
        </header>
        {guide.walkthrough ? (
          <figure className="guide-media mt-10 overflow-hidden rounded-3xl border border-line bg-card">
            <div className="flex flex-wrap items-baseline justify-between gap-3 px-6 py-5">
              <h2 className="text-xl font-semibold tracking-tight">{ui.watch}</h2>
              <span className="font-mono text-xs text-muted">{ui.duration}</span>
            </div>
            <video controls playsInline preload="none" poster={guide.walkthrough.poster}
              className="aspect-video w-full bg-black" aria-label={ui.walkthroughLabel}>
              <source src={guide.walkthrough.src} type="video/mp4" />
              <a href={guide.walkthrough.src}>{ui.videoFallback}</a>
            </video>
            <figcaption className="px-6 py-5 text-sm text-muted">{guide.walkthrough.caption} {ui.mediaNote}</figcaption>
          </figure>
        ) : null}
        <div className="guide-reading-layout grid gap-12 pt-10 lg:grid-cols-[240px_minmax(0,680px)] lg:gap-16">
          <aside>
            <nav
              aria-label={ui.toc}
              className="guide-toc lg:sticky lg:top-8"
            >
              <p className="guide-eyebrow mb-4">{ui.toc}</p>
              {guide.sections.map((section) => (
                <a key={section.id} href={`#${section.id}`} className="text-sm">
                  {section.title}
                </a>
              ))}
              {hasChecklist ? (
                <p className="mt-6 border-t border-line pt-5 text-xs text-muted">
                  {ui.checkHelp}
                </p>
              ) : null}
            </nav>
          </aside>
          <div className="guide-article">
            {guide.sections.map((section) => (
              <section
                key={section.id}
                id={section.id}
                className="mb-14 border-b border-line pb-12 last:mb-0"
              >
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="text-ink/85">
                    {paragraph}
                  </p>
                ))}
                {section.image ? (
                  <figure className="guide-media my-7">
                    <a href={section.image.src} target="_blank" rel="noopener noreferrer"
                      className="block overflow-hidden rounded-2xl border border-line"
                      aria-label={`${ui.enlarge}: ${section.image.alt}`}>
                      <Image src={section.image.src} alt={section.image.alt}
                        width={section.image.width} height={section.image.height}
                        sizes="(max-width: 767px) 100vw, 680px" className="h-auto w-full" />
                    </a>
                    <figcaption className="mt-3 text-sm text-muted">{section.image.caption} {ui.enlargeHelp}</figcaption>
                  </figure>
                ) : null}
                {section.video ? (
                  <figure className="guide-media my-7 rounded-2xl border border-line bg-card p-5">
                    <video controls playsInline preload="none" poster={section.video.poster}
                      className={section.video.portrait ? "mx-auto aspect-[9/16] w-full max-w-[320px] rounded-xl bg-black" : "aspect-video w-full rounded-xl bg-black"}
                      aria-label={ui.exportLabel}>
                      <source src={section.video.src} type="video/mp4" />
                      <a href={section.video.src}>{ui.videoFallback}</a>
                    </video>
                    <figcaption className="mt-5 text-sm text-muted">{section.video.caption}</figcaption>
                    <a href={section.video.src} download className="mt-4 inline-block text-sm font-medium text-accent underline underline-offset-4">{ui.download}</a>
                  </figure>
                ) : null}
                {section.example ? (
                  <figure className="my-7 rounded-2xl border border-line bg-card p-6">
                    <div className="grid gap-6 sm:grid-cols-2">
                      <div>
                        <span className="guide-eyebrow">{ui.missing}</span>
                        <blockquote className="mt-3 text-lg font-medium">
                          “{section.example.before}”
                        </blockquote>
                      </div>
                      <div>
                        <span className="guide-eyebrow">{ui.setup}</span>
                        <blockquote className="mt-3 text-lg font-medium">
                          “{section.example.after}”
                        </blockquote>
                      </div>
                    </div>
                    <figcaption className="mt-5 border-t border-line pt-4 text-xs text-muted">
                      {section.example.explanation}
                    </figcaption>
                  </figure>
                ) : null}
                {section.checks ? (
                  <fieldset className="mt-6 rounded-2xl bg-accent-soft p-5">
                    <legend className="sr-only">{ui.review}: {section.title}</legend>
                    {section.checks.map((check, index) => (
                      <label
                        key={check}
                        className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-sm"
                      >
                        <input
                          className="guide-check"
                          type="checkbox"
                          name={`${section.id}-${index}`}
                        />
                        <span>{check}</span>
                      </label>
                    ))}
                  </fieldset>
                ) : null}
              </section>
            ))}
            {guide.walkthrough ? <p className="mb-6"><Link href="/guides/podcast-clip-checklist" className="text-accent underline underline-offset-4">{ui.checklistLink}</Link></p> : null}
            <p className="text-sm text-muted">
              {ui.next}:{" "}
              <Link
                href="/podcast-clip-maker"
                className="font-medium text-accent underline underline-offset-4"
              >
                {ui.nextLink}
              </Link>
              .
            </p>
          </div>
        </div>
        {hasChecklist ? (
          <div className="guide-print-sheet">
            <p>{ui.fieldNotes}</p>
            <h2 className="guide-print-title">{guide.printTitle}</h2>
            <p>
              {ui.episode}: ____________________ {ui.range}:
              ____________________
            </p>
            {guide.sections.map((section) => (
              <section key={section.id}>
                <h2>{section.title}</h2>
                <ul>
                  {section.checks?.map((check) => (
                    <li key={check}>{check}</li>
                  ))}
                </ul>
              </section>
            ))}
            <p style={{ marginTop: 18 }}>
              {ui.decision}
            </p>
            <p>
              {ui.changes}:
              ____________________________________________________
            </p>
            <p style={{ marginTop: 12 }}>
              {url.replace("https://", "")} · {guide.published}
            </p>
          </div>
        ) : null}
        <ContentCTA />
      </article>
    </ContentShell>
  );
}
