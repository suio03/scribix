import { Link } from "@/i18n/navigation";
import { setRequestLocale } from "next-intl/server";
import { ContentShell, JsonLd } from "@/app/components/guides/ContentShell";
import { contentMetadata } from "@/lib/guides/metadata";
import { getContentCopy } from "@/lib/guides/copy";
import { urlFor } from "@/lib/metadata-url";
import { PLANS } from "@/lib/plans";

type Props = { params: Promise<{locale: string}> };
export async function generateMetadata({params}: Props) {
  const {locale} = await params;
  const {podcast: p} = getContentCopy(locale);
  return contentMetadata(p.metaTitle, p.description, "/podcast-clip-maker", false, locale);
}
export default async function PodcastPage({params}: Props) {
  const {locale} = await params;
  setRequestLocale(locale);
  const {podcast: p} = getContentCopy(locale);
  const withMinutes = (text: string) => text.replace("{minutes}", new Intl.NumberFormat(locale).format(PLANS.free.minutesPerCycle));
  return <ContentShell>
    <JsonLd value={{"@context":"https://schema.org","@type":"WebPage",name:p.metaTitle,url:urlFor(locale,"/podcast-clip-maker").href,inLanguage:locale,description:p.description}} />
    <div className="mx-auto max-w-[1240px] px-5 pb-20 pt-16 sm:px-8 sm:pt-24">
      <section className="grid items-end gap-10 lg:grid-cols-[1.45fr_1fr]">
        <div>
          <p className="guide-eyebrow">{p.label}</p>
          <h1 className="guide-title mt-5">{p.title}</h1>
          <p className="mt-7 max-w-[570px] text-lg text-muted">{p.intro}</p>
          <Link href="/#upload" className="guide-button mt-8">{p.upload} <span aria-hidden="true">↗</span></Link>
          <p className="mt-3 text-sm text-muted">{withMinutes(p.free)}</p>
        </div>
        <aside className="rounded-[24px] border border-line bg-card p-7 sm:p-9">
          <p className="guide-eyebrow">{p.checkLabel}</p>
          <p className="mt-7 text-3xl font-medium leading-tight tracking-tight">{p.checkTitle}</p>
          <div className="my-7 h-px bg-line" />
          <p className="text-muted">{p.checkBody}</p>
          <Link href="/guides/podcast-clip-checklist" className="mt-6 inline-block text-sm font-semibold text-accent underline underline-offset-4">{p.checkLink} →</Link>
        </aside>
      </section>
      <section className="mt-20 border-t border-line pt-10" aria-labelledby="workflow-title">
        <p className="guide-eyebrow">{p.workflowLabel}</p>
        <h2 id="workflow-title" className="mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-[-0.045em]">{p.workflowTitle}</h2>
        <ol className="mt-10 grid gap-8 md:grid-cols-3">{p.steps.map((step,index)=><li key={index} className="border-t border-line pt-6">
          <span className="font-mono text-sm text-accent">0{index+1}</span>
          <h3 className="mt-5 text-2xl font-semibold leading-tight tracking-tight">{step.title}</h3>
          <p className="mt-4 text-muted">{step.body}</p>
        </li>)}</ol>
      </section>
      <section className="mt-20 grid gap-8 rounded-[24px] bg-accent-soft p-7 sm:p-10 lg:grid-cols-2">
        <div>
          <p className="guide-eyebrow">{p.editLabel}</p>
          <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-[-0.045em]">{p.editTitle}</h2>
          <p className="mt-5 text-muted">{p.editBody}</p>
          <Link href="/pricing" className="mt-6 inline-block font-semibold text-accent underline underline-offset-4">{p.plans} →</Link>
        </div>
        <ul className="space-y-6">{p.features.map((item,index)=><li key={index}><h3 className="font-semibold">{item.title}</h3><p className="mt-1 text-muted">{item.body}</p></li>)}</ul>
      </section>
      <section className="mx-auto mt-20 max-w-[760px]" aria-labelledby="faq-title">
        <h2 id="faq-title" className="text-4xl font-semibold tracking-tight">{p.faqTitle}</h2>
        <div className="mt-8 border-t border-line">{p.faqs.map((faq,index)=><details key={index} className="border-b border-line py-5">
          <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-5 text-lg font-medium">{faq.question}<span aria-hidden="true" className="text-accent">+</span></summary>
          <p className="mt-4 text-muted">{withMinutes(faq.answer)}</p>
        </details>)}</div>
        <p className="mt-5 text-sm text-muted">{p.audioHint} <Link href="/audio-to-text" className="text-accent underline underline-offset-4">{p.audioLink}</Link></p>
      </section>
      <section className="mt-20 border-t border-line pt-12">
        <p className="guide-eyebrow">{p.endLabel}</p>
        <h2 className="mt-4 text-4xl font-semibold tracking-tight">{p.endTitle}</h2>
        <Link href="/#upload" className="guide-button mt-7">{p.endCta} <span aria-hidden="true">↗</span></Link>
      </section>
    </div>
  </ContentShell>;
}
