"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AaiSegment } from "@/lib/aai";
import type { SpeakerNames } from "@/lib/speaker-names";
import { ExportPanel } from "./ExportPanel";
import { TranscriptViewer } from "./TranscriptViewer";
import { speakerToneFor } from "./speakerDisplay";
import type { PartialTranscriptInfo } from "@/lib/partial-transcript";

type Props = {
  id: string;
  audioUrl: string | null;
  mediaMime: string | null;
  audioAvailable: boolean;
  utterances: AaiSegment[];
  paragraphs: AaiSegment[];
  sentences: AaiSegment[];
  fallbackText: string;
  sourceLanguage: string | null;
  youtubeUrl: string | null;
  youtubeVideoId: string | null;
  initialSpeakerNames: SpeakerNames;
  isPaid: boolean;
  isPro: boolean;
  checkoutSuccessPath: string;
  partialTranscript: PartialTranscriptInfo | null;
};

export function TranscriptWorkspace({
  id,
  audioUrl,
  mediaMime,
  audioAvailable,
  utterances,
  paragraphs,
  sentences,
  fallbackText,
  sourceLanguage,
  youtubeUrl,
  youtubeVideoId,
  initialSpeakerNames,
  isPaid,
  isPro,
  checkoutSuccessPath,
  partialTranscript,
}: Props) {
  const [exportOpen, setExportOpen] = useState(false);
  const [speakerNames, setSpeakerNames] = useState<SpeakerNames>(initialSpeakerNames);
  const [speakerModal, setSpeakerModal] = useState<{
    open: boolean;
    focusSpeaker?: string;
  }>({ open: false });
  const speakers = useMemo(
    () => uniqueSpeakers([...utterances, ...paragraphs, ...sentences]),
    [utterances, paragraphs, sentences]
  );

  return (
    <div className="transcript-workspace mt-8">
      <TranscriptViewer
        id={id}
        audioUrl={audioUrl}
        mediaMime={mediaMime}
        utterances={utterances}
        paragraphs={paragraphs}
        sentences={sentences}
        fallbackText={fallbackText}
        sourceLanguage={sourceLanguage}
        youtubeUrl={youtubeUrl}
        youtubeVideoId={youtubeVideoId}
        speakerNames={speakerNames}
        speakers={speakers}
        isPaid={isPaid}
        isPro={isPro}
        checkoutSuccessPath={checkoutSuccessPath}
        partialTranscript={partialTranscript}
        onOpenExport={() => setExportOpen(true)}
        onOpenSpeakerEditor={(speaker) => setSpeakerModal({ open: true, focusSpeaker: speaker })}
      />

      <ExportModal
        id={id}
        audioAvailable={audioAvailable}
        open={exportOpen}
        partialTranscript={partialTranscript}
        onClose={() => setExportOpen(false)}
      />

      <SpeakerNamesModal
        id={id}
        open={speakerModal.open}
        focusSpeaker={speakerModal.focusSpeaker}
        speakers={speakers}
        speakerNames={speakerNames}
        onClose={() => setSpeakerModal({ open: false })}
        onSave={setSpeakerNames}
      />
    </div>
  );
}

function ExportModal({
  id,
  audioAvailable,
  open,
  partialTranscript,
  onClose,
}: {
  id: string;
  audioAvailable: boolean;
  open: boolean;
  partialTranscript: PartialTranscriptInfo | null;
  onClose: () => void;
}) {
  const t = useTranslations("Dashboard.exportPanel");
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
      className="surface-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-ink/35 px-4 py-4 backdrop-blur-sm sm:py-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="surface-modal flex max-h-[calc(100dvh-2rem)] w-full max-w-[600px] flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_30px_80px_-35px_rgba(14,13,11,0.45)] sm:max-h-[min(760px,90dvh)]">
        <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
              {t("tabExport")}
            </p>
            <h2 id="export-modal-title" className="mt-1 text-[18px] font-semibold text-ink">
              {t("downloadTitle")}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t("closeExport")}
            className="inline-grid size-9 place-items-center rounded-lg text-ink/55 transition hover:bg-ink/5 hover:text-ink"
          >
            <X size={17} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          <ExportPanel
            id={id}
            audioAvailable={audioAvailable}
            partialTranscript={partialTranscript}
            embedded
          />
        </div>
      </div>
    </div>
  );
}

function SpeakerNamesModal({
  id,
  open,
  focusSpeaker,
  speakers,
  speakerNames,
  onClose,
  onSave,
}: {
  id: string;
  open: boolean;
  focusSpeaker?: string;
  speakers: string[];
  speakerNames: SpeakerNames;
  onClose: () => void;
  onSave: (speakerNames: SpeakerNames) => void;
}) {
  const t = useTranslations("Dashboard.viewer");
  const [draft, setDraft] = useState<SpeakerNames>(speakerNames);
  const [saveState, setSaveState] = useState<"idle" | "busy" | "ok" | "err">("idle");
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const dirty = stableStringify(draft) !== stableStringify(speakerNames);

  useEffect(() => {
    if (!open) return;
    setDraft(speakerNames);
    setSaveState("idle");
    window.setTimeout(() => {
      const target = focusSpeaker ?? speakers[0];
      inputRefs.current[target]?.focus();
      inputRefs.current[target]?.select();
    }, 0);
  }, [focusSpeaker, open, speakerNames, speakers]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  if (!open) return null;

  const save = async () => {
    if (saveState === "busy") return;
    setSaveState("busy");
    try {
      const res = await fetch(`/api/transcripts/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ speakerNames: draft }),
      });
      if (!res.ok) throw new Error(`speaker_save_failed_${res.status}`);
      const json = (await res.json()) as { speakerNames?: SpeakerNames };
      onSave(json.speakerNames ?? draft);
      setSaveState("ok");
      window.setTimeout(() => {
        setSaveState("idle");
        onClose();
      }, 500);
    } catch {
      setSaveState("err");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="speaker-modal-title"
      className="surface-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-ink/35 px-4 py-4 backdrop-blur-sm sm:py-8"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="surface-modal flex max-h-[calc(100vh-2rem)] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl border border-line bg-paper shadow-[0_30px_80px_-35px_rgba(14,13,11,0.45)] sm:max-h-[min(720px,90vh)]">
        <div className="shrink-0 flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 id="speaker-modal-title" className="text-[17px] font-semibold text-ink">
              {t("editSpeakersTitle")}
            </h2>
            <p className="mt-0.5 text-[13px] text-ink/55">
              {t("editSpeakersDescription")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("closeSpeakers")}
            className="inline-grid size-9 place-items-center rounded-lg text-ink/55 transition hover:bg-ink/5 hover:text-ink"
          >
            <X size={17} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {speakers.map((speaker) => (
            <label key={speaker} className="grid gap-1.5">
              <span
                className={`w-fit rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-[0.04em] ${speakerToneFor(
                  speaker
                )}`}
              >
                {t("speakerLabel", { speaker })}
              </span>
              <input
                ref={(node) => {
                  inputRefs.current[speaker] = node;
                }}
                type="text"
                value={draft[speaker] ?? ""}
                placeholder={t("speakerNamePlaceholder", { speaker })}
                maxLength={80}
                onChange={(event) =>
                  setDraft(updateSpeakerName(draft, speaker, event.target.value))
                }
                onKeyDown={(event) => {
                  if (event.key !== "Enter" || !dirty || saveState === "busy") return;
                  event.preventDefault();
                  save();
                }}
                className="w-full rounded-xl border border-line bg-card px-3 py-2.5 text-[14px] text-ink outline-none transition placeholder:text-ink/35 focus:border-accent/60 focus:ring-2 focus:ring-accent/10"
              />
            </label>
          ))}
        </div>

        <div className="shrink-0 flex items-center justify-end gap-2 border-t border-line bg-paper px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line px-4 py-2 text-[13px] font-medium text-ink/70 transition hover:bg-ink/5 hover:text-ink"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saveState === "busy"}
            className="rounded-xl bg-accent px-4 py-2 text-[13px] font-medium text-paper transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-55"
          >
            {saveState === "busy"
              ? t("savingSpeakerNames")
              : saveState === "ok"
                ? t("savedSpeakerNames")
                : saveState === "err"
                  ? t("saveSpeakerNamesFailed")
                  : t("saveSpeakerNames")}
          </button>
        </div>
      </div>
    </div>
  );
}

function updateSpeakerName(
  speakerNames: SpeakerNames,
  speaker: string,
  value: string
): SpeakerNames {
  const next = { ...speakerNames };
  const name = value.trimStart().replace(/\s+/g, " ").slice(0, 80);
  if (name) next[speaker] = name;
  else delete next[speaker];
  return next;
}

function stableStringify(value: SpeakerNames): string {
  return JSON.stringify(
    Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))
  );
}

function uniqueSpeakers(segments: AaiSegment[]): string[] {
  const seen = new Set<string>();
  for (const segment of segments) {
    const speaker = segment.speaker?.trim();
    if (speaker) seen.add(speaker);
  }
  return [...seen].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
