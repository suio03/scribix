"use client";
import { useTranslations } from "next-intl";
import type { RenderSpec, TitleOverlay } from "@/lib/video-workspace/contracts";
import { PUBLISH_LIMITS, type PublishDraft } from "@/lib/video-workspace/publish";

export function PublishPreparation({ draft, spec, busy, onDraft, onSpec, onGenerate, section }: {
  draft: PublishDraft | null; spec: RenderSpec; busy: boolean;
  onDraft: (draft: PublishDraft) => void; onSpec: (spec: RenderSpec) => void;
  onGenerate: (mode: "titles" | "copy") => void;
  section: "openingTitle" | "coverTitle";
}) {
  const t = useTranslations("Dashboard.videoCandidates.publish");
  const inputClass = "mt-2 block w-full min-w-0 rounded-lg border border-line bg-paper p-3 text-sm text-ink";
  const buttonClass = "rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-40";
  const overlay = (key: "openingTitle" | "coverTitle", update: Partial<TitleOverlay>) => {
    onSpec({ ...spec, [key]: { enabled: false, text: "", durationMs: 3000, fontScale: 1, positionY: 0.22, color: "#FFFFFF", ...spec[key], ...update } });
    if (draft) onDraft({ ...draft, edited: { ...draft.edited, [key === "openingTitle" ? "opening" : "cover"]: true } });
  };
  return <section className="space-y-4">

    {[section].map(key => <div key={key} className="rounded-xl border border-line p-4">
      <label className="text-sm font-medium">{t(key)}<input value={spec[key]?.text ?? ""} onChange={e => overlay(key, { text: Array.from(e.target.value).slice(0, PUBLISH_LIMITS.title).join("") })} className={inputClass} /></label>
      <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" aria-label={`${t(key)}: ${t("show")}`} checked={spec[key]?.enabled ?? false} onChange={e => overlay(key, { enabled: e.target.checked })} />{t("show")}</label>
      {key === "openingTitle" ? <div className="mt-3 flex flex-wrap gap-2">{(draft?.titles ?? []).map((title, i) => <button type="button" key={i} className={buttonClass} onClick={() => overlay(key, { text: title, enabled: true })}>{title}</button>)}<button disabled={busy} type="button" className={buttonClass} onClick={() => onGenerate("titles")}>{t("regenerateTitles")}</button></div> : null}
      <details className="mt-3 text-sm"><summary aria-label={`${t(key)}: ${t("style")}`} className="cursor-pointer">{t("style")}</summary><div className="mt-3 grid grid-cols-2 gap-3">
        <label>{t("size")}<input aria-label={t("size")} type="range" min="0.6" max="1.5" step="0.05" value={spec[key]?.fontScale ?? 1} onChange={e => overlay(key, { fontScale: Number(e.target.value) })} className="block w-full" /></label>
        <label>{t("position")}<input aria-label={t("position")} type="range" min="0.1" max="0.9" step="0.01" value={spec[key]?.positionY ?? 0.22} onChange={e => overlay(key, { positionY: Number(e.target.value) })} className="block w-full" /></label>
        <label>{t("color")}<input aria-label={t("color")} type="color" value={spec[key]?.color ?? "#FFFFFF"} onChange={e => overlay(key, { color: e.target.value })} className="ml-2" /></label>
        {key === "openingTitle" ? <label>{t("duration")}<input aria-label={t("duration")} type="number" min="0.5" max="10" step="0.5" value={(spec[key]?.durationMs ?? 3000) / 1000} onChange={e => overlay(key, { durationMs: Math.max(500, Math.min(10000, Number(e.target.value) * 1000)) })} className={inputClass} /></label> : null}
      </div></details>
    </div>)}
  </section>;
}
