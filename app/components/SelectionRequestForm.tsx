"use client";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Search, Sparkles, Wand2 } from "lucide-react";
import { SELECTION_KINDS, SELECTION_TOPIC_LIMIT, type SelectionRequirements, type SelectionState } from "@/lib/video-workspace/selection";
export function SelectionRequestForm({ requirements, selection, unsupported, onChange, onStart, children }: {
  children?: ReactNode;
  requirements: SelectionRequirements; selection: SelectionState | null; unsupported: boolean;
  onChange: (requirements: SelectionRequirements) => void; onStart: () => void;
}) {
  const ts = useTranslations("Dashboard.videoCandidates.selection");
  return (
        <div className="mt-4 rounded-card border border-line bg-card p-5 sm:p-6">
          <fieldset disabled={selection?.outcome === "failed" || (selection?.outcome === "empty" && !selection.adjustmentsRemaining)}>
            <legend className="font-display text-title font-semibold tracking-tight text-ink">{ts("title")}</legend>
            <div className="mt-4 grid gap-2 sm:grid-cols-2" role="radiogroup">
              {(["auto", "specific"] as const).map(mode => {
                const Icon = mode === "auto" ? Wand2 : Search;
                const checked = requirements.mode === mode;
                return (
                  <label key={mode} className={`flex cursor-pointer items-center gap-3 rounded-control border px-4 py-3 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-accent/40 ${checked ? "border-accent bg-accent/[0.06] text-ink" : "border-line text-ink/75 hover:border-ink/30"}`}>
                    <input type="radio" name="selection-mode" className="sr-only" checked={checked} onChange={() => onChange({ ...requirements, mode })} />
                    <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${checked ? "bg-accent text-white" : "bg-paper text-muted"}`}><Icon size={16} /></span>
                    <span className="text-body-sm font-semibold">{ts(mode)}</span>
                  </label>
                );
              })}
            </div>
            {requirements.mode === "specific" ? <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_220px]">
              <label className="block text-meta font-medium text-muted">{ts("topic")}<textarea value={requirements.topic} onChange={event => onChange({ ...requirements, topic: Array.from(event.target.value).slice(0, SELECTION_TOPIC_LIMIT).join("") })} placeholder={ts("example")} rows={3} className="mt-1.5 block w-full rounded-control border border-line bg-paper p-3 text-body-sm text-ink" /></label>
              <label className="block text-meta font-medium text-muted">{ts("kind")}<select value={requirements.kind} onChange={event => onChange({ ...requirements, kind: event.target.value as SelectionRequirements["kind"] })} className="mt-1.5 block w-full rounded-control border border-line bg-paper p-3 text-body-sm text-ink">{SELECTION_KINDS.map(kind => <option key={kind} value={kind}>{ts(`kinds.${kind}`)}</option>)}</select></label>
            </div> : null}
          </fieldset>
          {children}
          <div className="mt-6 flex flex-col-reverse gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <p className="text-meta text-muted">{ts("scope")}</p>
              {unsupported ? <p role="alert" className="text-meta text-rec">{ts("unsupported")}</p> : null}
              {selection?.outcome === "empty" ? <p role="status" className="text-meta text-ink">{ts(selection.adjustmentsRemaining ? "empty" : "exhausted")}</p> : null}
            </div>
            {selection?.outcome !== "empty" || selection.adjustmentsRemaining ? <button type="button" onClick={onStart} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-control bg-accent px-5 font-semibold text-white shadow-[0_10px_24px_-14px_var(--accent)] transition hover:bg-[var(--accent-hover)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-generated"><Sparkles size={16} />{ts(selection?.outcome === "failed" ? "retry" : "start")}</button> : null}
          </div>
        </div>
  );
}
