"use client";

import { ArrowRight, Pause, Play, Sparkles, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

const SOURCE_VIDEO = "/media/video-proof/original-source.mp4";
const SOURCE_POSTER = "/media/video-proof/original-source.jpg";
const SHORT_VIDEO = "/media/video-proof/scribix-short.mp4";
const SHORT_POSTER = "/media/video-proof/scribix-short.jpg";

export function VideoProofSection() {
  const t = useTranslations("VideoHome.proof");
  const sectionRef = useRef<HTMLElement>(null);
  const sourceRef = useRef<HTMLVideoElement>(null);
  const shortRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [soundOn, setSoundOn] = useState(false);

  useEffect(() => {
    const section = sectionRef.current;
    const source = sourceRef.current;
    const short = shortRef.current;
    if (!section || !source || !short) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !reducedMotion.matches) {
          void Promise.allSettled([source.play(), short.play()]).then(() => {
            setPlaying(!source.paused || !short.paused);
          });
          return;
        }
        source.pause();
        short.pause();
        short.muted = true;
        setPlaying(false);
        setSoundOn(false);
      },
      { threshold: 0.35 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  const togglePlayback = () => {
    const source = sourceRef.current;
    const short = shortRef.current;
    if (!source || !short) return;

    if (playing) {
      source.pause();
      short.pause();
      setPlaying(false);
      return;
    }

    void Promise.allSettled([source.play(), short.play()]).then(() => {
      setPlaying(!source.paused || !short.paused);
    });
  };

  const toggleSound = () => {
    const short = shortRef.current;
    if (!short) return;
    const nextSoundOn = !soundOn;
    short.muted = !nextSoundOn;
    setSoundOn(nextSoundOn);
    if (nextSoundOn && short.paused) {
      void short.play().then(() => setPlaying(true));
    }
  };

  return (
    <section
      ref={sectionRef}
      id="video-proof"
      className="prism-proof-section scroll-mt-20 border-y border-line bg-[#171714] px-4 py-20 text-[#f6f2e9] sm:px-8 sm:py-28"
    >
      <div className="mx-auto max-w-[1180px]">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-end">
          <div>
            <p className="prism-proof-accent mb-5 flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ef8a69]">
              <Sparkles size={13} strokeWidth={1.7} />
              {t("eyebrow")}
            </p>
            <h2 className="max-w-[14ch] font-display text-[38px] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-[54px]">
              {t("title")}
            </h2>
          </div>
          <p className="max-w-[58ch] text-[15px] leading-[1.75] text-white/55 lg:justify-self-end">
            {t("intro")}
          </p>
        </div>

        <div className="prism-proof-shell relative mt-14 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#1c1c19] shadow-[0_36px_90px_-45px_rgba(0,0,0,0.9)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5 sm:px-6">
            <div className="flex items-center gap-2.5">
              <span className="prism-proof-dot size-2 rounded-full bg-[#ef6d48] shadow-[0_0_0_5px_rgba(239,109,72,0.1)]" />
              <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-white/45">
                {t("previewNote")}
              </span>
            </div>
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/30">
              02:03.637 → 02:15.637
            </span>
          </div>

          <div className="grid items-center gap-7 p-5 sm:p-8 lg:grid-cols-[minmax(0,1.35fr)_4.5rem_minmax(15rem,0.65fr)] lg:gap-6 lg:p-10">
            <figure className="min-w-0">
              <div className="mb-3 flex items-end justify-between gap-4">
                <figcaption>
                  <span className="block font-mono text-[9px] uppercase tracking-[0.15em] text-white/35">
                    {t("sourceLabel")}
                  </span>
                  <span className="mt-1 block text-[12px] font-semibold text-white/75">
                    {t("sourceMeta")}
                  </span>
                </figcaption>
                <span className="rounded-full border border-white/10 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-white/35">
                  16:9
                </span>
              </div>
              <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
                <video
                  ref={sourceRef}
                  className="size-full object-cover"
                  src={SOURCE_VIDEO}
                  poster={SOURCE_POSTER}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  aria-label={t("sourceLabel")}
                />
              </div>
            </figure>

            <div className="flex items-center justify-center gap-3 lg:flex-col">
              <span className="prism-proof-transform grid size-11 place-items-center rounded-full border border-[#ef8a69]/30 bg-[#ef8a69]/10 text-[#ef8a69]">
                <ArrowRight size={17} strokeWidth={1.8} className="lg:rotate-0" />
              </span>
              <span className="max-w-[11rem] text-center font-mono text-[8px] uppercase leading-[1.5] tracking-[0.13em] text-white/30 lg:max-w-[7rem]">
                {t("transform")}
              </span>
            </div>

            <figure className="mx-auto w-full max-w-[18rem] min-w-0">
              <div className="mb-3 flex items-end justify-between gap-4">
                <figcaption>
                  <span className="prism-proof-accent block font-mono text-[9px] uppercase tracking-[0.15em] text-[#ef8a69]">
                    {t("outputLabel")}
                  </span>
                  <span className="mt-1 block text-[12px] font-semibold text-white/80">
                    {t("outputMeta")}
                  </span>
                </figcaption>
                <span className="prism-proof-format rounded-full border border-[#ef8a69]/20 bg-[#ef8a69]/10 px-2.5 py-1 font-mono text-[8px] uppercase tracking-[0.12em] text-[#ef8a69]">
                  9:16
                </span>
              </div>
              <div className="aspect-[9/16] overflow-hidden rounded-2xl border border-white/15 bg-black shadow-2xl ring-1 ring-[#ef8a69]/10">
                <video
                  ref={shortRef}
                  className="size-full object-cover"
                  src={SHORT_VIDEO}
                  poster={SHORT_POSTER}
                  muted={!soundOn}
                  loop
                  playsInline
                  preload="metadata"
                  aria-label={t("outputLabel")}
                />
              </div>
            </figure>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-black/15 px-5 py-4 sm:px-6">
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/30">
              Scribix render · 1080 × 1920
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlayback}
                className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-[11px] font-semibold text-white/70 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white"
              >
                {playing ? <Pause size={13} /> : <Play size={13} fill="currentColor" />}
                {playing ? t("pause") : t("play")}
              </button>
              <button
                type="button"
                onClick={toggleSound}
                className="prism-proof-action inline-flex min-h-9 items-center gap-2 rounded-full bg-[#ef8a69] px-4 text-[11px] font-semibold text-[#171714] transition hover:-translate-y-0.5 hover:bg-[#ff9a79]"
              >
                {soundOn ? <VolumeX size={13} /> : <Volume2 size={13} />}
                {soundOn ? t("soundOff") : t("soundOn")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
