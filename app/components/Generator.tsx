"use client";

import { useRef, useState } from "react";
import { signIn } from "next-auth/react";
import {
  Upload,
  PlaySquare,
  Mic,
  FileVideo,
  FileAudio,
  Globe,
  Clock,
  Target,
  Users,
  Infinity as InfinityIcon,
  ShieldCheck,
  CloudUpload,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { mergeLocalizedItems } from "@/lib/localized-items";
import type { BillingCycle, Tier } from "@/lib/plans";
import {
  PartialTranscriptModal,
  ProgressView,
  UPLOAD_ACCEPT,
  UploadErrorHelp,
  useUpload,
} from "./Uploader";
import { Recorder } from "./Recorder";
import { YouTubeImporter } from "./YouTubeImporter";
import { markSignInPending } from "./Track";

type TabId = "upload" | "youtube" | "record";
type TabCopy = { label: string; hint: string };
type TrustItemCopy = { label: string };
type GeneratorNamespace = "Generator" | "AiNoteTaker.hero";

const TAB_DEFINITIONS = [
  { id: "upload", icon: Upload },
  { id: "youtube", icon: PlaySquare },
  { id: "record", icon: Mic },
] as const satisfies ReadonlyArray<{ id: TabId; icon: LucideIcon }>;

const TRUST_DEFINITIONS = {
  Generator: [
    { key: "freeMinutes", icon: Target },
    { key: "languageDetection", icon: Globe },
    { key: "audioSize", icon: InfinityIcon },
    { key: "speakerLabels", icon: Users },
    { key: "exports", icon: ShieldCheck },
  ],
  "AiNoteTaker.hero": [
    { key: "sources", icon: Upload },
    { key: "speakerLabels", icon: Users },
    { key: "timestamps", icon: Clock },
    { key: "aiNotes", icon: Sparkles },
  ],
} satisfies Record<
  GeneratorNamespace,
  ReadonlyArray<{ key: string; icon: LucideIcon }>
>;

export function Generator({
  signedIn,
  postSignInPath,
  tier = "free",
  billingCycle = null,
  namespace = "Generator",
  toolSlug = "home",
}: {
  signedIn: boolean;
  postSignInPath: string;
  tier?: Tier;
  billingCycle?: BillingCycle | null;
  namespace?: GeneratorNamespace;
  toolSlug?: string;
}) {
  const t = useTranslations(namespace);
  const generatorT = useTranslations("Generator");
  const [tab, setTab] = useState<TabId>("upload");

  const tabCopy = generatorT.raw("tabs") as TabCopy[];
  const tabs = mergeLocalizedItems(
    tabCopy,
    TAB_DEFINITIONS,
    "Generator.tabs"
  );
  const trustCopy = t.raw("trust") as TrustItemCopy[];
  const trust = mergeLocalizedItems(
    trustCopy,
    TRUST_DEFINITIONS[namespace],
    `${namespace}.trust`
  );

  return (
    <section
      id="generator"
      className="relative scroll-mt-24 px-4 pb-16 pt-12 sm:px-8 sm:pt-16 lg:pt-20"
    >
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-6 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.22em] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-rec rec-dot" />
            {t("issue")}
          </span>
          <span className="h-px flex-1 bg-line" />
          <span>{t("issueLabel")}</span>
        </div>

        <h1 className="font-display text-[44px] font-medium leading-[1.02] tracking-[-0.02em] sm:text-[60px] lg:text-[76px]">
          {t("h1Part1")}
          <br />
          {t.rich("h1Part2", {
            accent: (chunks) => (
              <span className="italic text-accent">{chunks}</span>
            ),
          })}
        </h1>

        <p className="mt-6 max-w-[58ch] text-[16px] leading-[1.65] text-muted sm:text-[17px]">
          {t.rich("description", {
            stat: (chunks) => (
              <span className="font-mono tabular text-ink">{chunks}</span>
            ),
          })}
        </p>

        <ul className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-[13px]">
          {trust.map((item) => {
            const Icon = item.icon;
            return (
              <li
                key={item.key}
                className="flex items-center gap-2 text-ink/85"
              >
                <Icon size={16} strokeWidth={1.7} className="text-accent" />
                <span className="font-medium">{item.label}</span>
              </li>
            );
          })}
        </ul>

        <div className="mt-10 overflow-hidden rounded-3xl border border-line bg-card shadow-[0_30px_80px_-40px_rgba(14,13,11,0.18)]">
          <div className="grain" />
          <div className="relative">
            <div className="flex items-stretch border-b border-line">
              {tabs.map((tabItem) => {
                const Icon = tabItem.icon;
                const active = tab === tabItem.id;
                return (
                  <button
                    key={tabItem.id}
                    type="button"
                    onClick={() => setTab(tabItem.id)}
                    className={`group relative flex flex-1 items-center justify-center gap-2.5 px-4 py-4 text-[14px] transition sm:px-6 ${
                      active ? "text-ink" : "text-muted hover:text-ink"
                    }`}
                  >
                    <Icon size={17} strokeWidth={1.6} />
                    <span className="font-medium">{tabItem.label}</span>
                    <span className="hidden font-mono text-[10px] uppercase tracking-[0.15em] text-muted/70 sm:inline">
                      {tabItem.hint}
                    </span>
                    {active && (
                      <span className="absolute inset-x-4 bottom-0 h-0.5 bg-accent sm:inset-x-6" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-6 sm:p-10">
              {tab === "upload" && (
                <UploadPane
                  signedIn={signedIn}
                  postSignInPath={postSignInPath}
                  checkoutSuccessPath={postSignInPath}
                  tier={tier}
                  toolSlug={toolSlug}
                />
              )}
              {tab === "youtube" && (
                <YouTubeImporter
                  signedIn={signedIn}
                  postSignInPath={postSignInPath}
                  tier={tier}
                  billingCycle={billingCycle}
                  toolSlug={toolSlug}
                  variant="flat"
                />
              )}
              {tab === "record" && (
                <Recorder
                  signedIn={signedIn}
                  postSignInPath={postSignInPath}
                  checkoutSuccessPath={postSignInPath}
                  tier={tier}
                  toolSlug={toolSlug}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function UploadPane({
  signedIn,
  postSignInPath,
  checkoutSuccessPath,
  tier,
  toolSlug,
}: {
  signedIn: boolean;
  postSignInPath: string;
  checkoutSuccessPath: string;
  tier: Tier;
  toolSlug: string;
}) {
  const t = useTranslations("Generator.upload");
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
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
    checkoutSuccessPath,
    tier,
    toolSlug,
  });

  const chooseFile = async () => {
    if (!signedIn) {
      markSignInPending();
      await signIn("google", { redirectTo: postSignInPath });
      return;
    }
    inputRef.current?.click();
  };

  return (
    <div className="rise-in">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!signedIn) {
            markSignInPending();
            void signIn("google", { redirectTo: postSignInPath });
            return;
          }
          const file = e.dataTransfer.files?.[0];
          if (file) onPick(file);
        }}
        className={`rounded-2xl border border-dashed bg-paper/40 px-6 py-12 text-center transition sm:py-16 ${
          dragOver ? "border-accent bg-accent/5" : "border-line"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={UPLOAD_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.currentTarget.value = "";
            if (f) onPick(f);
          }}
        />

        {phase === "idle" || phase === "error" ? (
          <>
            <div className="mx-auto flex w-fit items-center gap-3">
              <span className="inline-grid size-14 place-items-center rounded-xl bg-sage/15 text-sage">
                <FileVideo size={26} strokeWidth={1.5} />
              </span>
              <span className="inline-grid size-14 place-items-center rounded-xl bg-sage/15 text-sage">
                <FileAudio size={26} strokeWidth={1.5} />
              </span>
            </div>
            <p className="mt-6 text-[15px] text-ink">{t("instruction")}</p>
            <p className="mt-1.5 font-mono text-[12px] uppercase tracking-[0.15em] text-muted">
              {t(tier === "free" ? "specsFree" : "specsPaid")}
            </p>
            <button
              type="button"
              onClick={() => void chooseFile()}
              className="group mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-[14px] font-medium text-paper transition hover:bg-accent"
            >
              <CloudUpload
                size={16}
                strokeWidth={1.8}
                className="transition group-hover:-translate-y-0.5"
              />
              {t("button")}
            </button>
            <UploadErrorHelp
              error={uploadError}
              onRetry={retry}
              onChooseFile={() => void chooseFile()}
              checkoutSuccessPath={checkoutSuccessPath}
            />
          </>
        ) : (
          <ProgressView
            phase={phase}
            progress={progress}
            filename={filename}
            processingLimitNoticeMin={processingLimitNoticeMin}
          />
        )}
      </div>
      <PartialTranscriptModal
        offer={partialOffer}
        checkoutSuccessPath={checkoutSuccessPath}
        onConfirm={confirmPartial}
        onCancel={cancelPartial}
        onUpgrade={trackPartialUpgrade}
      />
    </div>
  );
}
