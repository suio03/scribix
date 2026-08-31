"use client";

import { ImagePlus, Loader2, SlidersHorizontal, Type, Volume2 } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { EditorBrandAsset } from "@/lib/video-workspace/brand-assets";
import type { Edl, RenderSpec } from "@/lib/video-workspace/contracts";

export function VideoStyleControls({
  projectId,
  edl,
  renderSpec,
  assets,
  onChange,
  onAssetsChange,
}: {
  projectId: string;
  edl: Edl;
  renderSpec: RenderSpec;
  assets: EditorBrandAsset[];
  onChange: (next: RenderSpec) => void;
  onAssetsChange: (assets: EditorBrandAsset[]) => void;
}) {
  const t = useTranslations("Dashboard.videoCandidates.editor.style");
  const [uploading, setUploading] = useState<"logo" | "font" | null>(null);
  const [uploadError, setUploadError] = useState(false);

  const uploadAsset = async (kind: "logo" | "font", file: File | undefined) => {
    if (!file || uploading) return;
    setUploading(kind);
    setUploadError(false);
    try {
      const mimeType = file.type || (kind === "font"
        ? file.name.toLowerCase().endsWith(".otf") ? "font/otf" : "font/ttf"
        : "");
      const init = await fetch(`/api/video-projects/${projectId}/brand-assets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind, mimeType, bytes: file.size }),
      });
      const upload = await init.json() as { assetId?: string; uploadUrl?: string };
      if (!init.ok || !upload.assetId || !upload.uploadUrl) throw new Error("asset_init_failed");
      const put = await fetch(upload.uploadUrl, {
        method: "PUT",
        headers: { "content-type": mimeType },
        body: file,
      });
      if (!put.ok) throw new Error("asset_upload_failed");
      const complete = await fetch(
        `/api/video-projects/${projectId}/brand-assets/${upload.assetId}`,
        { method: "POST" }
      );
      if (!complete.ok) throw new Error("asset_complete_failed");
      const list = await fetch(`/api/video-projects/${projectId}/brand-assets`);
      const payload = await list.json() as { assets?: EditorBrandAsset[] };
      if (!list.ok || !payload.assets) throw new Error("asset_list_failed");
      onAssetsChange(payload.assets);
      onChange({
        ...renderSpec,
        ...(kind === "logo"
          ? {
              brand: {
                ...renderSpec.brand,
                templateId: renderSpec.brand.templateId ?? "corner-v1",
                logoAssetId: upload.assetId,
              },
            }
          : {
              captions: { ...renderSpec.captions, fontAssetId: upload.assetId },
            }),
      });
    } catch {
      setUploadError(true);
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="space-y-3">
      <ControlSection icon={<SlidersHorizontal size={13} />} title={t("framing.title")} open>
        <div className="space-y-4">
          {[...edl.segments].sort((a, b) => a.order - b.order).map((segment, index) => {
            const crop = renderSpec.segments[segment.id].crop;
            return (
              <div key={segment.id} className="rounded-lg border border-line bg-paper/65 p-3">
                <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.12em] text-ink/45">
                  {t("framing.cut", { number: index + 1 })}
                </p>
                <ControlRange label={t("framing.horizontal")} min={0} max={1} step={0.01} value={crop.x} display={`${Math.round(crop.x * 100)}%`} onChange={(x) => onChange({ ...renderSpec, segments: { ...renderSpec.segments, [segment.id]: { crop: { ...crop, x } } } })} />
                <ControlRange label={t("framing.vertical")} min={0} max={1} step={0.01} value={crop.y} display={`${Math.round(crop.y * 100)}%`} onChange={(y) => onChange({ ...renderSpec, segments: { ...renderSpec.segments, [segment.id]: { crop: { ...crop, y } } } })} />
                <ControlRange label={t("framing.zoom")} min={1} max={4} step={0.05} value={crop.zoom} display={`${crop.zoom.toFixed(2)}×`} onChange={(zoom) => onChange({ ...renderSpec, segments: { ...renderSpec.segments, [segment.id]: { crop: { ...crop, zoom } } } })} />
              </div>
            );
          })}
        </div>
      </ControlSection>

      <ControlSection icon={<Type size={13} />} title={t("captions.title")} open>
        <div className="grid gap-3 sm:grid-cols-2">
          <ControlSelect label={t("captions.template")} value={renderSpec.captions.templateId} options={[
            ["karaoke-v1", t("captions.karaoke")],
            ["boxed-v1", t("captions.boxed")],
            ["minimal-v1", t("captions.minimal")],
          ]} onChange={(templateId) => onChange({ ...renderSpec, captions: { ...renderSpec.captions, templateId: templateId as RenderSpec["captions"]["templateId"] } })} />
          <ControlSelect label={t("captions.font")} value={renderSpec.captions.fontAssetId ?? ""} options={[["", t("captions.defaultFont")], ...assets.filter((asset) => asset.kind === "font").map((asset, index) => [asset.id, t("captions.customFont", { number: index + 1 })] as [string, string])]} onChange={(fontAssetId) => onChange({ ...renderSpec, captions: { ...renderSpec.captions, fontAssetId: fontAssetId || null } })} />
          <ColorControl label={t("captions.textColor")} value={renderSpec.captions.textColor} onChange={(textColor) => onChange({ ...renderSpec, captions: { ...renderSpec.captions, textColor } })} />
          <ColorControl label={t("captions.highlightColor")} value={renderSpec.captions.highlightColor} onChange={(highlightColor) => onChange({ ...renderSpec, captions: { ...renderSpec.captions, highlightColor } })} />
        </div>
        <div className="mt-3">
          <ControlRange label={t("captions.position")} min={0.2} max={0.86} step={0.01} value={renderSpec.captions.positionY} display={`${Math.round(renderSpec.captions.positionY * 100)}%`} onChange={(positionY) => onChange({ ...renderSpec, captions: { ...renderSpec.captions, positionY } })} />
          <ControlRange label={t("captions.lineWidth")} min={8} max={42} step={1} value={renderSpec.captions.maxCharsPerLine} display={String(renderSpec.captions.maxCharsPerLine)} onChange={(maxCharsPerLine) => onChange({ ...renderSpec, captions: { ...renderSpec.captions, maxCharsPerLine } })} />
          <ControlRange label={t("captions.lines")} min={1} max={3} step={1} value={renderSpec.captions.maxLines} display={String(renderSpec.captions.maxLines)} onChange={(maxLines) => onChange({ ...renderSpec, captions: { ...renderSpec.captions, maxLines } })} />
        </div>
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2 text-[11px] text-ink/60 transition hover:border-ink/25">
          {uploading === "font" ? <Loader2 size={13} className="animate-spin" /> : <Type size={13} />}
          {t("captions.uploadFont")}
          <input type="file" accept=".ttf,.otf,font/ttf,font/otf" className="sr-only" onChange={(event) => void uploadAsset("font", event.target.files?.[0])} />
        </label>
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink/45">{t("captions.correction")}</p>
          {renderSpec.captions.cues.map((cue, index) => (
            <label key={cue.id} className="block">
              <span className="sr-only">{t("captions.cue", { number: index + 1 })}</span>
              <input
                value={cue.words.map((word) => word.text).join(" ")}
                maxLength={400}
                onChange={(event) => onChange({ ...renderSpec, captions: { ...renderSpec.captions, cues: renderSpec.captions.cues.map((item) => item.id === cue.id ? { ...item, words: redistributeCueWords(item, event.target.value) } : item) } })}
                className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-[11px] leading-5 text-ink outline-none transition focus:border-ink/30 focus:bg-card"
              />
            </label>
          ))}
        </div>
      </ControlSection>

      <ControlSection icon={<ImagePlus size={13} />} title={t("brand.title")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <ControlSelect label={t("brand.template")} value={renderSpec.brand.templateId ?? ""} options={[["", t("brand.none")], ["corner-v1", t("brand.corner")], ["signature-v1", t("brand.signature")]]} onChange={(templateId) => onChange({ ...renderSpec, brand: { ...renderSpec.brand, templateId: (templateId || null) as RenderSpec["brand"]["templateId"] } })} />
          <ControlSelect label={t("brand.logo")} value={renderSpec.brand.logoAssetId ?? ""} options={[["", t("brand.noLogo")], ...assets.filter((asset) => asset.kind === "logo").map((asset, index) => [asset.id, t("brand.customLogo", { number: index + 1 })] as [string, string])]} onChange={(logoAssetId) => onChange({ ...renderSpec, brand: { ...renderSpec.brand, logoAssetId: logoAssetId || null } })} />
          <ColorControl label={t("brand.accent")} value={renderSpec.brand.accentColor} onChange={(accentColor) => onChange({ ...renderSpec, brand: { ...renderSpec.brand, accentColor } })} />
          <ControlSelect label={t("brand.position")} value={renderSpec.brand.logoPosition} options={[["top-left", t("brand.topLeft")], ["top-right", t("brand.topRight")], ["bottom-left", t("brand.bottomLeft")], ["bottom-right", t("brand.bottomRight")]]} onChange={(logoPosition) => onChange({ ...renderSpec, brand: { ...renderSpec.brand, logoPosition: logoPosition as RenderSpec["brand"]["logoPosition"] } })} />
        </div>
        <div className="mt-3"><ControlRange label={t("brand.scale")} min={0.05} max={0.4} step={0.01} value={renderSpec.brand.logoScale} display={`${Math.round(renderSpec.brand.logoScale * 100)}%`} onChange={(logoScale) => onChange({ ...renderSpec, brand: { ...renderSpec.brand, logoScale } })} /></div>
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2 text-[11px] text-ink/60 transition hover:border-ink/25">
          {uploading === "logo" ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
          {t("brand.uploadLogo")}
          <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => void uploadAsset("logo", event.target.files?.[0])} />
        </label>
      </ControlSection>

      <ControlSection icon={<Volume2 size={13} />} title={t("audio.title")}>
        <ControlRange label={t("audio.gain")} min={-24} max={24} step={1} value={renderSpec.audio.gainDb} display={`${renderSpec.audio.gainDb > 0 ? "+" : ""}${renderSpec.audio.gainDb} dB`} onChange={(gainDb) => onChange({ ...renderSpec, audio: { ...renderSpec.audio, gainDb } })} />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <NumberControl label={t("audio.fadeIn")} value={renderSpec.audio.fadeInMs} min={0} max={10000} step={50} onChange={(fadeInMs) => onChange({ ...renderSpec, audio: { ...renderSpec.audio, fadeInMs } })} />
          <NumberControl label={t("audio.fadeOut")} value={renderSpec.audio.fadeOutMs} min={0} max={10000} step={50} onChange={(fadeOutMs) => onChange({ ...renderSpec, audio: { ...renderSpec.audio, fadeOutMs } })} />
        </div>
        <label className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-ink/60">
          <input type="checkbox" checked={renderSpec.audio.normalize} onChange={(event) => onChange({ ...renderSpec, audio: { ...renderSpec.audio, normalize: event.target.checked } })} className="mt-1 accent-[#bd5738]" />
          <span>{t("audio.normalize")}<small className="block text-[10px] text-ink/40">{t("audio.normalizeNote")}</small></span>
        </label>
      </ControlSection>

      <ControlSection icon={<ImagePlus size={13} />} title={t("cover.title")}>
        <ControlRange label={t("cover.time")} min={0} max={Math.max(0, edl.segments.reduce((total, segment) => total + segment.sourceEndMs - segment.sourceStartMs, 0) - 1)} step={10} value={renderSpec.coverTimelineMs} display={`${(renderSpec.coverTimelineMs / 1000).toFixed(2)}s`} onChange={(coverTimelineMs) => onChange({ ...renderSpec, coverTimelineMs })} />
        <p className="mt-2 text-[10px] leading-4 text-ink/45">{t("cover.note")}</p>
      </ControlSection>

      {uploadError ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">{t("uploadFailed")}</p> : null}
    </div>
  );
}

function ControlSection({ children, icon, title, open = false }: { children: React.ReactNode; icon: React.ReactNode; title: string; open?: boolean }) {
  return <details open={open} className="group rounded-xl border border-line bg-card"><summary className="flex items-center gap-2 px-4 py-3 text-[11px] font-semibold text-ink"><span className="text-accent">{icon}</span>{title}<span className="ml-auto text-ink/30 transition group-open:rotate-45">+</span></summary><div className="border-t border-line px-4 py-4">{children}</div></details>;
}

function ControlRange({ label, min, max, step, value, display, onChange }: { label: string; min: number; max: number; step: number; value: number; display: string; onChange: (value: number) => void }) {
  return <label className="mt-2 block first:mt-0"><span className="flex justify-between text-[10px] text-ink/50"><span>{label}</span><span className="font-mono tabular-nums">{display}</span></span><input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 w-full accent-[#bd5738]" /></label>;
}

function ControlSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<[string, string]>; onChange: (value: string) => void }) {
  return <label className="block"><span className="text-[10px] text-ink/50">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-[11px] text-ink outline-none focus:border-ink/30">{options.map(([option, name]) => <option key={option} value={option}>{name}</option>)}</select></label>;
}

function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="text-[10px] text-ink/50">{label}</span><span className="mt-1 flex items-center gap-2 rounded-lg border border-line bg-paper px-2 py-1.5"><input type="color" value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} className="size-6 border-0 bg-transparent" /><span className="font-mono text-[10px]">{value}</span></span></label>;
}

function NumberControl({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <label className="block"><span className="text-[10px] text-ink/50">{label}</span><input type="number" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value))))} className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 font-mono text-[11px] text-ink outline-none focus:border-ink/30" /></label>;
}

function redistributeCueWords(cue: RenderSpec["captions"]["cues"][number], text: string): RenderSpec["captions"]["cues"][number]["words"] {
  const tokens = text.trim().split(/\s+/u).filter(Boolean).slice(0, 20);
  if (tokens.length === 0) return cue.words;
  const durationMs = cue.sourceEndMs - cue.sourceStartMs;
  return tokens.map((token, index) => ({
    text: token.slice(0, 80),
    sourceStartMs: cue.sourceStartMs + Math.floor((durationMs * index) / tokens.length),
    sourceEndMs: cue.sourceStartMs + Math.floor((durationMs * (index + 1)) / tokens.length),
  }));
}
