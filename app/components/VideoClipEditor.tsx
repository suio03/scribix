"use client";

import {
  CircleAlert,
  Loader2,
  Pause,
  Play,
  Scissors,
  SkipBack,
  SkipForward,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { ManualFramingEditor } from "@/app/components/ManualFramingEditor";
import { framingAt } from "@/lib/video-workspace/auto-framing";
import { VideoStyleControls } from "@/app/components/VideoStyleControls";
import { FinalRenderPanel } from "@/app/components/FinalRenderPanel";
import { trackVideoWorkspaceEvent } from "@/app/components/video-event-client";
import type { EditorWorkspace } from "@/lib/video-workspace/editor";
import {
  FINAL_VIDEO_PRESET,
  VIDEO_WORKSPACE_LIMITS,
  type CropSpec,
  type Edl,
  type EdlSegment,
  type RenderSpec,
} from "@/lib/video-workspace/contracts";
import {
  VIDEO_LOGO_BOTTOM_PX,
  VIDEO_LOGO_SIDE_PX,
  VIDEO_LOGO_TOP_PX,
  VIDEO_SIGNATURE_HEIGHT_PX,
  activeCaptionWordIndex,
  browserCropStyle,
  captionVisualStyle,
  coverCropBox,
  logoWidthPx,
  wrapCaptionWordIndexes,
} from "@/lib/video-workspace/presentation";
import {
  buildTimelineSegments,
  nextWordEnd,
  nextWordStart,
  previousWordEnd,
  previousWordStart,
  sourceRangeInsideProxy,
  timelineDurationMs,
  timelineSegmentAt,
  type TimelineSegment,
  type TranscriptWordBoundary,
} from "@/lib/video-workspace/timeline";

const ORIGINAL_AUDIO_SETTINGS: RenderSpec["audio"] = {
  gainDb: 0,
  normalize: false,
  fadeInMs: 0,
  fadeOutMs: 0,
};

export type VideoEditorSaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

export function VideoClipEditor({
  projectId,
  candidateId,
  onSaveStateChange,
  onTitleChange,
}: {
  projectId: string;
  candidateId: string;
  onSaveStateChange?: (state: VideoEditorSaveState) => void;
  onTitleChange?: (title: string) => void;
}) {
  const t = useTranslations("Dashboard.videoCandidates.editor");
  const [panel, setPanel] = useState<"framing" | "captions" | "cover" | "content">("framing");
  const [controlsHost, setControlsHost] = useState<HTMLDivElement | null>(null);
  const [workspace, setWorkspace] = useState<EditorWorkspace | null>(null);
  const [edl, setEdl] = useState<Edl | null>(null);
  const [renderSpec, setRenderSpec] = useState<RenderSpec | null>(null);
  const [revision, setRevision] = useState(0);
  const [saveState, setSaveState] = useState<VideoEditorSaveState>("saved");
  const [loadError, setLoadError] = useState(false);
  const [framingDraftActive, setFramingDraftActive] = useState(false);
  const [proxyRefreshError, setProxyRefreshError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [proxyRefreshIds, setProxyRefreshIds] = useState<string[]>([]);
  const [clipTitle, setClipTitle] = useState("");
  const [titleSaveState, setTitleSaveState] = useState<"idle" | "saving" | "error">("idle");
  const lastSavedRef = useRef("");
  const proxyRequestRef = useRef(new Map<string, string>());
  const eventSessionRef = useRef<string | null>(null);
  const editorStartedAtRef = useRef(0);

  useEffect(() => {
    onSaveStateChange?.(saveState);
  }, [onSaveStateChange, saveState]);

  useEffect(() => {
    const sessionId = crypto.randomUUID();
    eventSessionRef.current = sessionId;
    editorStartedAtRef.current = Date.now();
    trackVideoWorkspaceEvent(projectId, {
      eventName: "editor_opened",
      eventKey: `editor-opened:${sessionId}`,
      candidateId,
      properties: {},
    });
  }, [candidateId, projectId]);

  useEffect(() => {
    let active = true;
    setLoadError(false);
    setWorkspace(null);
    setProxyRefreshIds([]);
    fetch(`/api/video-projects/${projectId}/editor?candidateId=${encodeURIComponent(candidateId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("editor_load_failed");
        return response.json() as Promise<EditorWorkspace>;
      })
      .then((next) => {
        if (!active) return;
        const displayClipTitle = next.clipTitle === "manual_source"
          ? t("customClipTitle")
          : next.clipTitle;
        const savedSignature = draftSignature(next.edl, next.renderSpec);
        const nextRenderSpec = {
          ...next.renderSpec,
          audio: ORIGINAL_AUDIO_SETTINGS,
        };
        const nextSignature = draftSignature(next.edl, nextRenderSpec);
        lastSavedRef.current = next.restoredDraft ? savedSignature : "";
        setWorkspace({ ...next, clipTitle: displayClipTitle });
        setClipTitle(displayClipTitle);
        setEdl(next.edl);
        setRenderSpec(nextRenderSpec);
        setRevision(next.revision);
        setSaveState(next.restoredDraft && savedSignature === nextSignature ? "saved" : "dirty");
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [candidateId, projectId, reloadKey, t]);

  const signature = useMemo(
    () => edl && renderSpec ? draftSignature(edl, renderSpec) : "",
    [edl, renderSpec]
  );

  useEffect(() => {
    if (!edl || !renderSpec || !signature) return;
    if (signature === lastSavedRef.current) {
      if (saveState === "dirty") setSaveState("saved");
      return;
    }
    if (saveState === "saving" || saveState === "error" || saveState === "conflict") return;
    setSaveState("dirty");
    const timer = window.setTimeout(async () => {
      setSaveState("saving");
      try {
        const response = await fetch(`/api/video-projects/${projectId}/editor`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            candidateId,
            expectedRevision: revision,
            edl,
            renderSpec,
          }),
        });
        const payload = await response.json() as { revision?: number; error?: string };
        if (response.status === 409) {
          setSaveState("conflict");
          return;
        }
        if (!response.ok || !Number.isInteger(payload.revision)) {
          setSaveState("error");
          return;
        }
        lastSavedRef.current = signature;
        const savedRevision = payload.revision as number;
        setRevision(savedRevision);
        setSaveState("saved");
        if (eventSessionRef.current) {
          trackVideoWorkspaceEvent(projectId, {
            eventName: "edit_saved",
            eventKey: `edit-saved:${eventSessionRef.current}:${savedRevision}`,
            candidateId,
            properties: {
              elapsedMs: Math.min(6 * 60 * 60 * 1000, Date.now() - editorStartedAtRef.current),
              revision: savedRevision,
              segmentCount: edl.segments.length,
            },
          });
        }
      } catch {
        setSaveState("error");
      }
    }, 900);
    return () => window.clearTimeout(timer);
  }, [candidateId, edl, projectId, renderSpec, revision, saveState, signature]);

  useEffect(() => {
    if (!workspace || !edl || saveState !== "saved") return;
    const uncovered = edl.segments.filter((segment) => {
      const proxy = workspace.proxies.find((item) => item.segmentId === segment.id);
      return !proxy || !sourceRangeInsideProxy(
        proxy,
        segment.sourceStartMs,
        segment.sourceEndMs
      );
    });
    if (uncovered.length === 0) return;
    const timer = window.setTimeout(() => {
      for (const segment of uncovered) {
        const proxy = workspace.proxies.find((item) => item.segmentId === segment.id);
        const segmentIndex = proxy?.segmentIndex ?? segmentIndexFromId(segment.id);
        if (segmentIndex === null) continue;
        const requestKey = `${segment.sourceStartMs}:${segment.sourceEndMs}`;
        if (proxyRequestRef.current.get(segment.id) === requestKey) continue;
        proxyRequestRef.current.set(segment.id, requestKey);
        setProxyRefreshIds((current) => [...new Set([...current, segment.id])]);
        void fetch(
          `/api/video-projects/${projectId}/candidates/${candidateId}/previews`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              segmentIndex,
              sourceStartMs: segment.sourceStartMs,
              sourceEndMs: segment.sourceEndMs,
            }),
          }
        );
      }
    }, 1_200);
    return () => window.clearTimeout(timer);
  }, [candidateId, edl, projectId, saveState, workspace]);

  useEffect(() => {
    if (proxyRefreshIds.length === 0 || !edl) return;
    let active = true;
    const poll = window.setInterval(async () => {
      try {
        const response = await fetch(
          `/api/video-projects/${projectId}/editor?candidateId=${encodeURIComponent(candidateId)}`
        );
        if (!response.ok) return;
        const next = await response.json() as EditorWorkspace;
        if (!active) return;
        if (next.previewStatus === "failed") {
          setProxyRefreshError(true);
          setProxyRefreshIds([]);
          return;
        }
        if (next.previewStatus !== "ready") return;
        const refreshed = proxyRefreshIds.every((segmentId) => {
          const segment = edl.segments.find((item) => item.id === segmentId);
          const proxy = next.proxies.find((item) => item.segmentId === segmentId);
          return segment && proxy && sourceRangeInsideProxy(
            proxy,
            segment.sourceStartMs,
            segment.sourceEndMs
          );
        });
        if (!active || !refreshed) return;
        setWorkspace((current) => current ? {
          ...current,
          previewStatus: next.previewStatus,
          proxies: next.proxies,
          words: next.words,
        } : current);
        setProxyRefreshIds([]);
      } catch {
        // The queued rebuild remains authoritative; polling is best effort.
      }
    }, 4_000);
    return () => {
      active = false;
      window.clearInterval(poll);
    };
  }, [candidateId, edl, projectId, proxyRefreshIds]);

  const updateEdl = useCallback((updater: (current: Edl) => Edl) => {
    setEdl((current) => current ? updater(current) : current);
    setSaveState((current) => current === "conflict" ? current : "dirty");
  }, []);

  const updateRenderSpec = useCallback((next: RenderSpec) => {
    setRenderSpec(next);
    setSaveState((current) => current === "conflict" ? current : "dirty");
  }, []);

  useEffect(() => {
    if (!edl || !workspace) return;
    setRenderSpec((current) => {
      if (!current) return current;
      const segments = new Map(edl.segments.map((segment) => [segment.id, segment]));
      const cues = current.captions.cues.flatMap((cue) => {
        const segment = segments.get(cue.segmentId);
        if (!segment) return [];
        const words = cue.words.flatMap((word) => {
          const sourceStartMs = Math.max(word.sourceStartMs, segment.sourceStartMs);
          const sourceEndMs = Math.min(word.sourceEndMs, segment.sourceEndMs);
          return sourceEndMs > sourceStartMs ? [{ ...word, sourceStartMs, sourceEndMs }] : [];
        });
        if (words.length === 0) return [];
        return [{
          ...cue,
          sourceStartMs: words[0].sourceStartMs,
          sourceEndMs: words.at(-1)?.sourceEndMs ?? words[0].sourceEndMs,
          words,
        }];
      });
      const cueSegmentIds = new Set(cues.map((cue) => cue.segmentId));
      const usedCueIds = new Set(cues.map((cue) => cue.id));
      for (const segment of edl.segments) {
        if (cueSegmentIds.has(segment.id)) continue;
        cues.push(...captionCuesForSegment(segment, workspace.words, usedCueIds));
      }
      return cues.length === current.captions.cues.length && cues.every((cue, index) => (
        cue.sourceStartMs === current.captions.cues[index].sourceStartMs &&
        cue.sourceEndMs === current.captions.cues[index].sourceEndMs &&
        cue.words.length === current.captions.cues[index].words.length
      ))
        ? current
        : { ...current, captions: { ...current.captions, cues } };
    });
  }, [edl, workspace]);

  const updateBoundary = useCallback((
    segmentId: string,
    boundary: "start" | "end",
    valueMs: number
  ) => {
    if (!workspace) return;
    updateEdl((current) => {
      const otherDurationMs = current.segments.reduce((total, segment) => (
        segment.id === segmentId
          ? total
          : total + segment.sourceEndMs - segment.sourceStartMs
      ), 0);
      const availableDurationMs = Math.max(
        VIDEO_WORKSPACE_LIMITS.minSegmentDurationMs,
        VIDEO_WORKSPACE_LIMITS.maxTimelineDurationMs - otherDurationMs
      );
      return {
        ...current,
        segments: current.segments.map((segment) => {
          if (segment.id !== segmentId) return segment;
          if (boundary === "start") {
            return {
              ...segment,
              sourceStartMs: Math.max(
                0,
                segment.sourceEndMs - availableDurationMs,
                Math.min(
                  Math.round(valueMs),
                  segment.sourceEndMs - VIDEO_WORKSPACE_LIMITS.minSegmentDurationMs
                )
              ),
            };
          }
          return {
            ...segment,
            sourceEndMs: Math.min(
              workspace.sourceDurationMs,
              segment.sourceStartMs + availableDurationMs,
              Math.max(
                Math.round(valueMs),
                segment.sourceStartMs + VIDEO_WORKSPACE_LIMITS.minSegmentDurationMs
              )
            ),
          };
        }),
      };
    });
  }, [updateEdl, workspace]);

  const stepBoundary = useCallback((
    segment: EdlSegment,
    boundary: "start" | "end",
    direction: -1 | 1
  ) => {
    if (!workspace) return;
    const words = workspace.words;
    const current = boundary === "start" ? segment.sourceStartMs : segment.sourceEndMs;
    const next = boundary === "start"
      ? direction === -1 ? previousWordStart(words, current) : nextWordStart(words, current)
      : direction === -1 ? previousWordEnd(words, current) : nextWordEnd(words, current);
    if (next !== null) updateBoundary(segment.id, boundary, next);
  }, [updateBoundary, workspace]);

  const saveClipTitle = useCallback(async () => {
    const title = clipTitle.trim().replace(/\s+/g, " ").slice(0, 160);
    if (!workspace || !title || title === workspace.clipTitle || titleSaveState === "saving") {
      if (workspace && !title) setClipTitle(workspace.clipTitle);
      return;
    }
    setTitleSaveState("saving");
    try {
      const response = await fetch(
        `/api/video-projects/${projectId}/candidates/${candidateId}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ title }),
        }
      );
      if (!response.ok) throw new Error("clip_title_save_failed");
      setClipTitle(title);
      setWorkspace((current) => current ? { ...current, clipTitle: title } : current);
      setTitleSaveState("idle");
      onTitleChange?.(title);
    } catch {
      setTitleSaveState("error");
    }
  }, [candidateId, clipTitle, onTitleChange, projectId, titleSaveState, workspace]);

  const timeline = useMemo(() => edl && workspace ? buildTimelineSegments(edl, workspace.proxies) : [], [edl, workspace?.proxies]);

  if (loadError) {
    return (
      <EditorNotice tone="error">
        <span>{t("loadFailed")}</span>
        <button type="button" onClick={() => setReloadKey((value) => value + 1)} className="font-semibold underline underline-offset-4">
          {t("reload")}
        </button>
      </EditorNotice>
    );
  }
  if (!workspace || !edl || !renderSpec) {
    return (
      <div className="flex min-h-56 items-center justify-center gap-2 bg-ink/[0.02] text-[13px] text-ink/50">
        <Loader2 size={15} className="animate-spin text-accent" />
        {t("loading")}
      </div>
    );
  }

  const totalDuration = edl.segments.reduce(
    (total, segment) => total + segment.sourceEndMs - segment.sourceStartMs,
    0
  );

  return (
    <section id="editor" className="scroll-mt-6 bg-[linear-gradient(135deg,rgba(14,13,11,0.025),transparent_55%)] px-5 py-6 sm:px-7 sm:py-7">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
        <div className="min-w-0 flex-1 basis-64">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
            <Scissors size={12} />
            {t("eyebrow")}
          </div>
          <h4 className="mt-1 font-display text-xl font-semibold text-ink">{t("title")}</h4>
          <label className="mt-3 block w-full max-w-lg">
            <span className="sr-only">{t("clipTitle")}</span>
            <input
              type="text"
              value={clipTitle}
              maxLength={160}
              onChange={(event) => {
                setClipTitle(event.target.value);
                setTitleSaveState("idle");
              }}
              onBlur={() => void saveClipTitle()}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
              }}
              className="w-full border-b border-line bg-transparent py-1.5 font-display text-lg font-semibold text-ink outline-none transition placeholder:text-ink/35 focus:border-accent"
            />
            {titleSaveState === "error" ? (
              <span className="mt-1 block text-[10px] text-red-600">{t("clipTitleSaveFailed")}</span>
            ) : null}
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-4">
        {framingDraftActive ? <p className="max-w-52 text-xs text-ink/60">{t("style.visual.draftStatus")}</p> : <SaveIndicator state={saveState} t={t} onReload={() => setReloadKey((value) => value + 1)} />}
          <FinalRenderPanel compact
            projectId={projectId}
            candidateId={candidateId}
            revision={revision}
            disabled={saveState !== "saved" || framingDraftActive}
            disabledReason={framingDraftActive ? t("style.visual.draftStatus") : undefined}
            onConflict={() => setSaveState("conflict")}
          />
        </div>
      </div>

      <div className="grid gap-7 lg:grid-cols-[minmax(280px,1fr)_minmax(340px,1fr)]">
        <div className="lg:sticky lg:top-6 lg:self-start">
          <ContinuousProxyPlayer
            panel={panel}
            setPanel={setPanel}
            controlsHost={controlsHost}
            timeline={timeline}
            renderSpec={renderSpec}
            onDraftActive={setFramingDraftActive}
            assets={workspace.assets}
            onChange={updateRenderSpec}
            labels={{
              play: t("play"),
              pause: t("pause"),
              previewMissing: t("previewMissing"),
              dragToReframe: t("style.framing.dragToReframe"),
            }}
          />
          {proxyRefreshError ? <p role="alert" className="mt-3 text-xs text-red-600">{t("style.framing.autoUnavailable")}</p> : null}
          <div className="mt-3 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.1em] text-ink/45">
            <span>{t("continuousTimeline")}</span>
            <span>{formatDuration(totalDuration)}</span>
          </div>
          {proxyRefreshIds.length > 0 ? (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-800">
              <CircleAlert size={13} className="mt-0.5 shrink-0" />
              {t("proxyRefreshing")}
            </p>
          ) : null}
        </div>

        <div className="min-w-0 self-start rounded-2xl border border-line bg-card lg:max-h-[72vh] lg:overflow-y-auto">
          <div className="sticky top-0 z-10 grid grid-cols-4 border-b border-line bg-card p-2" role="group" aria-label={t("workspace.tools")}>
            {(["framing", "captions", "cover", "content"] as const).map(item => <button type="button" key={item} aria-pressed={panel === item} onClick={() => setPanel(item)} className="rounded-lg px-2 py-3 text-sm font-medium text-ink/60 transition hover:bg-ink/5 aria-pressed:bg-accent/10 aria-pressed:text-accent">{t(`workspace.${item}`)}</button>)}
          </div>
          <div ref={setControlsHost} hidden={panel !== "framing" && panel !== "cover"} />
          <div hidden={panel !== "content"} className="space-y-4 p-5">
          {[...edl.segments]
            .sort((left, right) => left.order - right.order)
            .map((segment, index) => (
              <SegmentEditor
                key={segment.id}
                segment={segment}
                words={workspace.words}
                proxy={workspace.proxies.find((item) => item.segmentId === segment.id)}
                labels={{
                  segment: t("segment", { number: index + 1 }),
                  source: t("sourceRange"),
                  start: t("start"),
                  end: t("end"),
                  previousWord: t("previousWord"),
                  nextWord: t("nextWord"),
                  insideHandles: t("insideHandles"),
                  outsideHandles: t("outsideHandles"),
                }}
                onBoundary={updateBoundary}
                onStep={stepBoundary}
              />
            ))}
          </div>
          <div hidden={panel !== "captions"} className="p-4">
          <VideoStyleControls
            expanded
            projectId={projectId}
            edl={edl}
            renderSpec={renderSpec}
            assets={workspace.assets}
            onChange={updateRenderSpec}
            onAssetsChange={(assets) => setWorkspace((current) => current ? { ...current, assets } : current)}
          />
          </div>

        </div>
      </div>
    </section>
  );
}

function SegmentEditor({
  segment,
  words,
  proxy,
  labels,
  onBoundary,
  onStep,
}: {
  segment: EdlSegment;
  words: TranscriptWordBoundary[];
  proxy: EditorWorkspace["proxies"][number] | undefined;
  labels: Record<string, string>;
  onBoundary: (id: string, boundary: "start" | "end", valueMs: number) => void;
  onStep: (segment: EdlSegment, boundary: "start" | "end", direction: -1 | 1) => void;
}) {
  const insideHandles = proxy
    ? sourceRangeInsideProxy(proxy, segment.sourceStartMs, segment.sourceEndMs)
    : false;
  const transcript = words
    .filter((word) => word.endMs > segment.sourceStartMs && word.startMs < segment.sourceEndMs)
    .map((word) => word.text)
    .join(" ");
  return (
    <article className="rounded-xl border border-line bg-card p-4">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">{labels.segment}</p>
        <p className="mt-1 text-[12px] text-ink/60">
          {labels.source} · {formatTimestamp(segment.sourceStartMs)}–{formatTimestamp(segment.sourceEndMs)}
        </p>
      </div>

      <p className="mt-3 line-clamp-2 min-h-10 text-[12px] leading-5 text-ink/55">
        {transcript || "…"}
      </p>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <BoundaryInput
          label={labels.start}
          valueMs={segment.sourceStartMs}
          previousLabel={labels.previousWord}
          nextLabel={labels.nextWord}
          onChange={(value) => onBoundary(segment.id, "start", value)}
          onPrevious={() => onStep(segment, "start", -1)}
          onNext={() => onStep(segment, "start", 1)}
        />
        <BoundaryInput
          label={labels.end}
          valueMs={segment.sourceEndMs}
          previousLabel={labels.previousWord}
          nextLabel={labels.nextWord}
          onChange={(value) => onBoundary(segment.id, "end", value)}
          onPrevious={() => onStep(segment, "end", -1)}
          onNext={() => onStep(segment, "end", 1)}
        />
      </div>
      {!insideHandles ? (
        <p className="mt-3 text-[10px] font-medium text-amber-700">
          {labels.outsideHandles}
        </p>
      ) : null}
    </article>
  );
}

function BoundaryInput({
  label,
  valueMs,
  previousLabel,
  nextLabel,
  onChange,
  onPrevious,
  onNext,
}: {
  label: string;
  valueMs: number;
  previousLabel: string;
  nextLabel: string;
  onChange: (valueMs: number) => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const [draftValue, setDraftValue] = useState(() => formatPreciseTimestamp(valueMs));

  useEffect(() => {
    setDraftValue(formatPreciseTimestamp(valueMs));
  }, [valueMs]);

  const commit = () => {
    const parsed = parseTimestamp(draftValue);
    if (parsed === null) {
      setDraftValue(formatPreciseTimestamp(valueMs));
      return;
    }
    onChange(parsed);
  };

  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink/45">{label}</span>
      <div className="mt-1 flex items-stretch overflow-hidden rounded-lg border border-line bg-paper">
        <button type="button" onClick={onPrevious} aria-label={previousLabel} title={previousLabel} className="px-2 text-ink/45 transition hover:bg-ink/5 hover:text-ink"><SkipBack size={13} /></button>
        <input
          type="text"
          inputMode="decimal"
          value={draftValue}
          onChange={(event) => setDraftValue(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setDraftValue(formatPreciseTimestamp(valueMs));
              event.currentTarget.blur();
            }
          }}
          className="min-w-0 flex-1 border-x border-line bg-transparent px-2 py-2 font-mono text-[11px] tabular-nums text-ink outline-none focus:bg-card"
        />
        <button type="button" onClick={onNext} aria-label={nextLabel} title={nextLabel} className="px-2 text-ink/45 transition hover:bg-ink/5 hover:text-ink"><SkipForward size={13} /></button>
      </div>
    </label>
  );
}

function ContinuousProxyPlayer({
  panel, setPanel, controlsHost,
  onDraftActive,
  timeline,
  renderSpec: savedRenderSpec,
  assets,
  onChange,
  labels,
}: {
  panel: "framing" | "captions" | "cover" | "content";
  setPanel: (panel: "framing" | "captions" | "cover" | "content") => void;
  controlsHost: HTMLDivElement | null;
  onDraftActive: (active: boolean) => void;
  timeline: TimelineSegment[];
  renderSpec: RenderSpec;
  assets: EditorWorkspace["assets"];
  onChange: (spec: RenderSpec) => void;
  labels: { play: string; pause: string; previewMissing: string; dragToReframe: string };
}) {
  const t = useTranslations("Dashboard.videoCandidates.editor.style");
  const [adjusting, setAdjusting] = useState(false);
  const [manualDraft, setManualDraft] = useState<RenderSpec | null>(null);
  const [beforeCrop, setBeforeCrop] = useState<RenderSpec["segments"] | null>(null);
  const [previewSection, setPreviewSection] = useState<{ start: number; end: number; number: number } | null>(null);
  const [previewWholeClip, setPreviewWholeClip] = useState(false);
  const playbackScope = adjusting && !previewWholeClip ? previewSection : null;
  const playbackScopeRef = useRef(playbackScope);
  playbackScopeRef.current = playbackScope;
  const renderSpec = manualDraft ?? savedRenderSpec;
  useEffect(() => {
    onDraftActive(adjusting);
    return () => onDraftActive(false);
  }, [adjusting, onDraftActive]);
  const [coverSet, setCoverSet] = useState(false);
  useEffect(() => {
    if (panel !== "framing") { setManualDraft(null); setAdjusting(false); }
  }, [panel]);
  const videos = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)];
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);
  const [timelineMs, setTimelineMs] = useState(0);
  const [sourceMs, setSourceMs] = useState(timeline[0]?.sourceStartMs ?? 0);
  const [playing, setPlaying] = useState(false);
  const [playbackControlVisible, setPlaybackControlVisible] = useState(true);
  const playbackControlTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchControlReveal = useRef(false);
  const hidePlaybackControl = () => {
    if (playbackControlTimer.current) clearTimeout(playbackControlTimer.current);
    setPlaybackControlVisible(false);
  };
  const revealPlaybackControl = () => {
    if (playbackControlTimer.current) clearTimeout(playbackControlTimer.current);
    setPlaybackControlVisible(true);
    playbackControlTimer.current = setTimeout(() => setPlaybackControlVisible(false), 1500);
  };
  useEffect(() => () => {
    if (playbackControlTimer.current) clearTimeout(playbackControlTimer.current);
  }, []);

  const [videoDimensions, setVideoDimensions] = useState<Array<{
    width: number;
    height: number;
  } | null>>([null, null]);
  const switchingRef = useRef(false);
  const durationMs = timelineDurationMs(timeline);
  const activeSegment = timeline[activeIndex];
  const baseFraming = activeSegment ? renderSpec.segments[activeSegment.id] : undefined;
  const ranges = baseFraming?.framingRanges ?? [];
  const activeRangeIndex = ranges.findLastIndex(range => range.sourceStartMs <= sourceMs);
  const framing = ranges[activeRangeIndex] ?? baseFraming;
  const resolvedFraming = baseFraming ? framingAt(baseFraming, sourceMs) : undefined;
  const activeCrop = resolvedFraming?.crop;
  const activeFramingMode = resolvedFraming?.framingMode ?? "fit";
  const setSimpleMode = (mode: "auto" | "fit") => {
    setManualDraft(null);
    setBeforeCrop(savedRenderSpec.segments);
    onChange({ ...savedRenderSpec, segments: Object.fromEntries(Object.entries(savedRenderSpec.segments).map(([id, spec]) => [id, { ...spec, framingMode: mode, framingRanges: [] }])) });
  };
  const slot0Index = activeSlot === 0 ? activeIndex : activeIndex + 1;
  const slot1Index = activeSlot === 1 ? activeIndex : activeIndex + 1;

  useEffect(() => {
    if (activeIndex >= timeline.length) {
      setActiveIndex(0);
      setActiveSlot(0);
      setTimelineMs(0);
      setPlaying(false);
    }
  }, [activeIndex, timeline.length]);

  useEffect(() => {
    const video = videos[activeSlot].current;
    const segment = timeline[activeIndex];
    if (!video || !segment) return;
    const localMs = Math.max(0, timelineMs - segment.timelineStartMs);
    const seek = (segment.proxyStartMs + localMs) / 1000;
    setSourceMs(segment.sourceStartMs + localMs);
    if (Number.isFinite(video.duration)) video.currentTime = seek;
    if (playing) void video.play().catch(() => setPlaying(false));
    else video.pause();
    switchingRef.current = false;
  }, [activeIndex, activeSlot, playing, timeline]);

  useEffect(() => {
    const gain = Math.min(1, 10 ** (renderSpec.audio.gainDb / 20));
    const fadeIn = renderSpec.audio.fadeInMs > 0
      ? Math.min(1, timelineMs / renderSpec.audio.fadeInMs)
      : 1;
    const remainingMs = Math.max(0, durationMs - timelineMs);
    const fadeOut = renderSpec.audio.fadeOutMs > 0
      ? Math.min(1, remainingMs / renderSpec.audio.fadeOutMs)
      : 1;
    for (const video of videos) {
      if (video.current) video.current.volume = Math.max(0, Math.min(1, gain * fadeIn * fadeOut));
    }
  }, [durationMs, renderSpec.audio, timelineMs]);

  const seekTimeline = (valueMs: number) => {
    const position = timelineSegmentAt(timeline, valueMs);
    if (!position) return;
    if (position.index !== activeIndex) {
      videos[activeSlot].current?.pause();
      setActiveIndex(position.index);
    }
    setTimelineMs(valueMs);
    setSourceMs(position.segment.sourceStartMs + position.localMs);
    const video = videos[activeSlot].current;
    if (video && position.index === activeIndex) {
      video.currentTime = (position.segment.proxyStartMs + position.localMs) / 1000;
    }
  };

  useEffect(() => {
    seekTimeline(renderSpec.coverTimelineMs);
    // The cover control is an explicit seek request; other style edits do not move playback.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderSpec.coverTimelineMs]);

  const advance = () => {
    if (!playing || switchingRef.current) return;
    const scope = playbackScopeRef.current;
    if (scope && timeline[activeIndex].timelineEndMs >= scope.end) {
      videos[activeSlot].current?.pause();
      setPlaying(false);
      seekTimeline(scope.end - 1);
      return;
    }
    switchingRef.current = true;
    videos[activeSlot].current?.pause();
    if (activeIndex >= timeline.length - 1) {
      setPlaying(false);
      setTimelineMs(durationMs);
      switchingRef.current = false;
      return;
    }
    const nextIndex = activeIndex + 1;
    setTimelineMs(timeline[nextIndex].timelineStartMs);
    setActiveIndex(nextIndex);
    setActiveSlot(activeSlot === 0 ? 1 : 0);
  };

  const onTimeUpdate = (slot: 0 | 1) => {
    if (slot !== activeSlot || !playing) return;
    const video = videos[slot].current;
    const segment = timeline[activeIndex];
    if (!video || !segment) return;
    const sourceMs = segment.proxySourceStartMs + video.currentTime * 1000;
    setSourceMs(sourceMs);
    const nextTimelineMs = segment.timelineStartMs + sourceMs - segment.sourceStartMs;
    const scope = playbackScopeRef.current;
    if (playing && scope && nextTimelineMs >= scope.end - 30) {
      const stoppedAt = scope.end - 1;
      video.pause();
      setPlaying(false);
      setTimelineMs(stoppedAt);
      setSourceMs(segment.sourceStartMs + stoppedAt - segment.timelineStartMs);
      const localTime = (segment.proxyStartMs + stoppedAt - segment.timelineStartMs) / 1000;
      if (Math.abs(video.currentTime - localTime) > 0.01) video.currentTime = localTime;
      return;
    }
    if (nextTimelineMs >= segment.timelineEndMs - 30) {
      advance();
      return;
    }
    setTimelineMs(Math.max(segment.timelineStartMs, nextTimelineMs));
  };

  const onLoadedMetadata = (slot: 0 | 1) => {
    const video = videos[slot].current;
    if (video?.videoWidth && video.videoHeight) {
      setVideoDimensions((current) => current.map((value, index) => (
        index === slot ? { width: video.videoWidth, height: video.videoHeight } : value
      )));
    }
    if (slot !== activeSlot) return;
    const segment = timeline[activeIndex];
    if (!video || !segment) return;
    const localMs = Math.max(0, timelineMs - segment.timelineStartMs);
    setSourceMs(segment.sourceStartMs + localMs);
    video.currentTime = (segment.proxyStartMs + localMs) / 1000;
    if (playing) void video.play().catch(() => setPlaying(false));
  };

  const toggle = () => {
    const video = videos[activeSlot].current;
    if (!video || timeline.length === 0) return;
    if (playing) {
      video.pause();
      setPlaying(false);
      return;
    }
    if (timelineMs >= (playbackScope?.end ?? durationMs) - 30 || (playbackScope && timelineMs < playbackScope.start)) {
      seekTimeline(playbackScope?.start ?? 0);
      setPlaying(true);
      return;
    }
    void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const update = () => {
      onTimeUpdate(activeSlot);
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
    // Keep framing and captions in sync with playback between native timeupdate events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, activeSlot, activeIndex, timeline]);

  if (timeline.length === 0) {
    return <div className="fixed-media-surface grid aspect-[9/16] w-full max-w-[min(100%,calc(56vh*9/16))] place-items-center rounded-xl bg-ink px-6 text-center text-[12px] text-paper/55">{labels.previewMissing}</div>;
  }
  const mediaStyle = (slot: 0 | 1) => {
    const dimensions = videoDimensions[slot];
    if (activeFramingMode === "fit") {
      return {
        width: "100%",
        height: "100%",
        left: "0%",
        top: "0%",
        objectFit: "contain" as const,
      };
    }
    if (!dimensions || !activeCrop) {
      return {
        width: "100%",
        height: "100%",
        left: "0%",
        top: "0%",
        objectFit: "cover" as const,
        objectPosition: `${(activeCrop?.x ?? 0.5) * 100}% ${(activeCrop?.y ?? 0.5) * 100}%`,
      };
    }
    return browserCropStyle(coverCropBox(dimensions.width, dimensions.height, activeCrop));
  };

  return (
    <div className="space-y-3">
    <div
      style={{ backgroundColor: renderSpec.canvas.backgroundColor }}
      className="relative mx-auto aspect-[9/16] w-full max-w-[min(100%,calc(56vh*9/16))] overflow-hidden rounded-xl [container-type:inline-size] shadow-[0_20px_60px_-30px_rgba(0,0,0,0.75)]"
    >
      <video
        ref={videos[0]}
        src={timeline[slot0Index]?.proxyUrl}
        preload={slot0Index === activeIndex ? "auto" : "metadata"}
        playsInline
        onLoadedMetadata={() => onLoadedMetadata(0)}
        onTimeUpdate={() => onTimeUpdate(0)}
        onEnded={advance}
        style={mediaStyle(0)}
        className={`absolute max-w-none object-fill ${activeSlot === 0 ? "opacity-100" : "opacity-0"}`}
      />
      <video
        ref={videos[1]}
        src={timeline[slot1Index]?.proxyUrl}
        preload="auto"
        playsInline
        onLoadedMetadata={() => onLoadedMetadata(1)}
        onTimeUpdate={() => onTimeUpdate(1)}
        onEnded={advance}
        style={mediaStyle(1)}
        className={`absolute max-w-none object-fill ${activeSlot === 1 ? "opacity-100" : "opacity-0"}`}
      />
      {activeSegment ? (
        <PreviewOverlays
          segmentId={activeSegment.id}
          sourceMs={sourceMs}
          renderSpec={renderSpec}
          assets={assets}
        />
      ) : null}
      <button
        type="button"
        aria-label={playing ? labels.pause : labels.play}
        onPointerMove={(event) => { if (event.pointerType === "mouse") revealPlaybackControl(); }}
        onPointerLeave={hidePlaybackControl}
        onPointerDown={(event) => { touchControlReveal.current = event.pointerType === "touch" && !playbackControlVisible; }}
        onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) revealPlaybackControl(); }}
        onBlur={hidePlaybackControl}
        onClick={(event) => {
          if (event.detail !== 0 && touchControlReveal.current) {
            touchControlReveal.current = false;
            revealPlaybackControl();
            return;
          }
          hidePlaybackControl();
          toggle();
        }}
        className="absolute inset-0 grid place-items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
      >
        <span className={`grid size-14 place-items-center rounded-full border border-white/30 bg-black/55 text-white backdrop-blur transition-opacity duration-150 motion-reduce:transition-none ${playbackControlVisible ? "opacity-100" : "opacity-0"}`}>
          {playing ? <Pause size={20} fill="currentColor" aria-hidden="true" /> : <Play size={20} fill="currentColor" aria-hidden="true" className="translate-x-0.5" />}
        </span>
      </button>
    </div>
      <div className="rounded-xl border border-line bg-card px-4 py-3">
        {adjusting && previewSection ? <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="font-medium text-ink">{playbackScope ? t("visual.previewSection", { number: playbackScope.number, start: formatSectionTimestamp(playbackScope.start), end: formatSectionTimestamp(playbackScope.end) }) : t("visual.previewWhole")}</span>
          <button type="button" className="text-accent underline" onClick={() => { setPlaying(false); setPreviewWholeClip(!previewWholeClip); playbackScopeRef.current = null; seekTimeline(previewWholeClip ? previewSection.start : 0); }}>{t(previewWholeClip ? "visual.backToSection" : "visual.playWhole")}</button>
        </div> : null}
        <label className="sr-only" htmlFor="clip-playhead">{t("workspace.playhead")}</label>
        <input
          id="clip-playhead"
          type="range"
          min={playbackScope?.start ?? 0}
          max={Math.max(1, (playbackScope?.end ?? durationMs) - 1)}
          step={10}
          value={Math.max(playbackScope?.start ?? 0, Math.min(timelineMs, (playbackScope?.end ?? durationMs) - 1))}
          onChange={(event) => { setPlaying(false); seekTimeline(Number(event.target.value)); }}
          className="w-full accent-[var(--accent)]"
        />
        <div className="mt-1 flex justify-between font-mono text-xs tabular-nums text-ink/60">
          <span>{(playbackScope ? formatSectionTimestamp : formatTimestamp)(playbackScope && timelineMs >= playbackScope.end - 30 ? playbackScope.end : timelineMs)}</span>
          <span>{(playbackScope ? formatSectionTimestamp : formatTimestamp)(playbackScope?.end ?? durationMs)}</span>
        </div>

      </div>
    <div className="flex flex-wrap justify-center gap-2">
      <button type="button" onClick={() => { setPlaying(false); setPanel("cover"); setCoverSet(true); onChange({ ...renderSpec, coverTimelineMs: Math.min(Math.round(timelineMs), durationMs - 1) }); }} className="rounded-lg border border-line bg-card px-3 py-2 text-xs font-medium text-ink">{t("workspace.coverAt", { time: formatTimestamp(timelineMs) })}</button>

    </div>
    {activeSegment && activeCrop && controlsHost ? createPortal(
      <div className="space-y-4 p-5 text-sm text-ink">
      {panel === "framing" ? <>
        <h5 className="font-display text-lg font-semibold">{t("framing.title")}</h5>
        {adjusting ? <ManualFramingEditor
          timeline={timeline} spec={savedRenderSpec} timeMs={timelineMs} playing={playing}
          onSeek={time => { playbackScopeRef.current = null; setPreviewWholeClip(false); setPlaying(false); seekTimeline(time); }}
          onSectionChange={setPreviewSection}
          onPreview={setManualDraft}
          onApply={next => { setBeforeCrop(savedRenderSpec.segments); onChange(next); setManualDraft(null); setAdjusting(false); setPlaying(false); playbackScopeRef.current = null; }}
          onCancel={() => { setManualDraft(null); setAdjusting(false); setPlaying(false); }}
        /> : <>
          {beforeCrop ? <button type="button" onClick={() => { onChange({ ...savedRenderSpec, segments: Object.fromEntries(Object.entries(savedRenderSpec.segments).map(([id, spec]) => [id, beforeCrop[id] ? { ...spec, crop: beforeCrop[id].crop, framingMode: beforeCrop[id].framingMode, framingRanges: beforeCrop[id].framingRanges, autoFraming: beforeCrop[id].autoFraming } : spec])) }); setBeforeCrop(null); }} className="text-accent underline">{t("visual.undo")}</button> : null}
          <p className="text-ink/60">{t("visual.simpleHelp")}</p>
          <div className="grid grid-cols-2 gap-3">
            {(["auto", "fit"] as const).map(mode => <button key={mode} type="button" aria-pressed={Object.values(savedRenderSpec.segments).every(spec => spec.framingMode === mode && !spec.framingRanges?.length)} onClick={() => setSimpleMode(mode)} className="rounded-xl border border-line p-4 text-left font-medium aria-pressed:border-accent aria-pressed:bg-accent/10 aria-pressed:text-accent">{t(`workspace.${mode}`)}</button>)}
          </div>
          <p className="text-xs leading-5 text-ink/60">{t("visual.wholeWarning")}</p>
          <div className="border-t border-line pt-4">
            <button type="button" onClick={() => { setPlaying(false); setPreviewWholeClip(false); setAdjusting(true); }} className="rounded-lg bg-accent px-4 py-3 font-medium text-white">{t("visual.manual")}</button>
            <p className="mt-2 text-xs leading-5 text-ink/60">{t("visual.manualHelp")}</p>
          </div>
        </>}
      </> : panel === "cover" ? <>
        <h5 className="font-display text-lg font-semibold">{t("workspace.chooseCover")}</h5>
        <p className="leading-6 text-ink/60">{t("workspace.coverHelp")}</p>
        <div className="flex flex-wrap items-center gap-2">
          {coverSet ? <p role="status" className="text-accent">{t("simple.coverSet", { time: formatTimestamp(renderSpec.coverTimelineMs) })}</p> : null}
          <button type="button" className="p-2 underline" onClick={() => { setPlaying(false); seekTimeline(renderSpec.coverTimelineMs); }}>{t("cover.view")} · {formatTimestamp(renderSpec.coverTimelineMs)}</button>
        </div>
        <CoverFrame timeline={timeline} renderSpec={renderSpec} assets={assets} />
        </> : null}
      </div>, controlsHost
    ) : null}
    </div>
  );
}

function CoverFrame({ timeline, renderSpec, assets }: { timeline: TimelineSegment[]; renderSpec: RenderSpec; assets: EditorWorkspace["assets"] }) {
  const video = useRef<HTMLVideoElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const position = timeline.find(segment => renderSpec.coverTimelineMs >= segment.timelineStartMs && renderSpec.coverTimelineMs < segment.timelineEndMs);
  const sourceMs = position ? position.sourceStartMs + renderSpec.coverTimelineMs - position.timelineStartMs : 0;
  const base = position ? renderSpec.segments[position.id] : undefined;
  const framing = base ? framingAt(base, sourceMs) : undefined;
  const seek = () => {
    if (video.current && position && Number.isFinite(video.current.duration)) {
      video.current.currentTime = (position.proxyStartMs + renderSpec.coverTimelineMs - position.timelineStartMs) / 1000;
      setDimensions({ width: video.current.videoWidth, height: video.current.videoHeight });
    }
  };
  useEffect(seek, [position?.proxyUrl, renderSpec.coverTimelineMs, position?.proxyStartMs, position?.timelineStartMs]);
  if (!position || !framing) return null;
  const style = framing.framingMode === "fit" || !dimensions ? { width: "100%", height: "100%", objectFit: "contain" as const } : browserCropStyle(coverCropBox(dimensions.width, dimensions.height, framing.crop));
  return <div className="relative mx-auto aspect-[9/16] w-32 overflow-hidden rounded-lg [container-type:inline-size]" style={{ backgroundColor: renderSpec.canvas.backgroundColor }}>
    <video ref={video} src={position.proxyUrl} muted playsInline preload="metadata" onLoadedMetadata={seek} style={style} className="absolute max-w-none" />
    <PreviewOverlays segmentId={position.id} sourceMs={sourceMs} renderSpec={renderSpec} assets={assets} />
  </div>;
}

function PreviewOverlays({
  segmentId,
  sourceMs,
  renderSpec,
  assets,
}: {
  segmentId: string;
  sourceMs: number;
  renderSpec: RenderSpec;
  assets: EditorWorkspace["assets"];
}) {
  const cue = renderSpec.captions.enabled ? renderSpec.captions.cues.find((item) => (
    item.segmentId === segmentId &&
    sourceMs >= item.sourceStartMs &&
    sourceMs < item.sourceEndMs
  )) : undefined;
  const logo = assets.find((asset) => (
    asset.kind === "logo" && asset.id === renderSpec.brand.logoAssetId
  ));
  const font = assets.find((asset) => (
    asset.kind === "font" && asset.id === renderSpec.captions.fontAssetId
  ));
  const fontFamily = font ? `scribix-font-${font.id}` : undefined;
  const captionStyle = captionVisualStyle(renderSpec.captions.templateId);
  const captionLines = cue
    ? wrapCaptionWordIndexes(
        cue.words,
        renderSpec.captions.maxCharsPerLine,
        renderSpec.captions.maxLines
      )
    : [];
  const activeWordIndex = cue ? activeCaptionWordIndex(cue.words, sourceMs) : null;
  const logoPosition = renderSpec.brand.logoPosition;
  const logoStyle = {
    width: `${logoWidthPx(renderSpec.brand.logoScale) / 10.8}%`,
    ...(logoPosition.endsWith("left")
      ? { left: `${VIDEO_LOGO_SIDE_PX / 10.8}%` }
      : { right: `${VIDEO_LOGO_SIDE_PX / 10.8}%` }),
    ...(logoPosition.startsWith("top")
      ? { top: `${VIDEO_LOGO_TOP_PX / 19.2}%` }
      : { bottom: `${VIDEO_LOGO_BOTTOM_PX / 19.2}%` }),
  };
  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {font ? <style>{`@font-face{font-family:"${fontFamily}";src:url("${font.url}") format("truetype");font-display:swap;}`}</style> : null}
      <div className="absolute inset-[5%] rounded-md border border-dashed border-white/20" />
      {renderSpec.brand.templateId === "signature-v1" ? (
        <div
          className="absolute inset-x-0 bottom-0"
          style={{
            backgroundColor: renderSpec.brand.accentColor,
            height: `${VIDEO_SIGNATURE_HEIGHT_PX / 19.2}%`,
          }}
        />
      ) : null}
      {renderSpec.brand.templateId && logo ? (
        // The URL is server-signed for this owned asset; alt is decorative in the video canvas.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo.url}
          alt=""
          className="absolute max-h-[16%] object-contain"
          style={logoStyle}
        />
      ) : null}
      {cue ? (
        <div
          className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 text-center leading-[1.12]"
          style={{
            top: `${renderSpec.captions.positionY * 100}%`,
            color: renderSpec.captions.textColor,
            fontFamily,
            width: "90%",
            fontSize: `${captionStyle.fontSize * (renderSpec.captions.fontScale ?? 1) / 10.8}cqw`,
            fontWeight: captionStyle.fontWeight,
            textTransform: captionStyle.uppercase ? "uppercase" : "none",
            WebkitTextStroke: captionStyle.outline > 0
              ? `${captionStyle.outline / 10.8}cqw rgba(0,0,0,0.8)`
              : undefined,
            textShadow: captionStyle.shadow > 0
              ? `0 ${captionStyle.shadow / 10.8}cqw ${captionStyle.shadow / 5.4}cqw rgba(0,0,0,0.95)`
              : undefined,
          }}
        >
          <span className={captionStyle.boxed ? "inline-block rounded-lg bg-black/75 px-[2.2%] py-[1.2%]" : undefined}>
            {captionLines.map((line, lineIndex) => (
              <span key={lineIndex} className="block">
                {line.map((wordIndex, indexInLine) => {
                  const word = cue.words[wordIndex];
                  return (
                    <span
                      key={`${word.sourceStartMs}-${wordIndex}`}
                      style={{
                        color: activeWordIndex === wordIndex
                          ? renderSpec.captions.highlightColor
                          : undefined,
                      }}
                    >
                      {indexInLine > 0 ? " " : ""}{word.text}
                    </span>
                  );
                })}
              </span>
            ))}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function SaveIndicator({
  state,
  t,
  onReload,
}: {
  state: VideoEditorSaveState;
  t: ReturnType<typeof useTranslations>;
  onReload: () => void;
}) {
  if (state === "conflict") {
    return <button type="button" onClick={onReload} className="rounded-full border border-amber-300 bg-amber-50 px-3 py-2 text-[10px] font-semibold text-amber-800">{t("conflictReload")}</button>;
  }
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-[10px] font-medium ${state === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-line bg-card text-ink/50"}`}>
      {state === "saving" ? <Loader2 size={11} className="animate-spin" /> : null}
      {t(`saveState.${state}`)}
    </span>
  );
}

function EditorNotice({ children, tone }: { children: React.ReactNode; tone: "error" }) {
  return <div className={`flex min-h-32 items-center justify-center gap-3 border-t border-line px-6 text-[12px] ${tone === "error" ? "bg-red-50 text-red-700" : ""}`}>{children}</div>;
}

function draftSignature(edl: Edl, renderSpec: RenderSpec): string {
  return JSON.stringify({ edl, renderSpec });
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function segmentIndexFromId(segmentId: string): number | null {
  const match = /^s(\d+)$/.exec(segmentId);
  if (!match) return null;
  const value = Number(match[1]);
  return value < VIDEO_WORKSPACE_LIMITS.maxSegments ? value : null;
}

function captionCuesForSegment(
  segment: EdlSegment,
  words: TranscriptWordBoundary[],
  usedCueIds: Set<string>
): RenderSpec["captions"]["cues"] {
  const segmentWords = words.filter((word) => (
    word.endMs > segment.sourceStartMs && word.startMs < segment.sourceEndMs
  ));
  const cues: RenderSpec["captions"]["cues"] = [];
  for (let index = 0; index < segmentWords.length; index += 6) {
    const group = segmentWords.slice(index, index + 6);
    if (group.length === 0) continue;
    let cueIndex = usedCueIds.size;
    while (usedCueIds.has(`cue_${cueIndex}`)) cueIndex += 1;
    const id = `cue_${cueIndex}`;
    usedCueIds.add(id);
    cues.push({
      id,
      segmentId: segment.id,
      sourceStartMs: Math.max(segment.sourceStartMs, group[0].startMs),
      sourceEndMs: Math.min(segment.sourceEndMs, group.at(-1)?.endMs ?? group[0].endMs),
      words: group.map((word) => ({
        text: word.text,
        sourceStartMs: Math.max(segment.sourceStartMs, word.startMs),
        sourceEndMs: Math.min(segment.sourceEndMs, word.endMs),
      })),
    });
  }
  return cues;
}

function formatDuration(valueMs: number): string {
  const seconds = Math.round(valueMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatSectionTimestamp(valueMs: number): string {
  const rounded = Math.max(0, Math.round(valueMs / 100) * 100);
  return `${formatTimestamp(rounded)}${rounded % 1000 ? `.${rounded % 1000 / 100}` : ""}`;
}

function formatTimestamp(valueMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(valueMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatPreciseTimestamp(valueMs: number): string {
  const safeValueMs = Math.max(0, Math.round(valueMs));
  const totalSeconds = Math.floor(safeValueMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = safeValueMs % 1000;
  const prefix = hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
    : String(minutes).padStart(2, "0");
  return `${prefix}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

function parseTimestamp(value: string): number | null {
  const parts = value.trim().split(":");
  if (parts.length < 2 || parts.length > 3) return null;
  const seconds = Number(parts.at(-1));
  const minutes = Number(parts.at(-2));
  const hours = parts.length === 3 ? Number(parts[0]) : 0;
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds) ||
    hours < 0 ||
    minutes < 0 ||
    seconds < 0 ||
    (parts.length === 3 && minutes >= 60) ||
    seconds >= 60
  ) {
    return null;
  }
  return Math.round(((hours * 60 + minutes) * 60 + seconds) * 1000);
}
