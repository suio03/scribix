"use client";

import { useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUpRight,
  Captions,
  Check,
  CloudUpload,
  Download,
  Play,
  Scissors,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { Tier } from "@/lib/plans";
import {
  PartialTranscriptModal,
  ProgressView,
  UploadErrorHelp,
  useUpload,
} from "./Uploader";
import { useLoginModal } from "./LoginModal";

const VIDEO_ACCEPT = "video/mp4,video/quicktime,video/webm,video/x-msvideo,video/x-matroska,.mp4,.mov,.webm,.avi,.mkv";
const VIDEO_EXTENSION = /\.(mp4|mov|webm|avi|mkv)$/i;

type PreviewCandidate = {
  title: string;
  duration: string;
  score: string;
};

export function VideoHomeHero({
  signedIn,
  postSignInPath,
  tier,
}: {
  signedIn: boolean;
  postSignInPath: string;
  tier: Tier;
}) {
  const t = useTranslations("VideoHome.hero");
  const { openLogin } = useLoginModal();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [videoOnlyError, setVideoOnlyError] = useState(false);
  const {
    phase,
    progress,
    uploadError,
    filename,
    onPick,
    retry,
    processingLimitNoticeMin,
    partialOffer,
    confirmPartial,
    cancelPartial,
    trackPartialUpgrade,
  } = useUpload({
    signedIn,
    postSignInPath,
    checkoutSuccessPath: postSignInPath,
    tier,
    toolSlug: "home",
  });
  const candidates = t.raw("previewCandidates") as PreviewCandidate[];
  const trust = t.raw("trust") as string[];
  const busy = phase !== "idle" && phase !== "error";

  const chooseVideo = () => {
    if (!signedIn) {
      openLogin(postSignInPath);
      return;
    }
    inputRef.current?.click();
  };
  const acceptVideo = (file: File) => {
    if (!signedIn) {
      openLogin(postSignInPath);
      return;
    }
    if (!file.type.startsWith("video/") && !VIDEO_EXTENSION.test(file.name)) {
      setVideoOnlyError(true);
      return;
    }
    setVideoOnlyError(false);
    onPick(file);
  };

  return (
    <section
      id="video-upload"
      className="home-video-hero relative scroll-mt-20 overflow-hidden px-4 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20"
    >
      <span id="generator" className="absolute left-0 top-0" aria-hidden />
      <div className="home-hero-orbit home-hero-orbit-one" aria-hidden />
      <div className="home-hero-orbit home-hero-orbit-two" aria-hidden />
      <div className="relative mx-auto max-w-[1180px]">
        <div className="grid items-center gap-12 xl:grid-cols-[minmax(0,0.88fr)_minmax(34rem,1.12fr)] xl:gap-14">
          <div className="rise-in">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-line bg-card/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.13em] text-muted shadow-sm backdrop-blur">
              <Sparkles size={13} strokeWidth={1.8} className="text-accent" />
              {t("eyebrow")}
            </div>

            <h1 className="max-w-[12ch] font-display text-[48px] font-semibold leading-[0.98] tracking-[-0.055em] sm:text-[66px] lg:text-[76px]">
              {t.rich("headline", {
                accent: (chunks) => <span className="home-hero-accent">{chunks}</span>,
              })}
            </h1>

            <p className="mt-7 max-w-[54ch] text-[16px] leading-[1.75] text-muted sm:text-[18px]">
              {t("description")}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={chooseVideo}
                className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-6 py-3 text-[14px] font-semibold text-paper shadow-[0_14px_34px_-18px_rgba(25,25,24,0.75)] transition hover:-translate-y-0.5 hover:bg-accent"
              >
                <CloudUpload size={17} strokeWidth={1.8} />
                {t("primaryCta")}
                <ArrowUpRight
                  size={15}
                  strokeWidth={2}
                  className="transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                />
              </button>
              <a
                href="#video-how"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-line bg-card/70 px-6 py-3 text-[14px] font-semibold text-ink transition hover:border-ink/25 hover:bg-card"
              >
                {t("secondaryCta")}
                <ArrowDown size={15} strokeWidth={1.8} />
              </a>
            </div>

            <p className="mt-4 text-[12.5px] text-muted">{t("ctaNote")}</p>

            <ul className="mt-8 grid gap-3 text-[13px] text-ink/75 sm:grid-cols-2">
              {trust.map((item) => (
                <li key={item} className="flex items-center gap-2.5">
                  <span className="inline-grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                    <Check size={12} strokeWidth={2.2} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div
            className={`home-product-window rise-in relative overflow-hidden rounded-[1.6rem] border bg-[#171714] text-[#f6f2e9] shadow-[0_44px_100px_-50px_rgba(16,15,12,0.8)] transition ${
              dragOver ? "border-accent" : "border-white/10"
            }`}
            style={{ animationDelay: "120ms" }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(false);
              const file = event.dataTransfer.files?.[0];
              if (file) acceptVideo(file);
            }}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#e76442]" />
                <span className="size-2 rounded-full bg-[#d7a94d]" />
                <span className="size-2 rounded-full bg-[#739a72]" />
              </div>
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
                {t("previewLabel")}
              </span>
              <span className="text-[10px] text-white/35">1080 × 1920</span>
            </div>

            <div className="grid min-h-[430px] grid-cols-1 sm:min-h-[500px] sm:grid-cols-[minmax(0,0.86fr)_minmax(13rem,1.14fr)]">
              <div className="home-preview-stage relative grid place-items-center overflow-hidden border-r border-white/10 p-5 sm:p-7">
                <div className="home-preview-frame relative aspect-[9/16] h-[310px] max-h-[76vw] overflow-hidden rounded-xl border border-white/15 bg-[#33352f] shadow-2xl sm:h-[390px]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_65%_20%,rgba(239,154,109,0.32),transparent_33%),linear-gradient(155deg,#4a5147_0%,#252722_55%,#161713_100%)]" />
                  <div className="absolute left-1/2 top-[24%] size-20 -translate-x-1/2 rounded-full bg-[#b58061] shadow-[0_0_0_18px_rgba(245,220,196,0.05)]" />
                  <div className="absolute bottom-0 left-1/2 h-[48%] w-[92%] -translate-x-1/2 rounded-t-[50%] bg-[#20251f]" />
                  <div className="absolute inset-x-3 bottom-[18%] text-center text-[13px] font-extrabold uppercase leading-[1.18] tracking-[-0.02em] text-white sm:text-[16px]">
                    {t.rich("previewCaption", {
                      mark: (chunks) => <span className="text-[#ffcc4a]">{chunks}</span>,
                    })}
                  </div>
                  <span
                    aria-hidden
                    className="absolute left-1/2 top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur"
                  >
                    <Play size={16} fill="currentColor" />
                  </span>
                </div>
                <div className="absolute bottom-4 left-5 right-5 flex items-center justify-between text-[9px] uppercase tracking-[0.12em] text-white/35 sm:left-7 sm:right-7">
                  <span>{t("previewFormat")}</span>
                  <span>{t("previewLength")}</span>
                </div>
              </div>

              <div className="flex min-w-0 flex-col bg-[#1c1c19]">
                <div className="border-b border-white/10 px-4 py-4 sm:px-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold text-white/90">
                        {t("previewProject")}
                      </p>
                      <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-white/35">
                        {t("previewSource")}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ca603f]/15 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#ef8a69]">
                      <Sparkles size={10} /> AI
                    </span>
                  </div>
                </div>

                <div className="flex-1 space-y-2.5 p-3 sm:p-4">
                  <p className="px-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/35">
                    {t("previewCandidatesLabel")}
                  </p>
                  {candidates.map((candidate, index) => (
                    <div
                      key={candidate.title}
                      className={`rounded-xl border p-3 ${
                        index === 0
                          ? "border-[#d96a48]/55 bg-[#d96a48]/10"
                          : "border-white/[0.08] bg-white/[0.025]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-[10px] font-medium leading-[1.4] text-white/75 sm:text-[11px]">
                          {candidate.title}
                        </p>
                        <span className="shrink-0 text-[9px] font-semibold text-[#ef8a69]">
                          {candidate.score}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[8px] uppercase tracking-[0.1em] text-white/30">
                        <span>{candidate.duration}</span>
                        <span>{index === 0 ? t("previewSelected") : ""}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/10 p-3 sm:p-4">
                  <div className="mb-3 flex items-center gap-3 text-[9px] uppercase tracking-[0.1em] text-white/40">
                    <span className="flex items-center gap-1.5 text-white/75">
                      <Scissors size={11} /> {t("previewEdit")}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Captions size={11} /> {t("previewCaptions")}
                    </span>
                    <span className="ml-auto flex items-center gap-1.5 text-[#ef8a69]">
                      <Download size={11} /> {t("previewExport")}
                    </span>
                  </div>
                  <div className="flex h-7 gap-1 rounded-md bg-white/[0.04] p-1">
                    <span className="w-[42%] rounded-sm bg-[#d96a48]/65" />
                    <span className="w-[28%] rounded-sm bg-[#d6a74e]/55" />
                    <span className="flex-1 rounded-sm bg-[#769477]/55" />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 bg-black/20 p-3 sm:p-4">
              <input
                ref={inputRef}
                type="file"
                accept={VIDEO_ACCEPT}
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = "";
                  if (file) acceptVideo(file);
                }}
              />
              {busy ? (
                <div className="rounded-xl bg-white/[0.04] px-4 py-2 text-white">
                  <ProgressView
                    phase={phase}
                    progress={progress}
                    filename={filename}
                    processingLimitNoticeMin={processingLimitNoticeMin}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={chooseVideo}
                  className="group flex w-full items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.045] px-4 py-3 text-left transition hover:border-[#df7655]/60 hover:bg-white/[0.07]"
                >
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[#d96a48]/15 text-[#ef8a69]">
                      <CloudUpload size={16} strokeWidth={1.8} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-semibold text-white/85">
                        {t("dropTitle")}
                      </span>
                      <span className="mt-0.5 block truncate text-[9px] text-white/35">
                        {t("dropMeta")}
                      </span>
                    </span>
                  </span>
                  <ArrowUpRight
                    size={15}
                    className="shrink-0 text-white/35 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#ef8a69]"
                  />
                </button>
              )}
              {videoOnlyError ? (
                <p className="mt-2 px-2 text-[11px] text-[#ef8a69]">{t("videoOnly")}</p>
              ) : null}
              <div className="text-white">
                <UploadErrorHelp
                  error={uploadError}
                  onRetry={retry}
                  onChooseFile={chooseVideo}
                  checkoutSuccessPath={postSignInPath}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <PartialTranscriptModal
        offer={partialOffer}
        checkoutSuccessPath={postSignInPath}
        onConfirm={confirmPartial}
        onCancel={cancelPartial}
        onUpgrade={trackPartialUpgrade}
      />
    </section>
  );
}
