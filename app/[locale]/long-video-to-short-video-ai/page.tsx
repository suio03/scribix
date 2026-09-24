import type { Metadata } from "next";
import Image from "next/image";
import { ArrowDown, ArrowRight, ArrowUpRight, Captions, Check, Crop, FileVideo, ScanText, Scissors } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { auth } from "@/auth";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { ContentShell } from "@/app/components/guides/ContentShell";
import { ClipLandingUploadButton } from "@/app/components/marketing/ClipLandingUploadButton";
import { ONE_GIB, PLANS } from "@/lib/plans";
import { languageAlternates, socialImages, urlFor } from "@/lib/metadata-url";
import styles from "./page.module.css";

const path = "/long-video-to-short-video-ai";
type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "LongVideoLanding" });
  const title = t("meta.title");
  const description = t("meta.description");
  const canonical = urlFor(locale, path).href;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical, languages: languageAlternates(path) },
    openGraph: { title, description, url: canonical, siteName: "Scribix", type: "website", images: socialImages },
    twitter: { card: "summary_large_image", title, description, images: socialImages },
  };
}

export function generateStaticParams() {
  return routing.locales.map(locale => ({ locale }));
}

const steps = [
  { key: "upload", icon: FileVideo },
  { key: "review", icon: ScanText },
  { key: "refine", icon: Scissors },
  { key: "export", icon: ArrowUpRight },
] as const;
const controls = [
  { key: "context", icon: ScanText },
  { key: "cut", icon: Scissors },
  { key: "vertical", icon: Crop },
] as const;
const benefits = [
  { key: "moments", icon: ScanText },
  { key: "captions", icon: Captions },
  { key: "framing", icon: Crop },
  { key: "choice", icon: Check },
] as const;
const useCases = ["podcasts", "webinars", "lessons"] as const;
const faqKeys = ["longVideo", "types", "editing", "count", "youtube", "free"] as const;
const planValues = {
  minutes: PLANS.free.minutesPerCycle,
  uploadGiB: PLANS.free.maxVideoUploadBytes / ONE_GIB,
  freeDays: PLANS.free.videoSourceRetentionDays,
  paidDays: PLANS.basic.videoSourceRetentionDays,
};

export default async function LongVideoToShortVideoPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const [session, t] = await Promise.all([auth(), getTranslations("LongVideoLanding")]);
  const signedIn = !!session;

  return (
    <ContentShell primaryAction={<ClipLandingUploadButton signedIn={signedIn} className="hidden sm:inline-flex" />}>
      <div className={styles.page}>
        <section className={`${styles.container} ${styles.hero}`} aria-labelledby="landing-title">
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{t("hero.eyebrow")}</p>
            <h1 id="landing-title" className={styles.title}>{t.rich("hero.title", { accent: chunks => <span>{chunks}</span> })}</h1>
            <p className={styles.intro}>{t("hero.intro")}</p>
            <div className={styles.actions}>
              <ClipLandingUploadButton signedIn={signedIn} />
              <a href="#example" className={styles.textLink}>{t("hero.example")} <ArrowDown size={16} aria-hidden="true" /></a>
            </div>
            <p className={styles.ctaNote}>{t("hero.note", planValues)}</p>
          </div>
          <figure id="example" className={styles.demo}>
            <div className={styles.demoLabel}><span>{t("demo.label")}</span><span>16:9 <ArrowRight size={14} aria-hidden="true" /> 9:16</span></div>
            <div className={styles.demoVisual}>
              <Image src="/media/long-video-to-short-video-ai/podcast-demo-localized.webp" width={1536} height={1024} priority sizes="(min-width: 1024px) 650px, (min-width: 640px) 90vw, 100vw" alt={t("demo.alt")} className={styles.demoImage} />
              <div className={styles.demoSubtitles} aria-hidden="true"><span>{t("demo.line1")}</span><span>{t("demo.line2")}</span></div>
            </div>
            <figcaption>{t("demo.caption")}</figcaption>
          </figure>
        </section>

        <div className={`${styles.container} ${styles.benefits}`}>
          {benefits.map(({ key, icon: Icon }) => <span key={key}><Icon size={18} aria-hidden="true" />{t(`benefits.${key}`)}</span>)}
        </div>

        <section className={`${styles.container} ${styles.section}`} aria-labelledby="workflow-title">
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>{t("workflow.eyebrow")}</p><h2 id="workflow-title">{t("workflow.title")}</h2></div>
            <p>{t("workflow.intro")}</p>
          </div>
          <ol className={styles.steps}>
            {steps.map(({ key, icon: Icon }, index) => (
              <li key={key}>
                <div className={styles.stepTop}><span>0{index + 1}</span><Icon size={23} strokeWidth={1.6} aria-hidden="true" /></div>
                <h3>{t(`workflow.steps.${key}.title`)}</h3><p>{t(`workflow.steps.${key}.text`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.controlSection} aria-labelledby="controls-title">
          <div className={`${styles.container} ${styles.controlLayout}`}>
            <div>
              <p className={styles.eyebrow}>{t("controls.eyebrow")}</p>
              <h2 id="controls-title">{t.rich("controls.title", { accent: chunks => <span className="text-accent">{chunks}</span> })}</h2>
              <p className={styles.controlIntro}>{t("controls.intro")}</p>
              <p className={styles.planNote}>{t("controls.planNote")} <Link href="/pricing">{t("controls.compare")} <ArrowRight size={14} aria-hidden="true" /></Link></p>
            </div>
            <div className={styles.controls}>
              {controls.map(({ key, icon: Icon }) => (
                <article key={key}><div className={styles.icon}><Icon size={22} strokeWidth={1.7} aria-hidden="true" /></div><div><h3>{t(`controls.items.${key}.title`)}</h3><p>{t(`controls.items.${key}.text`)}</p></div></article>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.container} ${styles.section}`} aria-labelledby="use-cases-title">
          <p className={styles.eyebrow}>{t("useCases.eyebrow")}</p>
          <h2 id="use-cases-title">{t("useCases.title")}</h2>
          <div className={styles.useCases}>
            {useCases.map((key, index) => (
              <article key={key}><div className={styles.caseTop}><span className={styles.caseNumber}>0{index + 1}</span><span>{t(`useCases.items.${key}.label`)}</span></div><h3>{t(`useCases.items.${key}.title`)}</h3><p>{t(`useCases.items.${key}.text`)}</p><div className={styles.caseExample}><ArrowRight size={17} aria-hidden="true" />{t(`useCases.items.${key}.example`)}</div></article>
            ))}
          </div>
          <p className={styles.guideLink}>{t("useCases.guideIntro")} <Link href="/guides/how-to-clip-podcasts-for-tiktok">{t("useCases.guideLink")} <ArrowRight size={15} aria-hidden="true" /></Link></p>
        </section>

        <section className={`${styles.container} ${styles.faqSection}`} aria-labelledby="faq-title">
          <div><p className={styles.eyebrow}>{t("faq.eyebrow")}</p><h2 id="faq-title">{t("faq.title")}</h2><p className={styles.faqIntro}>{t("faq.intro")}</p></div>
          <div>{faqKeys.map(key => <details key={key} className={styles.faq}><summary>{t(`faq.items.${key}.question`)}<span aria-hidden="true">+</span></summary><p>{t(`faq.items.${key}.answer`, planValues)}</p></details>)}</div>
        </section>

        <aside className={`${styles.container} ${styles.storageNote}`} aria-label={t("storage.label")}>
          <FileVideo size={21} aria-hidden="true" /><p><strong>{t("storage.title")}</strong> {t("storage.text", planValues)} <Link href="/privacy" locale="en">{t("storage.privacy")}</Link></p>
        </aside>

        <section className={`${styles.container} ${styles.finalCta}`} aria-labelledby="final-title">
          <p className={styles.eyebrow}>{t("final.eyebrow")}</p>
          <h2 id="final-title">{t("final.title")}</h2>
          <ClipLandingUploadButton signedIn={signedIn} />
          <p className={styles.ctaNote}>{t("final.note")}</p>
        </section>
      </div>
    </ContentShell>
  );
}
