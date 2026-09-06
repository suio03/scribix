import { VideoUploadLink } from "./VideoUploadLink";
import Image from "next/image";
import {
  AudioLines,
  ArrowUpRight,
  CloudUpload,
  Film,
  Mic2,
  Users,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { mergeLocalizedItems } from "@/lib/localized-items";
import { SectionLabel } from "./SectionLabel";
import {
  VideoCaseGallery,
  VideoFeatureShowcase,
  VideoSimpleWorkflow,
  VideoMediaCredits,
} from "./VideoHomeShowcase";

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
      <VideoCaseGallery />
      <VideoFeatureShowcase />
      <VideoSimpleWorkflow />

      <section
        id="video-use-cases"
        className="scroll-mt-20 px-4 pb-20 sm:px-8 sm:pb-28"
      >
        <div className="home-audience-shell mx-auto max-w-[1180px] rounded-[1.75rem] bg-ink px-6 py-10 text-paper sm:px-10 sm:py-14 lg:px-14">
          <SectionLabel number="04" label={t("audiences.label")} />
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <h2 className="max-w-[14ch] font-display text-[38px] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-[52px]">
              {t("audiences.title")}
            </h2>
            <p className="max-w-[58ch] text-[15px] leading-[1.75] text-paper/60 lg:justify-self-end">
              {t("audiences.intro")}
            </p>
          </div>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-paper/10 bg-paper/10 lg:grid-cols-3">
            {audiences.map((audience, index) => {
              const Icon = audience.icon;
              return (
                <article
                  key={audience.key}
                  className="home-audience-card bg-ink p-7 transition hover:bg-paper/[0.035]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <Icon size={21} strokeWidth={1.5} className="text-rec" />
                    <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-paper/35">
                      {audience.label}
                    </span>
                  </div>
                  <div className="relative mt-6 aspect-video overflow-hidden rounded-xl border border-paper/10">
                    <Image
                      src={
                        index === 0
                          ? "/media/home-variety/robotics.jpg"
                          : index === 1
                            ? "/media/home-variety/interview.jpg"
                            : "/media/home-variety/lecture.jpg"
                      }
                      alt=""
                      fill
                      sizes="(max-width: 1023px) 90vw, 340px"
                      className="object-cover"
                      style={
                        index === 2
                          ? { objectPosition: "center 32%" }
                          : undefined
                      }
                    />
                  </div>
                  <h3 className="mt-6 font-display text-[23px] font-semibold tracking-[-0.025em]">
                    {audience.title}
                  </h3>
                  <p className="mt-3 text-[14px] leading-[1.7] text-paper/55">
                    {audience.body}
                  </p>
                  <a
                    href="#video-cases"
                    className="mt-6 inline-flex min-h-11 items-center gap-2 text-[13px] font-semibold underline underline-offset-4"
                  >
                    {t("showcase.exploreCases")}
                    <ArrowUpRight size={15} />
                  </a>
                </article>
              );
            })}
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
        <div className="home-video-final relative mx-auto max-w-[1180px] overflow-hidden rounded-[1.75rem] border border-line bg-card px-6 py-14 sm:px-12 sm:py-20">
          <div className="home-final-ring" aria-hidden />
          <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1fr)_200px] lg:items-center">
            <div className="max-w-[760px]">
              <p className="mb-5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
                {t("final.kicker")}
              </p>
              <h2 className="font-display text-[42px] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[62px]">
                {t("final.title")}
              </h2>
              <p className="mt-6 max-w-[52ch] text-[16px] leading-[1.75] text-muted">
                {t("final.body")}
              </p>
              <VideoUploadLink
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-[14px] font-semibold text-paper transition hover:-translate-y-0.5 hover:bg-accent"
              >
                {t("final.cta")}
                <CloudUpload size={16} strokeWidth={1.8} />
              </VideoUploadLink>
            </div>
            <div
              className="relative mx-auto hidden h-[330px] w-[200px] lg:block"
              aria-hidden
            >
              <Image
                src="/media/home-variety/robotics-portrait.jpg"
                alt=""
                width={160}
                height={284}
                className="absolute right-0 top-0 rotate-[8deg] rounded-2xl border border-line shadow-xl"
              />
              <Image
                src="/media/home-variety/captions.jpg"
                alt=""
                width={160}
                height={284}
                className="absolute bottom-0 left-0 rotate-[-6deg] rounded-2xl border border-line shadow-xl"
              />
            </div>
          </div>
        </div>
      </section>
      <VideoMediaCredits />
    </>
  );
}
