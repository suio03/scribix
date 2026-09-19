import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { VideoUploadLink } from "./VideoUploadLink";
import styles from "./VideoHomeShowcase.module.css";

import { CompactPlatformIcon } from "./publishing/icons";
import { PUBLISH_PLATFORMS, SPECS } from "./publishing/shared/specs";
const BASE = "/media/home-artwork";
const FEATURES = [
  "selection",
  "framing",
  "captions",
  "trim",
  "cover",
  "package",
] as const;
export async function VideoFeatureShowcase() {
  const t = await getTranslations("VideoHome.presentation");
  const hero = await getTranslations("VideoHome.hero");
  return (
    <section id="video-features" className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>{t("eyebrow")}</p>
          <h2 className={styles.heading}>{t("title")}</h2>
          <p className={styles.intro}>{t("intro")}</p>
        </div>
        <div className={styles.featureList}>
          {FEATURES.map((feature, index) => (
            <article
              key={feature}
              id={feature === "package" ? "video-publishing" : undefined}
              className={styles.feature}
            >
              <div className={styles.featureCopy}>
                <span className={styles.meta}>0{index + 1}</span>
                <h3>{t(`${feature}.title`)}</h3>
                <p>{t(`${feature}.body`)}</p>
                <VideoUploadLink className={styles.featureLink}>
                  {hero("primaryCta")}
                  <ArrowUpRight size={16} />
                </VideoUploadLink>
              </div>
              <Image
                src={`/media/home-features-v3/${feature}.webp`}
                alt={t(`${feature}.alt`)}
                width={1600}
                height={900}
                sizes="(max-width: 767px) 100vw, 760px"
                className={styles.featureImage}
              />
            </article>
          ))}
        </div>
        <p className={styles.note}>{t("illustrationNote")}</p>
      </div>
    </section>
  );
}

export async function VideoSimpleWorkflow() {
  const t = await getTranslations("VideoHome.showcase");
  return (
    <section id="video-how" className={styles.journeySection}>
      <div className={styles.inner}>
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>{t("workflowLabel")}</p>
          <h2 className={styles.heading}>{t("workflowTitle")}</h2>
        </div>
        <div className={styles.journey}>
          {(["upload", "refine", "publish"] as const).map((step, index) => (
            <article key={step} className={styles.journeyCard}>
              <span className={styles.meta}>0{index + 1}</span>
              <h3>{t(`${step}Title`)}</h3>
              <p>{t(`${step}Body`)}</p>
              <div className={styles.journeyVisual}>
                {step === "upload" ? (
                  <div className={styles.uploadPreview}>
                    <Image
                      src={`${BASE}/podcast.webp`}
                      alt=""
                      width={300}
                      height={180}
                    />
                    <span>↑ Interview.mp4</span>
                  </div>
                ) : step === "refine" ? (
                  <div className={styles.clipStack}>
                    {["podcast", "travel", "design"].map((name) => (
                      <Image
                        key={name}
                        src={`${BASE}/${name}.webp`}
                        width={80}
                        height={140}
                        alt=""
                      />
                    ))}
                  </div>
                ) : (
                  <div className={styles.channelList}>
                    {PUBLISH_PLATFORMS.map((platform) => (
                      <span key={platform}>
                        <span className={styles.platformIcon}>
                          <CompactPlatformIcon platform={platform} size={24} />
                        </span>
                        {SPECS[platform].label}
                        <span aria-hidden>✓</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
