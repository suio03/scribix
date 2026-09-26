import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { ContentShell, JsonLd } from "@/app/components/guides/ContentShell";
import { ComparisonDemo } from "@/app/components/guides/ComparisonDemo";
import { OPUS_COMPARISON as article, COMPARISON_TOOLS, COMPARISON_FAQS } from "@/lib/alternatives/opus-clip";
import { socialImages } from "@/lib/metadata-url";
import "@/app/components/guides/comparison.css";

const canonical = `https://scribix.io${article.path}`;

export const metadata: Metadata = {
  title: article.title,
  description: article.description,
  alternates: { canonical, languages: {} },
  openGraph: {
    title: article.title, description: article.description, url: canonical,
    siteName: "Scribix", type: "article", publishedTime: article.published,
    modifiedTime: article.modified, images: socialImages,
  },
  twitter: { card: "summary_large_image", title: article.title, description: article.description, images: socialImages },
};

export function generateStaticParams() {
  return [{ locale: "en" }];
}

export default async function OpusClipAlternatives({ params }: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (locale !== "en") redirect({ href: article.path, locale: "en" });
  setRequestLocale("en");

  return (
    <ContentShell showLanguageSwitcher={false} section="alternatives">
      <JsonLd value={{
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "Article", headline: article.title, description: article.description,
            datePublished: article.published, dateModified: article.modified, inLanguage: "en",
            mainEntityOfPage: canonical,
            author: { "@type": "Organization", name: "Scribix", url: "https://scribix.io" },
            publisher: { "@type": "Organization", name: "Scribix", url: "https://scribix.io" } },
          { "@type": "BreadcrumbList", itemListElement: [
            { "@type": "ListItem", position: 1, name: "Alternatives", item: "https://scribix.io/alternatives" },
            { "@type": "ListItem", position: 2, name: article.title, item: canonical },
          ] },
        ],
      }} />
      <article className="comparison-page mx-auto max-w-[1240px] px-5 pb-20 sm:px-8">
        <header className="comparison-header">
          <Link href="/alternatives" className="comparison-back">← All alternatives</Link>
          <p className="guide-eyebrow mt-10">The creator’s shortlist / Comparison</p>
          <h1 className="guide-title mt-5 max-w-[990px]">OpusClip alternatives<br />for <span className="text-accent">podcast clips.</span></h1>
          <p className="comparison-intro">The right tool fits the work after the first cut. Compare Scribix, Vizard and quso.ai with OpusClip—from reviewing the conversation to finishing a clip you want to share.</p>
          <div className="comparison-byline"><span>By Scribix</span><time dateTime={article.modified}>Updated {article.modifiedDisplayDate}</time><a href="#sources">Sources &amp; approach ↗</a></div>
          <p className="comparison-disclosure">We make Scribix. This guide compares published features and workflow fit; it is not a head-to-head output benchmark.</p>
        </header>

        <section aria-labelledby="shortlist-title" className="comparison-shortlist">
          <div className="comparison-section-top"><h2 id="shortlist-title">Start with what you need.</h2><a href="#comparison">Jump to the comparison ↓</a></div>
          <div className="comparison-picks">
            {COMPARISON_TOOLS.map((tool, index) => <a key={tool.id} href={`#${tool.id}`} className={tool.id === "scribix" ? "comparison-pick is-scribix" : "comparison-pick"}>
              <span className="comparison-pick-index">0{index + 1} {tool.id === "opus" ? "/ The baseline" : "/ Alternative"}</span>
              <h3>{tool.name}</h3><strong>{tool.role}</strong><p>{tool.summary}</p><span className="comparison-pick-link">See the fit <span aria-hidden="true">↗</span></span>
            </a>)}
          </div>
        </section>

        <section id="comparison" className="comparison-section" aria-labelledby="comparison-title">
          <p className="guide-eyebrow">01 / At a glance</p>
          <h2 id="comparison-title">Compare the practical differences.</h2>
          <p className="comparison-lead">Free access, editing access and a finished export are different things. Start with the limits you would encounter on your next episode.</p>
          <p className="comparison-table-hint" id="comparison-table-hint">Monthly USD prices; annual offers differ. On small screens, scroll the table sideways.</p>
          <div className="comparison-table-scroll" role="region" aria-label="Tool comparison" aria-describedby="comparison-table-hint" tabIndex={0}>
            <table className="comparison-table">
              <caption className="sr-only">OpusClip and three alternatives: free allowance, limits, monthly prices, editing and output</caption>
              <thead><tr><th scope="col">What matters</th>{COMPARISON_TOOLS.map(tool => <th scope="col" key={tool.id}>{tool.name}</th>)}</tr></thead>
              <tbody>
                {([
                  ["Free allowance", "free"], ["Free-plan boundaries", "freeLimit"],
                  ["Paid entry / month", "paid"], ["Editing workflow", "editing"], ["Output & next steps", "output"],
                ] as const).map(([label, key]) => <tr key={key}><th scope="row">{label}</th>{COMPARISON_TOOLS.map(tool => <td key={tool.id}>{tool[key]}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
          <p className="comparison-footnote">Checked {article.displayDate}. Source minutes and vendor credits are not a count of finished clips. Prices and allowances can change; confirm the selected plan before paying.</p>
        </section>

        <section id="scribix" className="comparison-section" aria-labelledby="scribix-title">
          <p className="guide-eyebrow">02 / A closer look at Scribix</p>
          <div className="comparison-section-heading"><h2 id="scribix-title">Keep the editorial<br />decisions in your hands.</h2><p>{COMPARISON_TOOLS[0].detail}</p></div>
          <ComparisonDemo />
          <div className="comparison-editorial-notes">
            <div><h3>Choose a complete thought.</h3><p>Use the transcript and surrounding source to check what the speaker means. A strong opening still needs the answer, example or qualification that follows it.</p></div>
            <div><h3>Review the whole frame.</h3><p>Check speaker changes and anything being demonstrated. A portrait canvas alone does not guarantee that every important detail stays visible.</p></div>
            <div><h3>Check the file you will post.</h3><p>Read the captions, listen to both ends and watch the exported MP4. The final file is where your editing decisions come together.</p></div>
          </div>
          <aside className="comparison-tradeoff"><strong>Where another tool may fit better</strong><p>{COMPARISON_TOOLS[0].caveat}</p></aside>
          <div className="comparison-export">
            <div className="comparison-export-copy"><p className="guide-eyebrow">Watch the existing result</p><h3>From the Guide,<br />with the sound on.</h3><p>This is the existing 57-second Scribix export used in our podcast tutorial. The original captions and letterboxing are preserved.</p><p className="text-sm text-muted">Source: Changeover Podcast. This example shows one export, not a comparison of the four tools’ output quality.</p><Link href="/guides/how-to-clip-podcasts-for-tiktok" className="comparison-text-link">See the full podcast workflow ↗</Link></div>
            <div className="comparison-export-player"><video controls playsInline preload="none" poster="/media/guides/podcast-tiktok/export-poster.jpg" aria-label="Play the existing Scribix podcast export with audio and burned-in captions"><source src="/media/guides/podcast-tiktok/export.mp4" type="video/mp4" /><a href="/media/guides/podcast-tiktok/export.mp4">Download the podcast clip</a></video></div>
          </div>
        </section>

        <section className="comparison-section" aria-labelledby="other-tools-title">
          <p className="guide-eyebrow">03 / Match the tool to the job</p>
          <h2 id="other-tools-title">Three other workflows to consider.</h2>
          <div className="comparison-tool-details">
            {COMPARISON_TOOLS.slice(1).map(tool => <section id={tool.id} key={tool.id} className="comparison-tool-detail" aria-labelledby={`${tool.id}-title`}>
              <div><p className="guide-eyebrow">{tool.role}</p><h3 id={`${tool.id}-title`}>{tool.name}</h3></div>
              <div><p>{tool.detail}</p><p className="comparison-tool-caveat"><strong>Check before choosing:</strong> {tool.caveat}</p>{"comparisonPath" in tool ? <Link href={tool.comparisonPath} className="comparison-text-link">Compare Vizard and Scribix in detail ↗</Link> : null}</div>
            </section>)}
          </div>
        </section>

        <section className="comparison-section" aria-labelledby="decision-title">
          <p className="guide-eyebrow">04 / Make the decision</p>
          <div className="comparison-section-heading"><h2 id="decision-title">Choose around your<br />next episode.</h2><div><p>First decide what you are trying to improve: selecting a moment, correcting it, handing it to an editor or distributing it. Then compare the plan that includes that step.</p><p className="mt-5">For a useful trial, bring a recording you have permission to use and take one clip all the way to a file. Judge whether you can finish it with the control you need.</p><Link href="/guides/podcast-clip-checklist" className="comparison-text-link">Use the podcast clip checklist ↗</Link></div></div>
        </section>

        <section className="comparison-section comparison-faq" aria-labelledby="faq-title">
          <p className="guide-eyebrow">Questions before you switch</p><h2 id="faq-title">A few useful answers.</h2>
          {COMPARISON_FAQS.map(faq => <details key={faq.question}><summary>{faq.question}<span aria-hidden="true">+</span></summary><p>{faq.answer}</p></details>)}
        </section>

        <section id="sources" className="comparison-sources" aria-labelledby="sources-title">
          <h2 id="sources-title">Sources &amp; approach</h2>
          <p>Published by Scribix. Recommendations reflect our interpretation of workflow fit. Competitor features and plan limits were checked against each vendor’s own pricing page on {article.displayDate}; Vizard’s monthly Creator price was checked in its live plan selector. No competitor performance tests were conducted for this article.</p>
          <ul>{COMPARISON_TOOLS.map(tool => <li key={tool.id}>{tool.sourceLabel}</li>)}</ul>
          <p>quso.ai’s publishing tiers were rechecked on September 26, 2026: Lite lists TikTok publishing; Essential adds scheduling to seven platforms.</p>
          <p>Scribix illustrations reuse material from our <Link href="/guides/how-to-clip-podcasts-for-tiktok">podcast clipping guide</Link>. They explain the workflow; they do not measure processing speed, demonstrate new edits or imply endorsement by the people shown.</p>
        </section>

        <aside className="comparison-final-cta"><div><p className="guide-eyebrow">Your next episode</p><h2>Find a moment<br />worth sharing.</h2><p>Start with your own video. Review the idea before you publish the clip.</p></div><div><Link href="/#upload" className="guide-button">Start with Scribix <span aria-hidden="true">↗</span></Link><Link href="/pricing" className="comparison-text-link">See plans and limits</Link></div></aside>
      </article>
    </ContentShell>
  );
}
