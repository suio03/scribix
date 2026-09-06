"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { CloudUpload, Download, Scissors } from "lucide-react";
import { useTranslations } from "next-intl";
import { useHomeVideoLoop } from "./useHomeVideoLoop";
import styles from "./VideoHomeShowcase.module.css";

const BASE = "/media/home-variety";
const MEDIA_REVISION = "20260906-framing-v4";
const mediaAsset = (filename: string) => `${BASE}/${filename}?v=${MEDIA_REVISION}`;
const LESSONS = [
  { id: 1, title: "What does freely licensed mean?", time: "00:30" },
  { id: 2, title: "Reusing an image", time: "04:54" },
  { id: 3, title: "Giving attribution", time: "08:19" },
] as const;
const SOURCES = [
  {
    id: "interview",
    title: "Interview with Steve Wozniak",
    author: "ConversationEDU",
    license: "CC BY 3.0",
    licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
    url: "https://commons.wikimedia.org/wiki/File:Interview_with_Steve_Wozniak.webm",
    duration: "14:48",
  },
  {
    id: "lecture",
    title: "Introduction — Ellen Gertsen",
    author: "NASA / Ellen Gertsen",
    license: "CC BY",
    licenseUrl: "https://science.nasa.gov/researchers/pi-launchpad-sessions/",
    url: "https://www.youtube.com/watch?v=FjJxkNtCCAU",
    duration: "18:08",
  },
  {
    id: "lesson-1",
    title: "Re-using freely-licensed media",
    author: "Asaf (WMF)",
    license: "CC BY-SA 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    url: "https://commons.wikimedia.org/wiki/File:WCC_module_5_-_23_-_re-using_freely-licensed_media.webm",
    duration: "09:48",
  },
  {
    id: "robotics",
    title: "Was macht ein Roboterforscher?",
    author: "ZDF/logo/Simone Klein",
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    url: "https://commons.wikimedia.org/wiki/File:Was_macht_ein_Roboterforscher%3F.webm",
    duration: "03:22",
  },
] as const;

export function VideoMediaCredits() {
  const t = useTranslations("VideoHome.showcase");
  return (
    <details className={styles.credits} id="home-media-credits">
      <summary>{t("credits")}</summary>
      <p>{t("creditNote")}</p>
      <ul>
        {SOURCES.map((source) => (
          <li key={source.id}>
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.title}
            </a>
            {" · "}
            {source.author}
            {" · "}
            <a href={source.licenseUrl} target="_blank" rel="noreferrer">
              {source.license}
            </a>
          </li>
        ))}
      </ul>
      <p>{t("shareAlike")}</p>
    </details>
  );
}

function Media({
  id = "interview",
  className,
  label,
  src,
  poster,
}: {
  src?: string;
  poster?: string;
  id?: string;
  className?: string;
  label: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  useHomeVideoLoop(video);
  return (
    <video
      ref={video}
      data-home-preview
      className={className}
      src={src ?? mediaAsset(`${id}.mp4`)}
      poster={poster ?? mediaAsset(`${id}.jpg`)}
      muted
      loop
      disablePictureInPicture
      playsInline
      preload="metadata"
      aria-label={label}
    />
  );
}

export function VideoCaseGallery() {
  const t = useTranslations("VideoHome.showcase");
  return (
    <section id="video-cases" className={styles.section}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>{t("casesLabel")}</p>
        <h2 className={styles.heading}>{t("casesTitle")}</h2>
        <p className={styles.intro}>{t("casesIntro")}</p>
        <div className={styles.varietyGallery}>
          {SOURCES.slice(0, 3).map((source, index) => (
            <article className={styles.varietyCard} key={source.id}>
              <div className={styles.varietyTop}>
                <span>0{index + 1}</span>
                <span>{t(`format${index + 1}`)}</span>
              </div>
              <Media id={source.id} label={source.title} />
              <div className={styles.varietyCopy}>
                <h3>{source.title}</h3>
                <p>{t(`formatBody${index + 1}`)}</p>
                <div className={styles.sourceFacts}>
                  <span>
                    {t("sourceDuration", { duration: source.duration })}
                  </span>
                  <span>{t("excerpt", { seconds: 10 })}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
        <a className={styles.creditLink} href="#home-media-credits">
          {t("credits")}
        </a>
      </div>
    </section>
  );
}

function FramingPreview() {
  const t = useTranslations("VideoHome.showcase");
  const stage = useRef<HTMLDivElement>(null);
  useHomeVideoLoop(stage);
  return (
    <div className={styles.stage} ref={stage}>
      <div className={styles.stageBar}>
        <strong>{t("sameMoment")}</strong>
        <span>16:9 → 9:16</span>
      </div>
      <div className={styles.compare}>
        <div>
          <span className={styles.compareLabel}>{t("original")}</span>
          <video
            data-home-preview
            src={mediaAsset("robotics.mp4")}
            poster={mediaAsset("robotics.jpg")}
            muted
            loop
            disablePictureInPicture
            playsInline
            preload="metadata"
            aria-label={t("original")}
          />
        </div>
        <div>
          <span className={styles.compareLabel}>{t("output")}</span>
          <video
            data-home-preview
            className={styles.portrait}
            src={mediaAsset("robotics-portrait.mp4")}
            poster={mediaAsset("robotics-portrait.jpg")}
            muted
            loop
            disablePictureInPicture
            playsInline
            preload="metadata"
            aria-label={t("output")}
          />
        </div>
      </div>
    </div>
  );
}

function TrimPreview() {
  const t = useTranslations("VideoHome.showcase");
  return (
    <div className={styles.stage}>
      <Media
        id="interview"
        className={styles.lessonVideo}
        label={t("trimTitle")}
      />
    </div>
  );
}

const CAPTION_CUES = [
  { end: 3.89, text: "if people are unable or afraid or have barriers" },
  { end: 5.1, text: "to putting in proposals," },
  { end: 7.08, text: "we’re not necessarily getting the best science," },
  { end: 10, text: "and so this is why this is really important to us." },
];

function CaptionPreview() {
  const t = useTranslations("VideoHome.showcase");
  const video = useRef<HTMLVideoElement>(null);
  const [cue, setCue] = useState(0);
  const [style, setStyle] = useState<"clean" | "focus">("focus");
  useHomeVideoLoop(video);
  return (
    <div className={styles.stage}>
      <div className={styles.stageBar}>
        <strong>{t("captionProof")}</strong>
        <span>EN / 9:16</span>
      </div>
      <div className={styles.captionLayout}>
        <div className={styles.captionPhone}>
          <video
            ref={video}
            data-home-preview
            src={mediaAsset("captions.mp4")}
            poster={mediaAsset("captions.jpg")}
            muted
            loop
            playsInline
            disablePictureInPicture
            preload="metadata"
            className={styles.portrait}
            aria-label={t("captionProof")}
            onTimeUpdate={(event) =>
              setCue(
                Math.max(
                  0,
                  CAPTION_CUES.findIndex(
                    (item) => event.currentTarget.currentTime < item.end,
                  ),
                ),
              )
            }
          />
          <div
            className={`${styles.captionOverlay} ${style === "focus" ? styles.captionFocus : ""}`}
          >
            {CAPTION_CUES[cue].text}
          </div>
        </div>
        <div>
          <p className={styles.styleLabel}>{t("spokenWords")}</p>
          <p className={styles.quote}>
            “We’re not necessarily getting the best science.”
          </p>
          <div
            className={styles.actions}
            role="group"
            aria-label={t("captionProof")}
          >
            {(["clean", "focus"] as const).map((item) => (
              <button
                className={styles.action}
                key={item}
                aria-pressed={style === item}
                onClick={() => setStyle(item)}
              >
                {t(item)}
              </button>
            ))}
          </div>
        </div>
      </div>
      <p className={styles.note}>{t("captionNote")}</p>
    </div>
  );
}

export function VideoFeatureShowcase() {
  const t = useTranslations("VideoHome.showcase");
  const f = useTranslations("VideoHome.features");
  const [selected, setSelected] = useState(1);
  return (
    <section id="video-features" className={styles.section}>
      <div className={styles.inner}>
        <p className={styles.eyebrow}>{f("label")}</p>
        <h2 className={styles.heading}>{t("featuresTitle")}</h2>
        <p className={styles.intro}>{t("featuresIntro")}</p>
        <div className={styles.featureList}>
          <article className={styles.feature}>
            <div className={styles.featureCopy}>
              <span className={styles.meta}>01</span>
              <h3>{t("selectionTitle")}</h3>
              <p>{t("selectionBody")}</p>
            </div>
            <div className={styles.stage}>
              <div className={styles.stageBar}>
                <strong>{t("chooseClip")}</strong>
                <span>WikiLearn / 09:48</span>
              </div>
              <div className={styles.lessonGrid}>
                <div className={styles.candidateList}>
                  {LESSONS.map((clip) => (
                    <button
                      key={clip.id}
                      className={styles.candidate}
                      aria-pressed={selected === clip.id}
                      onClick={() => setSelected(clip.id)}
                    >
                      {clip.title}
                      <span>
                        {clip.time} · {t("excerpt", { seconds: 10 })}
                      </span>
                    </button>
                  ))}
                </div>
                <Media
                  key={selected}
                  id={`lesson-${selected}`}
                  className={styles.lessonVideo}
                  label={LESSONS.find((clip) => clip.id === selected)!.title}
                />
              </div>
              <p className={styles.note}>{t("excerpt", { seconds: 10 })}</p>
            </div>
          </article>
          <article className={styles.feature}>
            <div className={styles.featureCopy}>
              <span className={styles.meta}>02 / 9:16</span>
              <h3>{f("items.3.title")}</h3>
              <p>{f("items.3.body")}</p>
            </div>
            <FramingPreview />
          </article>
          <article className={styles.feature}>
            <div className={styles.featureCopy}>
              <span className={styles.meta}>03</span>
              <h3>{f("items.2.title")}</h3>
              <p>{f("items.2.body")}</p>
            </div>
            <CaptionPreview />
          </article>
          <article className={styles.feature}>
            <div className={styles.featureCopy}>
              <span className={styles.meta}>04</span>
              <h3>{t("trimTitle")}</h3>
              <p>{t("trimBody")}</p>
            </div>
            <TrimPreview />
          </article>
        </div>
        <div className={styles.exportStrip}>
          <article className={styles.exportItem}>
            <div className={styles.brandSample} aria-hidden>
              Aa
              <div className={styles.swatches}>
                <i />
                <i />
                <i />
              </div>
            </div>
            <div>
              <h3>{f("items.4.title")}</h3>
              <p>{f("items.4.body")}</p>
            </div>
          </article>
          <article className={styles.exportItem}>
            <span className={styles.file}>MP4</span>
            <div>
              <h3>{f("items.5.title")}</h3>
              <p>{f("items.5.body")}</p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

export function VideoSimpleWorkflow() {
  const t = useTranslations("VideoHome.showcase");
  return (
    <section
      id="video-how"
      className={`${styles.section} border-y border-line bg-card/55`}
    >
      <div className={styles.inner}>
        <p className={styles.eyebrow}>{t("workflowLabel")}</p>
        <h2 className={styles.heading}>{t("workflowTitle")}</h2>
        <div className={styles.workflow}>
          {(["upload", "refine", "download"] as const).map((step, index) => (
            <article key={step}>
              <span className={styles.meta}>0{index + 1}</span>
              <h3>{t(`${step}Title`)}</h3>
              <p>{t(`${step}Body`)}</p>
              <div className={styles.stepVisual}>
                {step === "upload" ? (
                  <>
                    <CloudUpload size={28} />
                    <span className={styles.stepFile}>Interview.mp4</span>
                  </>
                ) : step === "refine" ? (
                  <>
                    <Scissors size={26} />
                    <div className={styles.miniFrames}>
                      {["interview", "lecture", "robotics"].map((id) => (
                        <span key={id}>
                          <Image
                            src={`${BASE}/${id}.jpg`}
                            alt=""
                            fill
                            sizes="40px"
                          />
                        </span>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <Download size={28} />
                    <span className={styles.stepFile}>MP4 + {t("cover")}</span>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
