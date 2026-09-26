import type { Metadata } from "next";
import { HomeLoopVideo } from "@/app/components/HomeLoopVideo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowDown, ArrowRight, Captions, Crop, FileVideo, Scissors, Check, Clapperboard } from "lucide-react";
import { auth } from "@/auth";
import { Link } from "@/i18n/navigation";
import { ContentShell, JsonLd } from "@/app/components/guides/ContentShell";
import { ClipLandingUploadButton } from "@/app/components/marketing/ClipLandingUploadButton";
import { PLANS, ONE_GIB } from "@/lib/plans";
import { languageAlternates, socialImages, urlFor } from "@/lib/metadata-url";
import styles from "./page.module.css";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "YouTubeShortsLanding" });
  const title = t("metaTitle");
  const description = t("metaDescription");
  const path = "/youtube-shorts-maker";
  const canonical = urlFor(locale, path).href;
  return {
    title: { absolute: title }, description,
    alternates: { canonical, languages: languageAlternates(path) },
    openGraph: { title, description, url: canonical, siteName: "Scribix", type: "website", images: socialImages },
    twitter: { card: "summary_large_image", title, description, images: socialImages },
  };
}

const steps = [
  { key: "upload", icon: FileVideo },
  { key: "select", icon: Scissors },
  { key: "export", icon: Clapperboard },
] as const;
const checks = ["opening", "idea", "frame", "review"] as const;
const faqs = ["link", "free", "input", "count", "edit", "reuse", "publish"] as const;
const mediaByLocale: Record<string, string> = {
  en: "short-studio", fr: "short-studio-fr", es: "short-studio-es",
  it: "short-studio-it", de: "short-studio-de", ja: "short-studio-ja",
};

export default async function YouTubeShortsMakerPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "YouTubeShortsLanding" });
  const quota = { minutes: PLANS.free.minutesPerCycle, uploadGiB: PLANS.free.maxVideoUploadBytes / ONE_GIB };
  const shortMedia = `/media/youtube-shorts-maker/${mediaByLocale[locale] ?? mediaByLocale.en}`;
  const session = await auth();
  const upload = <ClipLandingUploadButton signedIn={!!session} />;
  return <ContentShell primaryAction={upload}>
    <JsonLd value={{
      "@context": "https://schema.org", "@type": "WebPage",
      name: t("metaTitle"), description: t("metaDescription"),
      url: urlFor(locale, "/youtube-shorts-maker").href, inLanguage: locale,
    }} />
    <div className={styles.page} lang={locale}>
      <section className={`${styles.container} ${styles.hero}`}>
        <div>
          <h1 className={styles.heroHeading}>
            <span className={styles.eyebrow}><Clapperboard size={17} aria-hidden="true" /> {t("eyebrow")}</span>
            <span className={styles.heroHeadline}>{t.rich("heroTitle", { br: () => <br />, accent: chunks => <span className={styles.heroAccent}>{chunks}</span> })}</span>
          </h1>
          <p className={styles.intro}>{t("intro")}</p>
          <div className={styles.actions}>{upload}<a href="#demo">{t("demoCta")} <ArrowDown size={16} aria-hidden="true" /></a></div>
          <p className={styles.note}>{t("freeNote", quota)}</p>
          <p className={styles.inputNote}>{t("inputNote")}</p>
        </div>
        <figure className={styles.heroVisual}>
          <div className={styles.heroTag}><span className={styles.dot} /> {t("heroTag")}</div>
          <div className={styles.miniSource}><HomeLoopVideo src="/media/youtube-shorts-maker/source-studio.mp4" poster="/media/youtube-shorts-maker/source-studio.jpg" label={t("heroSourceLabel")} controls /><span>{t("sourceTag")} · 16:9</span></div>
          <div className={styles.connector} aria-hidden="true"><ArrowRight size={27} /></div>
          <div className={styles.phone}><HomeLoopVideo src={`${shortMedia}.mp4`} poster={`${shortMedia}.jpg`} label={t("heroShortLabel")} controls /><span className={styles.phoneTag}>9:16 · {t("phoneTag")}</span></div>
          <div className={styles.visualNote}><Check size={16} aria-hidden="true" /> {t.rich("visualNote", { br: () => <br />, accent: chunks => <span>{chunks}</span> })}</div>
          <figcaption>{t("visualCaption")}</figcaption>
        </figure>
      </section>

      <div className={`${styles.container} ${styles.strip}`}><span><Scissors size={17} /> {t("benefitMoments")}</span><span><Captions size={17} /> {t("benefitCaptions")}</span><span><Crop size={17} /> {t("benefitFraming")}</span><span><FileVideo size={17} /> {t("benefitDownload")}</span></div>

      <section id="demo" className={`${styles.container} ${styles.demoSection}`} aria-labelledby="demo-title">
        <div className={styles.heading}><div><p className={styles.eyebrow}>{t("demoEyebrow")}</p><h2 id="demo-title">{t.rich("demoTitle", { br: () => <br />, accent: chunks => <span>{chunks}</span> })}</h2></div><p>{t("demoIntro")}</p></div>
        <div className={styles.demoStage}>
          <div className={styles.sourcePanel}><div className={styles.mediaLabel}><span>01 / {t("recordingLabel")}</span><span>16:9</span></div><HomeLoopVideo controls src="/media/youtube-shorts-maker/source-studio.mp4" poster="/media/youtube-shorts-maker/source-studio.jpg" label={t("demoSourceLabel")} /><p>{t("sourceDescription")}</p><div className={styles.editNotes}><span><Crop size={18} /> {t("editNoteFrame")}</span><span><Captions size={18} /> {t("editNoteCaptions")}</span><span><Scissors size={18} /> {t("editNoteReview")}</span></div></div>
          <div className={styles.stageArrow} aria-hidden="true"><ArrowRight size={28} /></div>
          <div className={styles.outputPanel}><div className={styles.mediaLabel}><span>02 / {t("verticalLabel")}</span><span>9:16</span></div><HomeLoopVideo controls src={`${shortMedia}.mp4`} poster={`${shortMedia}.jpg`} label={t("demoShortLabel")} /></div>
        </div>
        <p className={styles.credit}>{t.rich("credit", { source: chunks => <a href="https://www.pexels.com/video/woman-doing-podcast-4540152/" target="_blank" rel="noreferrer">{chunks}</a> })}</p>
      </section>

      <section className={`${styles.container} ${styles.section}`} aria-labelledby="steps-title"><p className={styles.eyebrow}>{t("stepsEyebrow")}</p><h2 id="steps-title">{t.rich("stepsTitle", { br: () => <br />, accent: chunks => <span>{chunks}</span> })}</h2><ol className={styles.steps}>{steps.map(({ key, icon: Icon }, i) => <li key={key}><div className={styles.stepTop}><span>0{i + 1}</span><Icon size={25} aria-hidden="true" /></div><h3>{t(`${key}Title`)}</h3><p>{t(`${key}Text`)}</p></li>)}</ol></section>

      <section className={styles.editorSection}><div className={`${styles.container} ${styles.editorGrid}`}><div><p className={styles.eyebrow}>{t("editorEyebrow")}</p><h2>{t.rich("editorTitle", { br: () => <br />, accent: chunks => <span>{chunks}</span> })}</h2><p className={styles.intro}>{t("editorIntro")}</p><p className={styles.note}>{t("paidNote")} <Link href="/pricing">{t("pricingLink")} ↗</Link></p></div><div className={styles.features}><article><Scissors aria-hidden="true" /><div><h3>{t("featureCutTitle")}</h3><p>{t("featureCutText")}</p></div></article><article><Captions aria-hidden="true" /><div><h3>{t("featureCaptionsTitle")}</h3><p>{t("featureCaptionsText")}</p></div></article><article><Crop aria-hidden="true" /><div><h3>{t("featureFrameTitle")}</h3><p>{t("featureFrameText")}</p><Link href="/guides/how-to-convert-horizontal-video-to-vertical">{t("framingLink")} <ArrowRight size={14} /></Link></div></article></div></div></section>

      <section className={`${styles.container} ${styles.checkSection}`} aria-labelledby="check-title"><div><p className={styles.eyebrow}>{t("checkEyebrow")}</p><h2 id="check-title">{t.rich("checkTitle", { br: () => <br />, accent: chunks => <span>{chunks}</span> })}</h2><p className={styles.intro}>{t("checkIntro")}</p>{upload}</div><ol className={styles.checklist}>{checks.map((key, i) => <li key={key}><span>0{i + 1}</span><div><h3>{t(`${key}Title`)}</h3><p>{t(`${key}Text`)}</p></div></li>)}</ol></section>

      <section className={`${styles.container} ${styles.faqSection}`} aria-labelledby="faq-title"><div><p className={styles.eyebrow}>{t("faqEyebrow")}</p><h2 id="faq-title">{t.rich("faqTitle", { br: () => <br />, accent: chunks => <span>{chunks}</span> })}</h2></div><div>{faqs.map(key => <details key={key}><summary>{t(`${key}Question`)}<span aria-hidden="true">+</span></summary><p>{t(`${key}Answer`, quota)}</p></details>)}</div></section>
      <section className={`${styles.container} ${styles.final}`}><p className={styles.eyebrow}>{t("finalEyebrow")}</p><h2>{t.rich("finalTitle", { br: () => <br />, accent: chunks => <span>{chunks}</span> })}</h2><p>{t("finalIntro")}</p>{upload}<p className={styles.note}>{t("finalNote")}</p><div className={styles.related}><Link href="/long-video-to-short-video-ai">{t("relatedLong")} <ArrowRight size={14} /></Link><Link href="/podcast-clip-maker">{t("relatedPodcast")} <ArrowRight size={14} /></Link></div></section>
    </div>
  </ContentShell>;
}
