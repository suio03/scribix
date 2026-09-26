import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { Link, redirect } from "@/i18n/navigation";
import { ContentShell, JsonLd } from "@/app/components/guides/ContentShell";
import { ComparisonDemo } from "@/app/components/guides/ComparisonDemo";
import { VIZARD_COMPARISON as article, VIZARD_COMPARISON_ROWS, VIZARD_FAQS } from "@/lib/alternatives/vizard";
import { OPUS_ALTERNATIVE_PATH } from "@/lib/alternatives/routes";
import { PRICING_V2 } from "@/lib/pricing-v2";
import { socialImages } from "@/lib/metadata-url";
import "@/app/components/guides/comparison.css";
import "./vizard.css";

const canonical = `https://scribix.io${article.path}`;

export const metadata: Metadata = {
  title: "Vizard Alternative for Podcast Clips",
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

export default async function VizardAlternative({ params }: { params: Promise<{ locale: string }> }) {
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
      <article className="comparison-page vizard-page mx-auto max-w-[1240px] px-5 pb-20 sm:px-8">
        <header className="comparison-header">
          <Link href="/alternatives" className="comparison-back">← All alternatives</Link>
          <p className="guide-eyebrow mt-10">Vizard / A closer comparison</p>
          <h1 className="guide-title mt-5 max-w-[1000px]">A Vizard alternative<br />for <span className="text-accent">your next clip.</span></h1>
          <p className="comparison-intro">Considering Scribix for podcast clips? See how reviewing a passage, refining its boundaries and exporting a portrait video fits your work—and what you would leave behind in Vizard.</p>
          <div className="comparison-byline"><span>By Scribix</span><time dateTime={article.modified}>Checked {article.displayDate}</time><a href="#sources">Sources &amp; approach ↗</a></div>
          <p className="comparison-disclosure">We make Scribix. This is a feature and workflow comparison, not a test of which tool produces better clips.</p>
        </header>

        <section className="comparison-shortlist" aria-labelledby="fit-title">
          <div className="comparison-section-top"><h2 id="fit-title">Should you switch?</h2><a href="#comparison">Compare the details ↓</a></div>
          <div className="vizard-decisions">
            <div className="vizard-decision"><p className="guide-eyebrow">Keep Vizard in mind</p><h3>You need free editing.</h3><p>Vizard includes its editor on Free. Scribix lets you try original candidate exports, with editing on paid plans.</p></div>
            <div className="vizard-decision is-scribix"><p className="guide-eyebrow">Try the Scribix workflow</p><h3>You review one idea at a time.</h3><p>Explore the source passage, refine the cut and check a captioned portrait result. Try the steps on a recording you know.</p><a href="#workflow" className="comparison-text-link">See the workflow ↗</a></div>
            <div className="vizard-decision"><p className="guide-eyebrow">Check before moving</p><h3>Your team needs more.</h3><p>Internal sentence cuts, 4K delivery or a shared editing workspace? These are reasons to keep Vizard on your shortlist.</p></div>
          </div>
        </section>

        <section id="comparison" className="comparison-section" aria-labelledby="comparison-title">
          <p className="guide-eyebrow">01 / Vizard vs Scribix</p><h2 id="comparison-title">What actually changes.</h2>
          <p className="comparison-lead">Both tools offer AI clipping and text-related controls. The useful differences are what you can edit, what your plan includes and how you finish the file.</p>
          <p className="comparison-table-hint" id="table-hint">USD prices, with billing periods shown separately. Scroll the table sideways on small screens.</p>
          <div className="comparison-table-scroll" role="region" aria-label="Scribix and Vizard comparison" aria-describedby="table-hint" tabIndex={0}>
            <table className="comparison-table vizard-table">
              <caption className="sr-only">Scribix and Vizard: allowances, editing, entry plans and output</caption>
              <thead><tr><th scope="col">Your decision</th><th scope="col">Scribix</th><th scope="col">Vizard</th></tr></thead>
              <tbody>{VIZARD_COMPARISON_ROWS.map(row => <tr key={row.label}><th scope="row">{row.label}</th><td>{row.scribix}</td><td>{row.vizard}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="comparison-footnote">Checked {article.displayDate}. Vizard offers selectable credit tiers; the figures above use Creator’s entry setting. Credits and source minutes are not a count of finished clips.</p>
        </section>

        <section id="workflow" className="comparison-section" aria-labelledby="workflow-title">
          <p className="guide-eyebrow">02 / Try the working steps</p>
          <div className="comparison-section-heading"><h2 id="workflow-title">A complete thought.<br />A cut you can explain.</h2><p>Start with your original video file. Review the suggested passage against the conversation around it. On a paid plan, adjust the boundaries, framing and captions before exporting.</p></div>
          <ComparisonDemo />
          <div className="comparison-editorial-notes">
            <div><h3>Does the opening make sense?</h3><p>If it starts with “that” or “they,” check the earlier sentence. Move the start back when the listener needs that context.</p></div>
            <div><h3>Is the answer still complete?</h3><p>Listen beyond the proposed ending. Keep the explanation or qualification that makes the speaker’s point accurate.</p></div>
            <div><h3>Can you read the final frame?</h3><p>Watch speaker changes, crop edges and captions. Check the saved export, not just the editor preview.</p></div>
          </div>
          <div className="comparison-export">
            <div className="comparison-export-copy"><p className="guide-eyebrow">Existing Scribix output</p><h3>Watch the result.<br />Keep the context.</h3><p>This 57-second export comes from our podcast guide. It preserves the original captions and letterboxing. It is not a new before-and-after edit or a Vizard comparison test.</p><p className="text-sm text-muted">Source: Changeover Podcast. The interface illustration above explains controls; switching its scenes does not change this video.</p><Link href="/guides/how-to-clip-podcasts-for-tiktok" className="comparison-text-link">Follow the full podcast guide ↗</Link></div>
            <div className="comparison-export-player"><video controls playsInline preload="none" poster="/media/guides/podcast-tiktok/export-poster.jpg" aria-label="Existing Scribix podcast clip with audio and burned-in captions"><source src="/media/guides/podcast-tiktok/export.mp4" type="video/mp4" /><a href="/media/guides/podcast-tiktok/export.mp4">Download the podcast clip</a></video></div>
          </div>
        </section>

        <section className="comparison-section" aria-labelledby="plans-title">
          <p className="guide-eyebrow">03 / Compare the plan you will use</p>
          <div className="comparison-section-heading"><h2 id="plans-title">Compare entry prices.<br />Then the boundaries.</h2><div><p>Scribix Starter is ${PRICING_V2.starter.monthlyUsd}/month for {PRICING_V2.starter.processingMinutes} processing minutes. Vizard Creator’s compared setting is $29/month for 600 credits. Price alone is not a reason to switch.</p><p className="mt-5">If editing without paying is essential, Vizard’s free editor is a meaningful advantage. Scribix’s {PRICING_V2.free.processingMinutes} free minutes are a one-time starting allowance; they do not renew every month.</p><Link href="/pricing" className="comparison-text-link">Check Scribix plans and limits ↗</Link></div></div>
          <aside className="comparison-tradeoff"><strong>Decide how long you need the source.</strong><p>Scribix retains uploaded video sources for {PRICING_V2.free.sourceRetentionDays} days on Free and {PRICING_V2.starter.sourceRetentionDays} days on paid plans. Vizard lists 3-day storage on Free. Keep your own originals and download finished files; neither free workflow should be treated as your permanent archive.</p></aside>
        </section>

        <section className="comparison-section" aria-labelledby="tradeoffs-title">
          <p className="guide-eyebrow">04 / What you would leave behind</p><h2 id="tradeoffs-title">Keep the capabilities you rely on.</h2>
          <div className="comparison-editorial-notes">
            <div><h3>Editing inside the passage</h3><p>Vizard documents deleting transcript text to remove video. Scribix’s start and end controls do not replace internal sentence deletion or rearranging.</p></div>
            <div><h3>A broader delivery workflow</h3><p>Scribix’s current clip output is 9:16. If 4K export or shared team editing is essential, review Vizard’s Creator and Business features before moving.</p></div>
            <div><h3>Your existing projects</h3><p>There is no Vizard project importer. Your edits and templates do not transfer. You would upload an original video file and create a new Scribix project.</p></div>
          </div>
          <Link href={OPUS_ALTERNATIVE_PATH} className="comparison-text-link">Considering more tools? Explore our OpusClip alternatives ↗</Link>
        </section>

        <section className="comparison-section comparison-faq" aria-labelledby="faq-title">
          <p className="guide-eyebrow">Before you move</p><h2 id="faq-title">Questions about switching.</h2>
          {VIZARD_FAQS.map(faq => <details key={faq.question}><summary>{faq.question}<span aria-hidden="true">+</span></summary><p>{faq.answer}</p></details>)}
        </section>

        <section id="sources" className="comparison-sources" aria-labelledby="sources-title">
          <h2 id="sources-title">Sources &amp; approach</h2><p>Published by Scribix. Vizard’s pricing page and official text-based editing description were checked on {article.displayDate}. Its Creator monthly price and credit setting were verified in the live pricing selector. Scribix figures follow our current published plan configuration.</p>
          <ul><li>Vizard — Pricing</li><li>Vizard — Text Based Video Editing</li><li>Scribix — Plans and podcast guide</li></ul>
          <p>No Vizard output was generated or timed for this article. The Scribix example reuses existing guide material; it does not establish better quality, speed or audience performance. Features and prices may change.</p>
          <p>For your own evaluation, use the <Link href="/guides/podcast-clip-checklist">podcast clip checklist</Link> and explore the <Link href="/podcast-clip-maker">Scribix podcast workflow</Link>.</p>
        </section>

        <aside className="comparison-final-cta"><div><p className="guide-eyebrow">Try one recording</p><h2>Make the next cut<br />an informed choice.</h2><p>Start with {PRICING_V2.free.processingMinutes} free source-processing minutes, once per account. Review and export an original candidate. Editing requires a paid plan.</p></div><div><Link href="/#upload" className="guide-button">Try Scribix with your recording <span aria-hidden="true">↗</span></Link><Link href="/pricing" className="comparison-text-link">See plans and limits</Link></div></aside>
      </article>
    </ContentShell>
  );
}
