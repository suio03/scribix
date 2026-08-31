"use client";

import {
  ChevronDown,
  ChevronUp,
  CircleAlert,
  Loader2,
  Pause,
  Play,
  Save,
  Scissors,
  SkipBack,
  SkipForward,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { VideoStyleControls } from "@/app/components/VideoStyleControls";
import { FinalRenderPanel } from "@/app/components/FinalRenderPanel";
import { trackVideoWorkspaceEvent } from "@/app/components/video-event-client";
import type { EditorWorkspace } from "@/lib/video-workspace/editor";
import type { Edl, EdlSegment, RenderSpec } from "@/lib/video-workspace/contracts";
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

type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

export function VideoClipEditor({
  projectId,
  candidateId,
}: {
  projectId: string;
  candidateId: string;
}) {
  const t = useTranslations("Dashboard.videoCandidates.editor");
  const [workspace, setWorkspace] = useState<EditorWorkspace | null>(null);
  const [edl, setEdl] = useState<Edl | null>(null);
  const [renderSpec, setRenderSpec] = useState<RenderSpec | null>(null);
  const [revision, setRevision] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [snapshotVersion, setSnapshotVersion] = useState<number | null>(null);
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [proxyRefreshIds, setProxyRefreshIds] = useState<string[]>([]);
  const lastSavedRef = useRef("");
  const proxyRequestRef = useRef(new Map<string, string>());
  const eventSessionRef = useRef<string | null>(null);
  const editorStartedAtRef = useRef(0);

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
    fetch(`/api/video-projects/${projectId}/editor?candidateId=${encodeURIComponent(candidateId)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("editor_load_failed");
        return response.json() as Promise<EditorWorkspace>;
      })
      .then((next) => {
        if (!active) return;
        const signature = draftSignature(next.edl, next.renderSpec);
        lastSavedRef.current = next.restoredDraft ? signature : "";
        setWorkspace(next);
        setEdl(next.edl);
        setRenderSpec(next.renderSpec);
        setRevision(next.revision);
        setSaveState(next.restoredDraft ? "saved" : "dirty");
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, [candidateId, projectId, reloadKey]);

  const signature = useMemo(
    () => edl && renderSpec ? draftSignature(edl, renderSpec) : "",
    [edl, renderSpec]
  );

  useEffect(() => {
    if (!edl || !renderSpec || !signature || signature === lastSavedRef.current) return;
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
    if (!workspace || !edl) return;
    const uncovered = edl.segments.filter((segment) => {
      const proxy = workspace.proxies.find((item) => item.segmentId === segment.id);
      return proxy && !sourceRangeInsideProxy(proxy, segment.sourceStartMs, segment.sourceEndMs);
    });
    if (uncovered.length === 0) return;
    const timer = window.setTimeout(() => {
      for (const segment of uncovered) {
        const proxy = workspace.proxies.find((item) => item.segmentId === segment.id);
        if (!proxy) continue;
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
              segmentIndex: proxy.segmentIndex,
              sourceStartMs: segment.sourceStartMs,
              sourceEndMs: segment.sourceEndMs,
            }),
          }
        );
      }
    }, 1_200);
    return () => window.clearTimeout(timer);
  }, [candidateId, edl, projectId, workspace]);

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
    setSnapshotVersion(null);
  }, []);

  const updateRenderSpec = useCallback((next: RenderSpec) => {
    setRenderSpec(next);
    setSaveState((current) => current === "conflict" ? current : "dirty");
    setSnapshotVersion(null);
  }, []);

  useEffect(() => {
    if (!edl) return;
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
      return cues.length === current.captions.cues.length && cues.every((cue, index) => (
        cue.sourceStartMs === current.captions.cues[index].sourceStartMs &&
        cue.sourceEndMs === current.captions.cues[index].sourceEndMs &&
        cue.words.length === current.captions.cues[index].words.length
      ))
        ? current
        : { ...current, captions: { ...current.captions, cues } };
    });
  }, [edl]);

  const updateBoundary = useCallback((
    segmentId: string,
    boundary: "start" | "end",
    valueMs: number
  ) => {
    if (!workspace) return;
    updateEdl((current) => ({
      ...current,
      segments: current.segments.map((segment) => {
        if (segment.id !== segmentId) return segment;
        if (boundary === "start") {
          return {
            ...segment,
            sourceStartMs: Math.max(0, Math.min(Math.round(valueMs), segment.sourceEndMs - 250)),
          };
        }
        return {
          ...segment,
          sourceEndMs: Math.min(
            workspace.sourceDurationMs,
            Math.max(Math.round(valueMs), segment.sourceStartMs + 250)
          ),
        };
      }),
    }));
  }, [updateEdl, workspace]);

  const removeSegment = useCallback((segmentId: string) => {
    if (!edl || !renderSpec || edl.segments.length <= 1) return;
    const nextSegments = edl.segments
      .filter((segment) => segment.id !== segmentId)
      .sort((left, right) => left.order - right.order)
      .map((segment, order) => ({ ...segment, order }));
    const nextSegmentSpecs = { ...renderSpec.segments };
    delete nextSegmentSpecs[segmentId];
    const durationMs = nextSegments.reduce(
      (total, segment) => total + segment.sourceEndMs - segment.sourceStartMs,
      0
    );
    setEdl({ ...edl, segments: nextSegments });
    setRenderSpec({
      ...renderSpec,
      segments: nextSegmentSpecs,
      captions: {
        ...renderSpec.captions,
        cues: renderSpec.captions.cues.filter((cue) => cue.segmentId !== segmentId),
      },
      coverTimelineMs: Math.min(renderSpec.coverTimelineMs, Math.max(0, durationMs - 1)),
    });
    setSaveState((current) => current === "conflict" ? current : "dirty");
    setSnapshotVersion(null);
  }, [edl, renderSpec]);

  const moveSegment = useCallback((segmentId: string, direction: -1 | 1) => {
    updateEdl((current) => {
      const ordered = [...current.segments].sort((left, right) => left.order - right.order);
      const index = ordered.findIndex((segment) => segment.id === segmentId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= ordered.length) return current;
      [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
      return { ...current, segments: ordered.map((segment, order) => ({ ...segment, order })) };
    });
  }, [updateEdl]);

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

  const createSnapshot = useCallback(async () => {
    if (saveState !== "saved") return;
    setSnapshotBusy(true);
    try {
      const response = await fetch(`/api/video-projects/${projectId}/editor`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidateId, expectedRevision: revision }),
      });
      const payload = await response.json() as { version?: number; error?: string };
      if (response.status === 409) {
        setSaveState("conflict");
      } else if (response.ok && Number.isInteger(payload.version)) {
        setSnapshotVersion(payload.version as number);
      } else {
        setSaveState("error");
      }
    } catch {
      setSaveState("error");
    } finally {
      setSnapshotBusy(false);
    }
  }, [candidateId, projectId, revision, saveState]);

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

  const timeline = buildTimelineSegments(edl, workspace.proxies);
  const totalDuration = edl.segments.reduce(
    (total, segment) => total + segment.sourceEndMs - segment.sourceStartMs,
    0
  );

  return (
    <section className="border-t border-line bg-[linear-gradient(135deg,rgba(14,13,11,0.025),transparent_55%)] px-5 py-6 sm:px-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
            <Scissors size={12} />
            {t("eyebrow")}
          </div>
          <h4 className="mt-1 font-display text-xl font-semibold text-ink">{t("title")}</h4>
        </div>
        <div className="flex items-center gap-2">
          <SaveIndicator state={saveState} t={t} onReload={() => setReloadKey((value) => value + 1)} />
          <button
            type="button"
            onClick={() => void createSnapshot()}
            disabled={snapshotBusy || saveState !== "saved"}
            className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[11px] font-semibold text-paper transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-35"
          >
            {snapshotBusy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {snapshotVersion ? t("versionSaved", { version: snapshotVersion }) : t("saveVersion")}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(270px,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <ContinuousProxyPlayer
            timeline={timeline}
            renderSpec={renderSpec}
            assets={workspace.assets}
            labels={{
            play: t("play"),
            pause: t("pause"),
            previewMissing: t("previewMissing"),
            }}
          />
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

        <div className="space-y-3">
          {[...edl.segments]
            .sort((left, right) => left.order - right.order)
            .map((segment, index) => (
              <SegmentEditor
                key={segment.id}
                segment={segment}
                index={index}
                count={edl.segments.length}
                words={workspace.words}
                proxy={workspace.proxies.find((item) => item.segmentId === segment.id)}
                labels={{
                  segment: t("segment", { number: index + 1 }),
                  source: t("sourceRange"),
                  start: t("start"),
                  end: t("end"),
                  previousWord: t("previousWord"),
                  nextWord: t("nextWord"),
                  moveEarlier: t("moveEarlier"),
                  moveLater: t("moveLater"),
                  remove: t("remove"),
                  insideHandles: t("insideHandles"),
                  outsideHandles: t("outsideHandles"),
                }}
                onBoundary={updateBoundary}
                onStep={stepBoundary}
                onMove={moveSegment}
                onRemove={removeSegment}
              />
            ))}
          <VideoStyleControls
            projectId={projectId}
            edl={edl}
            renderSpec={renderSpec}
            assets={workspace.assets}
            onChange={updateRenderSpec}
            onAssetsChange={(assets) => setWorkspace((current) => current ? { ...current, assets } : current)}
          />
          <FinalRenderPanel
            projectId={projectId}
            candidateId={candidateId}
            revision={revision}
            disabled={saveState !== "saved"}
            onConflict={() => setSaveState("conflict")}
          />
        </div>
      </div>
    </section>
  );
}

function SegmentEditor({
  segment,
  index,
  count,
  words,
  proxy,
  labels,
  onBoundary,
  onStep,
  onMove,
  onRemove,
}: {
  segment: EdlSegment;
  index: number;
  count: number;
  words: TranscriptWordBoundary[];
  proxy: EditorWorkspace["proxies"][number] | undefined;
  labels: Record<string, string>;
  onBoundary: (id: string, boundary: "start" | "end", valueMs: number) => void;
  onStep: (segment: EdlSegment, boundary: "start" | "end", direction: -1 | 1) => void;
  onMove: (id: string, direction: -1 | 1) => void;
  onRemove: (id: string) => void;
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
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">{labels.segment}</p>
          <p className="mt-1 text-[12px] text-ink/60">
            {labels.source} · {formatTimestamp(segment.sourceStartMs)}–{formatTimestamp(segment.sourceEndMs)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <IconButton label={labels.moveEarlier} disabled={index === 0} onClick={() => onMove(segment.id, -1)}><ChevronUp size={14} /></IconButton>
          <IconButton label={labels.moveLater} disabled={index === count - 1} onClick={() => onMove(segment.id, 1)}><ChevronDown size={14} /></IconButton>
          <IconButton label={labels.remove} disabled={count === 1} onClick={() => onRemove(segment.id)}><Trash2 size={14} /></IconButton>
        </div>
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
      <p className={`mt-3 text-[10px] font-medium ${insideHandles ? "text-emerald-700" : "text-amber-700"}`}>
        {insideHandles ? labels.insideHandles : labels.outsideHandles}
      </p>
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
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink/45">{label}</span>
      <div className="mt-1 flex items-stretch overflow-hidden rounded-lg border border-line bg-paper">
        <button type="button" onClick={onPrevious} aria-label={previousLabel} title={previousLabel} className="px-2 text-ink/45 transition hover:bg-ink/5 hover:text-ink"><SkipBack size={13} /></button>
        <input
          type="number"
          min={0}
          step={0.001}
          value={(valueMs / 1000).toFixed(3)}
          onChange={(event) => onChange(Math.round(Number(event.target.value) * 1000))}
          className="min-w-0 flex-1 border-x border-line bg-transparent px-2 py-2 font-mono text-[11px] tabular-nums text-ink outline-none focus:bg-card"
        />
        <button type="button" onClick={onNext} aria-label={nextLabel} title={nextLabel} className="px-2 text-ink/45 transition hover:bg-ink/5 hover:text-ink"><SkipForward size={13} /></button>
      </div>
    </label>
  );
}

function ContinuousProxyPlayer({
  timeline,
  renderSpec,
  assets,
  labels,
}: {
  timeline: TimelineSegment[];
  renderSpec: RenderSpec;
  assets: EditorWorkspace["assets"];
  labels: { play: string; pause: string; previewMissing: string };
}) {
  const videos = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)];
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeSlot, setActiveSlot] = useState<0 | 1>(0);
  const [timelineMs, setTimelineMs] = useState(0);
  const [sourceMs, setSourceMs] = useState(timeline[0]?.sourceStartMs ?? 0);
  const [playing, setPlaying] = useState(false);
  const [videoDimensions, setVideoDimensions] = useState<Array<{
    width: number;
    height: number;
  } | null>>([null, null]);
  const switchingRef = useRef(false);
  const durationMs = timelineDurationMs(timeline);
  const activeSegment = timeline[activeIndex];
  const activeCrop = activeSegment
    ? renderSpec.segments[activeSegment.id]?.crop
    : undefined;
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
    if (switchingRef.current) return;
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
    if (slot !== activeSlot) return;
    const video = videos[slot].current;
    const segment = timeline[activeIndex];
    if (!video || !segment) return;
    const sourceMs = segment.proxySourceStartMs + video.currentTime * 1000;
    setSourceMs(sourceMs);
    const nextTimelineMs = segment.timelineStartMs + sourceMs - segment.sourceStartMs;
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
    if (timelineMs >= durationMs) {
      seekTimeline(0);
      setPlaying(true);
      return;
    }
    void video.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  };

  if (timeline.length === 0) {
    return <div className="grid aspect-[9/16] max-h-[620px] place-items-center rounded-xl bg-ink px-6 text-center text-[12px] text-paper/55">{labels.previewMissing}</div>;
  }
  const mediaStyle = (slot: 0 | 1) => {
    const dimensions = videoDimensions[slot];
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
    <div className="relative mx-auto aspect-[9/16] max-h-[620px] overflow-hidden rounded-xl bg-black [container-type:inline-size] shadow-[0_20px_60px_-30px_rgba(0,0,0,0.75)]">
      <video
        ref={videos[0]}
        src={timeline[slot0Index]?.proxyUrl}
        preload={slot0Index === activeIndex ? "auto" : "metadata"}
        playsInline
        onLoadedMetadata={() => onLoadedMetadata(0)}
        onTimeUpdate={() => onTimeUpdate(0)}
        onEnded={advance}
        style={mediaStyle(0)}
        className={`absolute object-fill ${activeSlot === 0 ? "opacity-100" : "opacity-0"}`}
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
        className={`absolute object-fill ${activeSlot === 1 ? "opacity-100" : "opacity-0"}`}
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
        onClick={toggle}
        aria-label={playing ? labels.pause : labels.play}
        className="absolute inset-0 m-auto grid size-14 place-items-center rounded-full border border-white/30 bg-black/55 text-white backdrop-blur transition hover:scale-105 hover:bg-black/75"
      >
        {playing ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" className="translate-x-0.5" />}
      </button>
      <div className="absolute inset-x-3 bottom-3 rounded-lg bg-black/70 px-3 py-2 backdrop-blur">
        <input
          type="range"
          min={0}
          max={Math.max(1, durationMs)}
          step={10}
          value={Math.min(timelineMs, durationMs)}
          onChange={(event) => seekTimeline(Number(event.target.value))}
          className="w-full accent-[#ff5a1f]"
        />
        <div className="mt-1 flex justify-between font-mono text-[9px] tabular-nums text-white/65">
          <span>{formatTimestamp(timelineMs)}</span>
          <span>{formatTimestamp(durationMs)}</span>
        </div>
      </div>
    </div>
  );
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
  const cue = renderSpec.captions.cues.find((item) => (
    item.segmentId === segmentId &&
    sourceMs >= item.sourceStartMs &&
    sourceMs < item.sourceEndMs
  ));
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
            fontSize: `${captionStyle.fontSize / 10.8}cqw`,
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
  state: SaveState;
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

function IconButton({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-label={label} title={label} className="grid size-8 place-items-center rounded-lg border border-line text-ink/45 transition hover:border-ink/25 hover:text-ink disabled:opacity-20">
      {children}
    </button>
  );
}

function draftSignature(edl: Edl, renderSpec: RenderSpec): string {
  return JSON.stringify({ edl, renderSpec });
}

function formatDuration(valueMs: number): string {
  const seconds = Math.round(valueMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
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
