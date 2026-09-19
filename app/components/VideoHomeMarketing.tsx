import { VideoUploadLink } from "./VideoUploadLink";
import Image from "next/image";
import { PUBLISH_PLATFORMS, SPECS } from "./publishing/shared/specs";
import styles from "./VideoHomeShowcase.module.css";
import {
  AudioLines,
  ArrowUpRight,
  Film,
  Mic2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { mergeLocalizedItems } from "@/lib/localized-items";
import { SectionLabel } from "./SectionLabel";
import { VideoFeatureShowcase, VideoSimpleWorkflow } from "./VideoHomeShowcase";

type ItemCopy = { title: string; body: string };
type AudienceCopy = ItemCopy & { label: string };
type FaqCopy = { q: string; a: string };

const AUDIENCES = [
  { key: "creators", icon: Film },
  { key: "podcasters", icon: Mic2 },
  { key: "teams", icon: Users },
] as const satisfies ReadonlyArray<{ key: string; icon: LucideIcon }>;

export async function VideoHomeMarketing() {
  const t = await getTranslations("VideoHome");
  const audiences = mergeLocalizedItems(
    t.raw("audiences.items") as AudienceCopy[],
    AUDIENCES,
    "VideoHome.audiences.items",
  );
  const faqs = t.raw("faq.items") as FaqCopy[];

  return (
    <>
      <VideoFeatureShowcase />
      <VideoSimpleWorkflow />

      <section id="video-use-cases" className={styles.audienceSection}>
        <div className={styles.inner}>
          <div className={styles.sectionIntro}>
            <p className={styles.eyebrow}>{t("audiences.label")}</p>
            <h2 className={styles.heading}>{t("audiences.title")}</h2>
            <p className={styles.intro}>{t("audiences.intro")}</p>
          </div>
          <div className={styles.audienceGrid}>
            {audiences.map((audience, index) => (
              <article key={audience.key} className={styles.audienceCard}>
                <div className={styles.audiencePicture}>
                  <Image
                    src={`/media/home-artwork/${["travel", "podcast", "design"][index]}.webp`}
                    alt=""
                    fill
                    sizes="(max-width: 767px) 90vw, 380px"
                    className="object-cover"
                  />
                  <span>{audience.label}</span>
                </div>
                <div className={styles.audienceCopy}>
                  <h3>{audience.title}</h3>
                  <p>{audience.body}</p>
                  <a href="#video-publishing">
                    {t("showcase.exploreCases")}
                    <ArrowUpRight size={16} />
                  </a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-secondary-tools border-y border-line bg-card/55 px-4 py-7 sm:px-8">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-accent-soft text-accent">
              <AudioLines size={16} strokeWidth={1.7} />
            </span>
            <p className="text-[14px] text-muted">
              {t("secondaryTools.label")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-[13px] font-semibold">
            <Link
              href="/audio-to-text"
              className="underline decoration-line underline-offset-4 transition hover:decoration-accent"
            >
              {t("secondaryTools.audio")}
            </Link>
            <Link
              href="/youtube-to-transcript"
              className="underline decoration-line underline-offset-4 transition hover:decoration-accent"
            >
              {t("secondaryTools.youtube")}
            </Link>
            <Link
              href="/ai-note-taker"
              className="underline decoration-line underline-offset-4 transition hover:decoration-accent"
            >
              {t("secondaryTools.notes")}
            </Link>
          </div>
        </div>
      </section>

      <section
        id="video-faq"
        className="scroll-mt-20 px-4 py-20 sm:px-8 sm:py-28"
      >
        <div className="mx-auto grid max-w-[1180px] gap-12 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <SectionLabel number="05" label={t("faq.label")} />
            <h2 className="max-w-[12ch] font-display text-[38px] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-[50px]">
              {t("faq.title")}
            </h2>
            <p className="mt-5 max-w-[36ch] text-[14px] leading-[1.7] text-muted">
              {t("faq.contactPrefix")}{" "}
              <a
                href="mailto:hello@scribix.io"
                className="font-semibold text-ink underline decoration-accent decoration-2 underline-offset-4"
              >
                hello@scribix.io
              </a>
            </p>
          </div>
          <div className="divide-y divide-line border-y border-line">
            {faqs.map((faq, index) => (
              <details key={faq.q} className="group py-6">
                <summary className="flex items-start gap-5">
                  <span className="mt-0.5 font-mono text-[10px] text-muted">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1 font-display text-[17px] font-semibold leading-[1.45] tracking-[-0.015em]">
                    {faq.q}
                  </span>
                  <span className="faq-icon text-xl font-light leading-none text-muted transition">
                    +
                  </span>
                </summary>
                <p className="ml-10 mt-3 max-w-[65ch] text-[14px] leading-[1.75] text-muted">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-8">
        <div className={styles.finalPanel}>
          <p className={styles.eyebrow}>{t("final.kicker")}</p>
          <h2>{t("final.title")}</h2>
          <p className={styles.finalBody}>{t("final.body")}</p>
          <VideoUploadLink className={styles.finalButton}>
            {t("final.cta")}
            <ArrowUpRight size={18} />
          </VideoUploadLink>
          <div className={styles.finalPlatforms}>
            {PUBLISH_PLATFORMS.map((platform) => (
              <span key={platform}>{SPECS[platform].label}</span>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
