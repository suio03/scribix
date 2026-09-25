import { getTranslations } from "next-intl/server";
import { HomeLoopVideo } from "./HomeLoopVideo";
import styles from "./VideoHomeShowcase.module.css";

type ClipCategory =
  | "podcast"
  | "streaming"
  | "business"
  | "education"
  | "keynote"
  | "cooking"
  | "storytelling"
  | "travel"
  | "tech"
  | "beauty";

type ShowcaseClip = {
  id: string;
  category: ClipCategory;
  /** Sample caption shown in the clip; English because the captions are English. */
  hook: string;
};

const BASE = "/media/home-loops";

// Illustrative 540×960 loops built from licensed Pexels stock footage with
// sample captions. See docs/homepage-media.md for sources.
const CLIPS: readonly ShowcaseClip[] = [
  { id: "wall-01", category: "podcast", hook: "Nobody tells you the first year is the hardest." },
  { id: "wall-02", category: "streaming", hook: "Three settings every streamer misses." },
  { id: "wall-03", category: "business", hook: "If the budget can't grow, the scope has to shrink." },
  { id: "wall-04", category: "education", hook: "These countries are losing farmland." },
  { id: "wall-05", category: "keynote", hook: "Most teams don't have a data problem." },
  { id: "wall-06", category: "cooking", hook: "The 3-ingredient rule." },
  { id: "wall-07", category: "storytelling", hook: "We met at a dance in nineteen sixty-two." },
  { id: "wall-08", category: "travel", hook: "Skip the tour boats. Take the ferry instead." },
  { id: "wall-09", category: "tech", hook: "This tablet app replaced my laptop." },
  { id: "wall-10", category: "beauty", hook: "Blend it upward, never side to side." },
];

export async function VideoHomeClipWall() {
  const t = await getTranslations("VideoHome.clipWall");

  return (
    <section id="video-clips" className={styles.clipWallSection}>
      <div className={styles.inner}>
        <div className={styles.sectionIntro}>
          <p className={styles.eyebrow}>{t("eyebrow")}</p>
          <h2 className={styles.heading}>{t("title")}</h2>
          <p className={styles.intro}>{t("intro")}</p>
        </div>
      </div>
      {/* Two identical sets scroll by exactly one set width for a seamless loop. */}
      <div className={styles.clipMarquee}>
        <div className={styles.clipTrack}>
          {[false, true].map((duplicate) => (
            <div
              key={String(duplicate)}
              className={styles.clipSet}
              aria-hidden={duplicate || undefined}
            >
              {CLIPS.map((clip) => (
                <div key={clip.id} className={styles.clipFrame}>
                  <HomeLoopVideo
                    src={`${BASE}/${clip.id}.mp4`}
                    poster={`${BASE}/${clip.id}.jpg`}
                    label={duplicate ? undefined : clip.hook}
                  />
                  <span className={styles.clipCategory}>
                    {t(`categories.${clip.category}`)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className={styles.inner}>
        <p className={styles.note}>{t("note")}</p>
      </div>
    </section>
  );
}
