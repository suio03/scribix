"use client";

import { ImagePlus, Loader2, SlidersHorizontal, Trash2, Type } from "lucide-react";
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
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [assetError, setAssetError] = useState<"upload" | "remove" | null>(null);

  const uploadAsset = async (kind: "logo" | "font", file: File | undefined) => {
    if (!file || uploading) return;
    setUploading(kind);
    setAssetError(null);
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
      setAssetError("upload");
    } finally {
      setUploading(null);
    }
  };

  const removeLogo = async (assetId: string) => {
    if (deletingAssetId) return;
    setDeletingAssetId(assetId);
    setAssetError(null);
    try {
      const response = await fetch(
        `/api/video-projects/${projectId}/brand-assets/${assetId}`,
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error("asset_remove_failed");
      onAssetsChange(assets.filter((asset) => asset.id !== assetId));
      if (renderSpec.brand.logoAssetId === assetId) {
        onChange({
          ...renderSpec,
          brand: {
            ...renderSpec.brand,
            templateId: null,
            logoAssetId: null,
          },
        });
      }
    } catch {
      setAssetError("remove");
    } finally {
      setDeletingAssetId(null);
    }
  };

  const logos = assets.filter((asset) => asset.kind === "logo");

  return (
    <div className="space-y-3">
      <ControlSection icon={<SlidersHorizontal size={13} />} title={t("framing.title")}>
        <div className="space-y-4">
          {[...edl.segments].sort((a, b) => a.order - b.order).map((segment, index) => {
            const crop = renderSpec.segments[segment.id].crop;
            const automatic = crop.x === 0.5 && crop.y === 0.5 && crop.zoom === 1;
            return (
              <div key={segment.id} className="rounded-lg border border-line bg-paper/65 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-ink/45">
                    {t("framing.cut", { number: index + 1 })}
                  </p>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${automatic ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                    {t(automatic ? "framing.automatic" : "framing.manual")}
                  </span>
                </div>
                <p className="mb-3 text-[10px] leading-4 text-ink/50">
                  {t(automatic ? "framing.automaticNote" : "framing.manualNote")}
                </p>
                <ControlRange label={t("framing.horizontal")} min={0} max={1} step={0.01} value={crop.x} display={`${Math.round(crop.x * 100)}%`} onChange={(x) => onChange({ ...renderSpec, segments: { ...renderSpec.segments, [segment.id]: { crop: { ...crop, x } } } })} />
                <ControlRange label={t("framing.vertical")} min={0} max={1} step={0.01} value={crop.y} display={`${Math.round(crop.y * 100)}%`} onChange={(y) => onChange({ ...renderSpec, segments: { ...renderSpec.segments, [segment.id]: { crop: { ...crop, y } } } })} />
                <ControlRange label={t("framing.zoom")} min={1} max={4} step={0.05} value={crop.zoom} display={`${crop.zoom.toFixed(2)}×`} onChange={(zoom) => onChange({ ...renderSpec, segments: { ...renderSpec.segments, [segment.id]: { crop: { ...crop, zoom } } } })} />
                {!automatic ? (
                  <button
                    type="button"
                    onClick={() => onChange({
                      ...renderSpec,
                      segments: {
                        ...renderSpec.segments,
                        [segment.id]: { crop: { x: 0.5, y: 0.5, zoom: 1 } },
                      },
                    })}
                    className="mt-3 text-[10px] font-semibold text-accent underline decoration-accent/30 underline-offset-4"
                  >
                    {t("framing.useAutomatic")}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </ControlSection>

      <ControlSection icon={<Type size={13} />} title={t("captions.title")}>
        <label className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-line bg-paper/65 px-3 py-2.5 text-[11px] font-medium text-ink/70">
          <span>{t("captions.enabled")}</span>
          <input
            type="checkbox"
            checked={renderSpec.captions.enabled}
            onChange={(event) => onChange({
              ...renderSpec,
              captions: { ...renderSpec.captions, enabled: event.target.checked },
            })}
            className="size-4 accent-[#bd5738]"
          />
        </label>
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
        <div className="mt-4 space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink/45">{t("captions.correction")}</p>
          {renderSpec.captions.cues.map((cue, index) => (
            <label key={cue.id} className="grid gap-1.5 rounded-lg border border-line bg-paper/60 px-2.5 py-2 sm:grid-cols-[7.75rem_minmax(0,1fr)] sm:items-center sm:gap-3">
              <span className="sr-only">{t("captions.cue", { number: index + 1 })}</span>
              <span className="font-mono text-[9px] tabular-nums text-ink/45">
                {formatCueTimestamp(cue.sourceStartMs)}–{formatCueTimestamp(cue.sourceEndMs)}
              </span>
              <input
                value={cue.words.map((word) => word.text).join(" ")}
                maxLength={400}
                onChange={(event) => onChange({ ...renderSpec, captions: { ...renderSpec.captions, cues: renderSpec.captions.cues.map((item) => item.id === cue.id ? { ...item, words: redistributeCueWords(item, event.target.value) } : item) } })}
                className="min-w-0 border-0 bg-transparent px-0 py-1 text-[11px] leading-5 text-ink outline-none placeholder:text-ink/30 focus-visible:ring-0"
              />
            </label>
          ))}
        </div>
      </ControlSection>

      <details className="group rounded-xl border border-line bg-ink/[0.025]">
        <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-[11px] font-semibold text-ink">
          <span className="text-accent"><SlidersHorizontal size={13} /></span>
          {t("advanced")}
          <span className="ml-auto text-ink/30 transition group-open:rotate-45">+</span>
        </summary>
        <div className="space-y-3 border-t border-line p-3">
          <ControlSection icon={<ImagePlus size={13} />} title={t("brand.title")}>
            <div className="grid gap-3 sm:grid-cols-2">
              <ControlSelect label={t("brand.template")} value={renderSpec.brand.templateId ?? ""} options={[["", t("brand.none")], ["corner-v1", t("brand.corner")], ["signature-v1", t("brand.signature")]]} onChange={(templateId) => onChange({ ...renderSpec, brand: { ...renderSpec.brand, templateId: (templateId || null) as RenderSpec["brand"]["templateId"] } })} />
              <ControlSelect label={t("brand.logo")} value={renderSpec.brand.logoAssetId ?? ""} options={[["", t("brand.noLogo")], ...logos.map((asset, index) => [asset.id, t("brand.customLogo", { number: index + 1 })] as [string, string])]} onChange={(logoAssetId) => onChange({ ...renderSpec, brand: { ...renderSpec.brand, logoAssetId: logoAssetId || null } })} />
              <ColorControl label={t("brand.accent")} value={renderSpec.brand.accentColor} onChange={(accentColor) => onChange({ ...renderSpec, brand: { ...renderSpec.brand, accentColor } })} />
              <ControlSelect label={t("brand.position")} value={renderSpec.brand.logoPosition} options={[["top-left", t("brand.topLeft")], ["top-right", t("brand.topRight")], ["bottom-left", t("brand.bottomLeft")], ["bottom-right", t("brand.bottomRight")]]} onChange={(logoPosition) => onChange({ ...renderSpec, brand: { ...renderSpec.brand, logoPosition: logoPosition as RenderSpec["brand"]["logoPosition"] } })} />
            </div>
            <div className="mt-3"><ControlRange label={t("brand.scale")} min={0.05} max={0.4} step={0.01} value={renderSpec.brand.logoScale} display={`${Math.round(renderSpec.brand.logoScale * 100)}%`} onChange={(logoScale) => onChange({ ...renderSpec, brand: { ...renderSpec.brand, logoScale } })} /></div>
            {logos.length > 0 ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {logos.map((asset, index) => {
                  const selected = renderSpec.brand.logoAssetId === asset.id;
                  const deleting = deletingAssetId === asset.id;
                  const label = t("brand.customLogo", { number: index + 1 });
                  return (
                    <div
                      key={asset.id}
                      className={`flex items-center gap-2 rounded-lg border p-2 transition ${selected ? "border-accent/45 bg-accent/[0.06]" : "border-line bg-paper/65"}`}
                    >
                      <button
                        type="button"
                        onClick={() => onChange({
                          ...renderSpec,
                          brand: {
                            ...renderSpec.brand,
                            templateId: renderSpec.brand.templateId ?? "corner-v1",
                            logoAssetId: asset.id,
                          },
                        })}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        {/* User-provided signed URLs are intentionally rendered without image optimization. */}
                        <img src={asset.url} alt="" className="size-9 shrink-0 rounded-md border border-line bg-white object-contain p-1" />
                        <span className="min-w-0">
                          <span className="block truncate text-[10px] font-medium text-ink/70">{label}</span>
                          {selected ? <span className="block text-[9px] text-accent">{t("brand.selected")}</span> : null}
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={deletingAssetId !== null}
                        onClick={() => void removeLogo(asset.id)}
                        aria-label={t("brand.removeLogo", { name: label })}
                        title={t("brand.removeLogo", { name: label })}
                        className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1.5 text-[9px] font-medium text-ink/45 transition hover:bg-red-50 hover:text-red-700 disabled:opacity-40"
                      >
                        {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                        {t("brand.remove")}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : null}
            <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2 text-[11px] text-ink/60 transition hover:border-ink/25">
              {uploading === "logo" ? <Loader2 size={13} className="animate-spin" /> : <ImagePlus size={13} />}
              {renderSpec.brand.logoAssetId ? t("brand.replaceLogo") : t("brand.uploadLogo")}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => void uploadAsset("logo", event.target.files?.[0])} />
            </label>
          </ControlSection>

          <ControlSection icon={<ImagePlus size={13} />} title={t("cover.title")}>
            <ControlRange label={t("cover.time")} min={0} max={Math.max(0, edl.segments.reduce((total, segment) => total + segment.sourceEndMs - segment.sourceStartMs, 0) - 1)} step={10} value={renderSpec.coverTimelineMs} display={`${(renderSpec.coverTimelineMs / 1000).toFixed(2)}s`} onChange={(coverTimelineMs) => onChange({ ...renderSpec, coverTimelineMs })} />
            <p className="mt-2 text-[10px] leading-4 text-ink/45">{t("cover.note")}</p>
          </ControlSection>
        </div>
      </details>

      {assetError ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700">{t(assetError === "remove" ? "removeFailed" : "uploadFailed")}</p> : null}
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

function formatCueTimestamp(valueMs: number): string {
  const safeValueMs = Math.max(0, Math.round(valueMs));
  const totalSeconds = Math.floor(safeValueMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const tenths = Math.floor((safeValueMs % 1000) / 100);
  const prefix = hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
    : String(minutes).padStart(2, "0");
  return `${prefix}:${String(seconds).padStart(2, "0")}.${tenths}`;
}
