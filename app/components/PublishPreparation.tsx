"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { RenderSpec, TitleOverlay } from "@/lib/video-workspace/contracts";
import { PUBLISH_LIMITS, publishTags, publishText, type PublishDraft } from "@/lib/video-workspace/publish";

export function PublishPreparation({ draft, spec, stale, busy, onDraft, onSpec, onGenerate, onReviewed }: {
  draft: PublishDraft; spec: RenderSpec; stale: boolean; busy: boolean;
  onDraft: (draft: PublishDraft) => void; onSpec: (spec: RenderSpec) => void;
  onGenerate: (mode: "titles" | "copy") => void;
  onReviewed: () => void;
}) {
  const t = useTranslations("Dashboard.videoCandidates.publish");
  const [copyState, setCopyState] = useState<"copied" | "copyFailed" | null>(null);
  const inputClass = "mt-2 block w-full min-w-0 rounded-lg border border-line bg-paper p-3 text-sm text-ink";
  const buttonClass = "rounded-lg border border-line px-3 py-2 text-sm disabled:opacity-40";
  const edit = (key: "title" | "body" | "tags", value: string | string[]) => onDraft({ ...draft, [key]: value, edited: { ...draft.edited, [key]: true } });
  const overlay = (key: "openingTitle" | "coverTitle", update: Partial<TitleOverlay>) => {
    if (!spec[key]) return;
    onSpec({ ...spec, [key]: { ...spec[key], ...update } });
    onDraft({ ...draft, edited: { ...draft.edited, [key === "openingTitle" ? "opening" : "cover"]: true } });
  };
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopyState("copied"); }
    catch { setCopyState("copyFailed"); }
  };
  return <section className="mb-5 space-y-5 rounded-2xl border border-accent/20 bg-paper p-5">
    <h3 className="font-display text-lg font-semibold">{t("title")}</h3>
    {stale ? <p role="status" className="text-sm text-amber-700 dark:text-amber-200">{t("stale")} <button type="button" onClick={onReviewed} className="underline">{t("reviewed")}</button></p> : null}
    {(["openingTitle", "coverTitle"] as const).map(key => <div key={key}>
      <label className="text-sm font-medium">{t(key)}<input value={spec[key]?.text ?? ""} onChange={e => overlay(key, { text: Array.from(e.target.value).slice(0, PUBLISH_LIMITS.title).join("") })} className={inputClass} /></label>
      <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" aria-label={`${t(key)}: ${t("show")}`} checked={spec[key]?.enabled ?? false} onChange={e => overlay(key, { enabled: e.target.checked })} />{t("show")}</label>
      {key === "openingTitle" ? <div className="mt-3 flex flex-wrap gap-2">{draft.titles.map((title, i) => <button type="button" key={i} className={buttonClass} onClick={() => overlay(key, { text: title, enabled: true })}>{title}</button>)}<button disabled={busy} type="button" className={buttonClass} onClick={() => onGenerate("titles")}>{t("regenerateTitles")}</button></div> : null}
      <details className="mt-3 text-sm"><summary aria-label={`${t(key)}: ${t("style")}`} className="cursor-pointer">{t("style")}</summary><div className="mt-3 grid grid-cols-2 gap-3">
        <label>{t("size")}<input aria-label={t("size")} type="range" min="0.6" max="1.5" step="0.05" value={spec[key]?.fontScale ?? 1} onChange={e => overlay(key, { fontScale: Number(e.target.value) })} className="block w-full" /></label>
        <label>{t("position")}<input aria-label={t("position")} type="range" min="0.1" max="0.9" step="0.01" value={spec[key]?.positionY ?? 0.22} onChange={e => overlay(key, { positionY: Number(e.target.value) })} className="block w-full" /></label>
        <label>{t("color")}<input aria-label={t("color")} type="color" value={spec[key]?.color ?? "#FFFFFF"} onChange={e => overlay(key, { color: e.target.value })} className="ml-2" /></label>
        {key === "openingTitle" ? <label>{t("duration")}<input aria-label={t("duration")} type="number" min="0.5" max="10" step="0.5" value={(spec[key]?.durationMs ?? 3000) / 1000} onChange={e => overlay(key, { durationMs: Math.max(500, Math.min(10000, Number(e.target.value) * 1000)) })} className={inputClass} /></label> : null}
      </div></details>
    </div>)}
    <div className="space-y-3">
      <label className="block text-sm font-medium">{t("postTitle")}<input maxLength={PUBLISH_LIMITS.title} value={draft.title} onChange={e => edit("title", e.target.value)} className={inputClass} /></label>
      <button type="button" className={buttonClass} onClick={() => void copy(draft.title)}>{t("copyTitle")}</button>
      <label className="block text-sm font-medium">{t("body")}<textarea maxLength={PUBLISH_LIMITS.body} rows={4} value={draft.body} onChange={e => edit("body", e.target.value)} className={inputClass} /></label>
      <button type="button" className={buttonClass} onClick={() => void copy(draft.body)}>{t("copyBody")}</button>
      <label className="block text-sm font-medium">{t("tags")}<input value={draft.tags.join(", ")} onChange={e => edit("tags", e.target.value.split(",").slice(0, PUBLISH_LIMITS.tags).map(tag => tag.trim().slice(0, 80)))} className={inputClass} /></label>
      <div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} onClick={() => void copy(publishTags(draft.tags))}>{t("copyTags")}</button><button type="button" className={buttonClass} onClick={() => void copy(publishText(draft))}>{t("copyAll")}</button><button disabled={busy} type="button" className={buttonClass} onClick={() => onGenerate("copy")}>{t("regenerateCopy")}</button></div>
      <p className="text-xs text-ink/60">{t("preserved")}</p>
      {copyState ? <p role="status" className="text-sm">{t(copyState)}</p> : null}
    </div>
  </section>;
}
