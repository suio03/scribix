"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ArrowRight, Check, CloudUpload, Film, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Tier } from "@/lib/plans";
import {
  PartialTranscriptModal,
  ProgressView,
  UploadErrorHelp,
  useUpload,
} from "./Uploader";
import { useLoginModal } from "./LoginModal";

const VIDEO_ACCEPT =
  "video/mp4,video/quicktime,video/webm,video/x-msvideo,video/x-matroska,.mp4,.mov,.webm,.avi,.mkv";
const VIDEO_EXTENSION = /\.(mp4|mov|webm|avi|mkv)$/i;

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
  const trust = t.raw("trust") as string[];
  const previewCandidates = t.raw("previewCandidates") as Array<{
    title: string;
    duration: string;
    score: string;
  }>;
  const busy = phase !== "idle" && phase !== "error";
  const publicHero = !signedIn;

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
      className={`tool-landing-hero relative overflow-hidden px-4 pb-16 pt-12 sm:px-8 sm:pb-20 sm:pt-16 lg:pt-20 ${
        publicHero ? "video-home-public-hero" : ""
      }`}
    >
      <span id="generator" className="absolute left-0 top-0" aria-hidden />
      {publicHero ? (
        <>
          <span className="video-hero-glow video-hero-glow-one" aria-hidden />
          <span className="video-hero-glow video-hero-glow-two" aria-hidden />
          <span className="video-hero-grid" aria-hidden />
        </>
      ) : null}
      <div className="relative mx-auto max-w-[1100px]">
        <div className="text-center rise-in">
          <p className="mb-5 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-accent">
            {t("eyebrow")}
          </p>
          <h1 className="tool-landing-title font-display text-[44px] font-medium leading-[1.02] tracking-[-0.02em] sm:text-[60px] lg:text-[76px]">
            {t.rich("headline", {
              accent: (chunks) => (
                <span className="prism-generated-phrase text-accent">{chunks}</span>
              ),
            })}
          </h1>
          <p className="tool-landing-description mt-6 text-[16px] leading-[1.65] text-muted sm:text-[17px]">
            {t("description")}
          </p>

          {signedIn ? (
            <div className="tool-landing-actions mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <a
                href="#upload"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-[14px] font-medium text-paper transition hover:bg-accent"
              >
                {t("primaryCta")}
                <ArrowRight size={16} strokeWidth={1.8} />
              </a>
            </div>
          ) : null}
        </div>

        <div id="upload" className="tool-landing-upload relative mt-10 scroll-mt-24 rise-in">
          <div className="audio-upload-card relative overflow-hidden rounded-3xl border border-line bg-card shadow-[0_30px_80px_-40px_rgba(14,13,11,0.18)]">
            <div className="grain" />
            <div className="relative">
              <div className="audio-upload-tabs flex items-stretch border-b border-line">
                <div className="audio-upload-tab relative flex flex-1 items-center justify-center gap-2.5 px-4 py-4 text-[14px] text-ink sm:px-6">
                  <CloudUpload size={17} strokeWidth={1.6} />
                  <span className="font-medium">{t("eyebrow")}</span>
                  <span className="hidden font-mono text-[10px] uppercase tracking-[0.15em] text-muted/70 sm:inline">
                    {t("dropMeta")}
                  </span>
                  <span className="absolute inset-x-4 bottom-0 h-0.5 bg-accent sm:inset-x-6" />
                </div>
              </div>

              <div className="audio-upload-panel p-6 sm:p-10">
                <div
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
                  className={`audio-upload-dropzone rounded-2xl border border-dashed bg-paper/40 px-6 py-12 text-center transition sm:py-16 ${
                    dragOver ? "border-accent bg-accent/5" : "border-line"
                  }`}
                >
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
                    <ProgressView
                      phase={phase}
                      progress={progress}
                      filename={filename}
                      processingLimitNoticeMin={processingLimitNoticeMin}
                    />
                  ) : (
                    <>
                      <span className="audio-upload-icon mx-auto inline-grid size-14 place-items-center rounded-xl bg-accent-soft text-accent">
                        <Film size={26} strokeWidth={1.5} />
                      </span>
                      <p className="mt-6 text-[15px] text-ink">{t("dropTitle")}</p>
                      <p className="mt-1.5 font-mono text-[12px] uppercase tracking-[0.15em] text-muted">
                        {t("dropMeta")}
                      </p>
                      <button
                        type="button"
                        onClick={chooseVideo}
                        className="group mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-[14px] font-medium text-paper transition hover:bg-accent"
                      >
                        <CloudUpload
                          size={16}
                          strokeWidth={1.8}
                          className="transition group-hover:-translate-y-0.5"
                        />
                        {t("primaryCta")}
                      </button>
                      {videoOnlyError ? (
                        <p className="mt-4 text-[13px] text-red-600">{t("videoOnly")}</p>
                      ) : null}
                      <UploadErrorHelp
                        error={uploadError}
                        onRetry={retry}
                        onChooseFile={chooseVideo}
                        checkoutSuccessPath={postSignInPath}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {publicHero ? (
          <p className="mt-4 text-center text-[12px] text-muted">{t("ctaNote")}</p>
        ) : null}

        <ul className="tool-proof-row mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[13px]">
          {trust.map((item) => (
            <li
              key={item}
              className="flex items-center gap-2 text-muted"
            >
              <Check size={16} strokeWidth={1.8} className="text-accent" />
              <span className="font-medium">{item}</span>
            </li>
          ))}
        </ul>

        {publicHero ? (
          <div
            className="prism-transformation rise-in"
            aria-label={t("previewLabel")}
          >
            <div className="prism-source-panel">
              <div className="prism-stage-label">
                <span>{t("previewSource")}</span>
                <b>16:9</b>
              </div>
              <div className="prism-source-frame">
                <Image
                  src="/media/video-proof/original-source.jpg"
                  alt=""
                  fill
                  sizes="(max-width: 767px) 100vw, 560px"
                  className="object-cover"
                  aria-hidden
                />
                <span className="prism-source-badge">
                  <i aria-hidden />
                  {t("previewProject")}
                </span>
                <p className="prism-source-caption">
                  {t.rich("previewCaption", {
                    mark: (chunks) => <mark>{chunks}</mark>,
                  })}
                </p>
              </div>
            </div>

            <div className="prism-beam" aria-hidden>
              <span className="prism-beam-line" />
              <span className="prism-beam-core">
                <Sparkles size={20} strokeWidth={1.8} />
              </span>
            </div>

            <div className="prism-candidate-panel">
              <div className="prism-stage-label">
                <span>{t("previewCandidatesLabel")}</span>
                <b>{previewCandidates.length} AI</b>
              </div>
              <div className="prism-candidate-grid">
                {previewCandidates.map((candidate, index) => (
                  <article
                    key={candidate.title}
                    className={`prism-candidate ${index === 0 ? "is-selected" : ""}`}
                  >
                    <Image
                      src="/media/video-proof/scribix-short.jpg"
                      alt=""
                      fill
                      sizes="(max-width: 767px) 30vw, 140px"
                      className="object-cover"
                      style={{ objectPosition: `${48 + index * 4}% center` }}
                      aria-hidden
                    />
                    <span className="prism-candidate-score">{candidate.score}</span>
                    <div className="prism-candidate-copy">
                      <strong>{candidate.title}</strong>
                      <span>
                        <b>{index === 0 ? t("previewSelected") : `0${index + 1}`}</b>
                        <b>{candidate.duration}</b>
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        ) : null}
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
