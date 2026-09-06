"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { browserCropStyle, coverCropBox, fullFrameZoom } from "@/lib/video-workspace/presentation";
import { framingAt } from "@/lib/video-workspace/auto-framing";
import { applyFramingSections, framingSections, moveFramingBoundary, mergeFramingSection, splitFramingSection, type FramingSection } from "@/lib/video-workspace/framing-sections";
import { CROP_ZOOM_LIMITS, FINAL_VIDEO_PRESET, VIDEO_WORKSPACE_LIMITS, type CropSpec, type RenderSpec } from "@/lib/video-workspace/contracts";
import { timelineSegmentAt, timelineDurationMs, type TimelineSegment } from "@/lib/video-workspace/timeline";

const stamp = (ms: number) => {
  const rounded = Math.round(ms / 100) * 100;
  return `${Math.floor(rounded / 60000)}:${String(Math.floor(rounded / 1000) % 60).padStart(2, "0")}${rounded % 1000 ? `.${rounded % 1000 / 100}` : ""}`;
};
const clamp = (n: number, min = 0, max = 1) => Math.max(min, Math.min(max, n));

export function ManualFramingEditor({ timeline, spec, timeMs, playing, onSeek, onSectionChange, onPreview, onApply, onCancel }: {
  timeline: TimelineSegment[]; spec: RenderSpec; timeMs: number; playing: boolean;
  onSectionChange: (section: { start: number; end: number; number: number } | null) => void;
  onSeek: (time: number) => void; onPreview: (spec: RenderSpec) => void;
  onApply: (spec: RenderSpec) => void; onCancel: () => void;
}) {
  const t = useTranslations("Dashboard.videoCandidates.editor.style.visual");
  const duration = timelineDurationMs(timeline);
  const [sections, setSections] = useState(() => framingSections(timeline, spec));
  const [history, setHistory] = useState<FramingSection[][]>([]);
  const edit = (next: FramingSection[], remember = true) => {
    if (next === sections) return;
    if (remember) setHistory(h => [...h.slice(-49), sections]);
    setSections(next);
  };
  const selectedIndex = Math.max(0, sections.findIndex(s => timeMs >= s.start && timeMs < s.end));
  const selected = timeMs >= duration ? sections[sections.length - 1] : sections[selectedIndex];
  const { start, end } = selected;
  const currentIndex = sections.indexOf(selected);
  const mergePrevious = sections[currentIndex - 1]?.segmentId === selected.segmentId;
  const canMerge = mergePrevious || sections[currentIndex + 1]?.segmentId === selected.segmentId;
  useEffect(() => {
    onSectionChange({ start, end, number: sections.indexOf(selected) + 1 });
  }, [start, end, selectedIndex, sections.length, onSectionChange]);
  useEffect(() => () => onSectionChange(null), [onSectionChange]);
  const sourceSegment = timeline.find(s => s.id === selected.segmentId)!;
  const resolved = framingAt({ ...spec.segments[selected.segmentId], framingMode: selected.mode, crop: selected.crop, framingRanges: [] }, sourceSegment.sourceStartMs + Math.max(start, Math.min(timeMs, end - 1)) - sourceSegment.timelineStartMs);
  const [dimensions, setDimensions] = useState({ width: 16, height: 9 });
  const crop = resolved.framingMode === "fit" ? { x: 0.5, y: 0.5, zoom: Math.max(CROP_ZOOM_LIMITS.min, fullFrameZoom(dimensions.width, dimensions.height)) } : resolved.crop;
  const setCrop = (value: CropSpec, remember = true) => edit(sections.map(s => s.id === selected.id ? { ...s, mode: "fill", crop: value } : s), remember);
  const splitTime = Math.round(timeMs / 100) * 100;
  const canSplit = sections.some(s => splitTime >= s.start + 100 && splitTime <= s.end - 100);
  const video = useRef<HTMLVideoElement>(null);
  const surface = useRef<HTMLDivElement>(null);
  const position = timelineSegmentAt(timeline, timeMs)!;
  const drag = useRef<{ pointer: number; x: number; y: number; width: number; height: number; crop: CropSpec } | null>(null);
  const box = coverCropBox(dimensions.width, dimensions.height, crop);
  const draft = useMemo(() => {
    const next = applyFramingSections(timeline, spec, sections);
    return Object.values(next.segments).some(s => (s.framingRanges?.length ?? 0) > VIDEO_WORKSPACE_LIMITS.maxFramingRangesPerSegment) ? null : next;
  }, [spec, timeline, sections]);
  useEffect(() => { if (draft) onPreview(draft); }, [draft, onPreview]);

  const sync = () => {
    const element = video.current;
    if (!element || !Number.isFinite(element.duration)) return;
    const target = (position.segment.proxyStartMs + position.localMs) / 1000;
    if (Math.abs(element.currentTime - target) > 0.15) element.currentTime = target;
    setDimensions({ width: element.videoWidth || 16, height: element.videoHeight || 9 });
  };
  useEffect(() => { sync(); }, [timeMs, position.segment.proxyUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (playing) void video.current?.play().catch(() => {});
    else video.current?.pause();
  }, [playing, position.segment.proxyUrl]);

  const setBoundary = (index: number, time: number) => {
    const next = moveFramingBoundary(sections, index, time);
    edit(next);
    onSeek(next[index].start);
  };
  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (timeMs < start || timeMs >= end) onSeek(start);
    onSeek(Math.max(start, Math.min(timeMs, end - 1)));
    setHistory(h => [...h.slice(-49), sections]);
    const rect = surface.current!.getBoundingClientRect();
    drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, width: rect.width, height: rect.height, crop };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || event.pointerId !== state.pointer) return;
    const originalBox = coverCropBox(dimensions.width, dimensions.height, state.crop);
    const dx = (event.clientX - state.x) / state.width * FINAL_VIDEO_PRESET.width;
    const dy = (event.clientY - state.y) / state.height * FINAL_VIDEO_PRESET.height;
    const excessX = originalBox.width - FINAL_VIDEO_PRESET.width;
    const excessY = originalBox.height - FINAL_VIDEO_PRESET.height;
    setCrop({ ...state.crop,
      x: Math.abs(excessX) < 1 ? state.crop.x : clamp(state.crop.x - dx / excessX),
      y: Math.abs(excessY) < 1 ? state.crop.y : clamp(state.crop.y - dy / excessY),
    }, false);
  };
  const release = (event: React.PointerEvent<HTMLDivElement>) => { drag.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); };
  return <div className="space-y-4">
    <div><h6 className="font-semibold">{t("manual")}</h6><p className="mt-1 text-xs leading-5 text-ink/60">{t("dragHelp")}</p></div>
    <div ref={surface} className="relative mx-auto h-64 aspect-[9/16] overflow-hidden rounded-xl" style={{ backgroundColor: spec.canvas.backgroundColor }}>
      <video ref={video} src={position.segment.proxyUrl} muted playsInline preload="auto" onLoadedMetadata={sync} style={browserCropStyle(box)} className="absolute max-w-none" />
      <div tabIndex={0} role="group" aria-label={t("cropBox")} onPointerDown={startDrag} onPointerMove={move} onPointerUp={release} onPointerCancel={release}
        onKeyDown={event => {
          const axis = event.key === "ArrowLeft" || event.key === "ArrowRight" ? "x" : "y";
          if (!event.key.startsWith("Arrow")) return;
          event.preventDefault(); if (timeMs < start || timeMs >= end) onSeek(start);
          const excess = axis === "x" ? box.width - FINAL_VIDEO_PRESET.width : box.height - FINAL_VIDEO_PRESET.height;
          if (Math.abs(excess) >= 1) setCrop({ ...crop, [axis]: clamp(crop[axis] + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? 1 : -1) * Math.sign(excess) * 0.02) });
        }}
        className="absolute inset-0 touch-none cursor-move border-2 border-white/50 outline-none focus-visible:border-accent">
        <div className="pointer-events-none absolute inset-x-1/3 inset-y-0 border-x border-white/15" /><div className="pointer-events-none absolute inset-x-0 inset-y-1/3 border-y border-white/15" />
      </div>
    </div>
    <label className="flex items-center gap-3 text-xs">{t("zoom")}<input type="range" min={CROP_ZOOM_LIMITS.min} max={CROP_ZOOM_LIMITS.max} step={0.01} value={crop.zoom} onChange={event => { onSeek(Math.max(start, Math.min(timeMs, end - 1))); setCrop({ ...crop, zoom: Number(event.target.value) }); }} className="min-w-0 flex-1 accent-[var(--accent)]" /><span>{crop.zoom.toFixed(2)}×</span></label>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => edit(sections.map(s => s.id === selected.id ? { ...s, mode: "fit", crop: { x: 0.5, y: 0.5, zoom: 1 } } : s))} className="rounded-lg border border-line px-3 py-2 text-xs">{t("fullSection")}</button>
      <button type="button" onClick={() => setCrop({ ...crop, zoom: 1 })} className="rounded-lg border border-line px-3 py-2 text-xs">{t("fillSection")}</button>
    </div>
    <div className="space-y-3 border-t border-line pt-4">
      <p className="font-medium">{t("editingSection", { start: stamp(start), end: stamp(end) })}</p>
      <div className="relative flex h-14 rounded-lg border border-line bg-paper">
        {sections.map((section, index) => <button key={section.id} type="button" aria-label={t("editingSection", { start: stamp(section.start), end: stamp(section.end) })} aria-pressed={section.id === selected.id} onClick={event => {
          const rect = event.currentTarget.getBoundingClientRect();
          const offset = event.detail === 0 ? 0 : clamp((event.clientX - rect.left) / rect.width);
          onSeek(Math.max(section.start, Math.min(section.end - 1, Math.round((section.start + offset * (section.end - section.start)) / 100) * 100)));
        }} onKeyDown={event => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          onSeek(clamp(timeMs + (event.key === "ArrowLeft" ? -100 : 100), section.start, section.end - 1));
        }} style={{ width: `${(section.end - section.start) / duration * 100}%` }} className="min-w-0 overflow-hidden border-r border-line text-xs aria-pressed:bg-accent/20 aria-pressed:text-accent">{index + 1}</button>)}
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-ink" style={{ left: `${Math.min(timeMs, duration - 1) / duration * 100}%` }} />
        {sections.slice(1).map((section, offset) => sections[offset].segmentId === section.segmentId ? <input key={section.id} aria-label={t("boundary", { number: offset + 1 })} type="range" min={0} max={duration} step={100} value={section.start} onChange={event => setBoundary(offset + 1, Number(event.target.value))} style={{ background: "transparent" }} aria-valuetext={stamp(section.start)} className="framing-range-handle pointer-events-none absolute inset-0 h-full w-full appearance-none bg-transparent" /> : null)}
      </div>
      <div className="rounded-lg border border-line bg-card p-3 space-y-2">
        <p className="text-xs font-medium">{t("playhead", { time: stamp(timeMs) })}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!canSplit || !draft} onClick={() => { edit(splitFramingSection(sections, splitTime)); onSeek(splitTime); }} className="rounded-lg border border-line px-3 py-2 text-xs font-medium disabled:opacity-40">{t("splitHere", { time: stamp(splitTime) })}</button>
          {canMerge ? <button type="button" onClick={() => { const next = mergeFramingSection(sections, currentIndex); edit(next); onSeek(mergePrevious ? sections[currentIndex - 1].start : start); }} className="rounded-lg border border-line px-3 py-2 text-xs font-medium">{t(mergePrevious ? "mergePrevious" : "mergeNext")}</button> : null}
        </div>
        {!canSplit ? <p className="text-xs text-ink/60">{t("switchHelp")}</p> : null}
        {canMerge ? <p className="text-xs text-ink/60">{t("mergeHelp")}</p> : null}
      </div>
      <p className="text-xs text-ink/60">{t("sectionsHelp")}</p>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {sections.map((section, index) => <button type="button" key={section.id} aria-pressed={section.id === selected.id} onClick={() => onSeek(section.start)} className="w-24 shrink-0 rounded-lg border border-line p-1 text-left aria-pressed:border-accent aria-pressed:bg-accent/10">
          <SectionThumbnail section={section} timeline={timeline} spec={spec} />
          <span className="mt-1 block text-[10px] tabular-nums">{index + 1} · {stamp(section.start)}–{stamp(section.end)}</span>
          <span className="block text-[10px] text-ink/60">{t(section.mode === "auto" ? "autoSection" : section.mode === "fit" ? "fullSection" : "manualSection")}</span>
        </button>)}
      </div>
      <button type="button" disabled={selected.mode === "auto"} onClick={() => edit(sections.map(s => s.id === selected.id ? { ...s, mode: "auto" } : s))} className="text-xs text-accent underline disabled:opacity-40">{t("restoreSection")}</button>
    </div>
    {!draft ? <p role="alert" className="text-red-600">{t("tooMany")}</p> : null}
    <div className="flex flex-wrap gap-2"><button type="button" disabled={!draft} onClick={() => { if (draft) onApply(draft); }} className="rounded-lg bg-accent px-4 py-2 font-medium text-white disabled:opacity-50">{t("saveSections")}</button><button type="button" onClick={onCancel} className="rounded-lg border border-line px-4 py-2">{t("cancel")}</button></div>
    <button type="button" disabled={!history.length} onClick={() => { const previous = history[history.length - 1]; if (previous) { setSections(previous); setHistory(h => h.slice(0, -1)); } }} className="text-xs text-accent underline disabled:opacity-40">{t("undo")}</button>
    <p className="text-xs leading-5 text-ink/60">{t("batchHelp")}</p>
  </div>;
}

function SectionThumbnail({ section, timeline, spec }: { section: FramingSection; timeline: TimelineSegment[]; spec: RenderSpec }) {
  const video = useRef<HTMLVideoElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const position = timelineSegmentAt(timeline, section.start)!;
  const seek = () => { if (video.current && Number.isFinite(video.current.duration)) { video.current.currentTime = (position.segment.proxyStartMs + position.localMs) / 1000; setDimensions({ width: video.current.videoWidth, height: video.current.videoHeight }); } };
  useEffect(seek, [section.start, position.segment.proxyUrl]);
  const frame = framingAt({ ...spec.segments[section.segmentId], framingMode: section.mode, crop: section.crop, framingRanges: [] }, position.segment.sourceStartMs + position.localMs);
  const style = frame.framingMode === "fit" || !dimensions ? { width: "100%", height: "100%", objectFit: "contain" as const } : browserCropStyle(coverCropBox(dimensions.width, dimensions.height, frame.crop));
  return <div className="relative aspect-[9/16] overflow-hidden rounded" style={{ backgroundColor: spec.canvas.backgroundColor }}><video ref={video} src={position.segment.proxyUrl} muted playsInline preload="metadata" onLoadedMetadata={seek} style={style} className="absolute max-w-none" /></div>;
}
