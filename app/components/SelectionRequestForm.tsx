"use client";
import { useTranslations } from "next-intl";
import { SELECTION_KINDS, SELECTION_TOPIC_LIMIT, type SelectionRequirements, type SelectionState } from "@/lib/video-workspace/selection";
export function SelectionRequestForm({ requirements, selection, unsupported, onChange, onStart }: {
  requirements: SelectionRequirements; selection: SelectionState | null; unsupported: boolean;
  onChange: (requirements: SelectionRequirements) => void; onStart: () => void;
}) {
  const ts = useTranslations("Dashboard.videoCandidates.selection");
  return (
        <div className="mt-6 rounded-2xl border border-line bg-card p-5">
          <fieldset disabled={selection?.outcome === "failed" || (selection?.outcome === "empty" && !selection.adjustmentsRemaining)}>
            <legend className="font-display text-lg font-semibold">{ts("title")}</legend>
            <div className="mt-4 flex flex-wrap gap-4">
              {(["auto", "specific"] as const).map(mode => <label key={mode} className="flex items-center gap-2"><input type="radio" name="selection-mode" checked={requirements.mode === mode} onChange={() => onChange({ ...requirements, mode })} />{ts(mode)}</label>)}
            </div>
            {requirements.mode === "specific" ? <div className="mt-4 space-y-3">
              <label className="block text-sm">{ts("topic")}<textarea value={requirements.topic} onChange={event => onChange({ ...requirements, topic: Array.from(event.target.value).slice(0, SELECTION_TOPIC_LIMIT).join("") })} placeholder={ts("example")} rows={3} className="mt-2 block w-full rounded-xl border border-line bg-paper p-3 text-ink" /></label>
              <label className="block text-sm">{ts("kind")}<select value={requirements.kind} onChange={event => onChange({ ...requirements, kind: event.target.value as SelectionRequirements["kind"] })} className="ml-3 rounded-lg border border-line bg-paper p-2">{SELECTION_KINDS.map(kind => <option key={kind} value={kind}>{ts(`kinds.${kind}`)}</option>)}</select></label>
            </div> : null}
          </fieldset>
          <p className="mt-3 text-sm text-ink/60">{ts("scope")}</p>
          {unsupported ? <p role="alert" className="mt-3 text-sm text-red-600">{ts("unsupported")}</p> : null}
          {selection?.outcome === "empty" ? <p role="status" className="mt-3 text-sm">{ts(selection.adjustmentsRemaining ? "empty" : "exhausted")}</p> : null}
          {selection?.outcome !== "empty" || selection.adjustmentsRemaining ? <button type="button" onClick={onStart} className="mt-4 rounded-xl bg-accent px-5 py-3 font-semibold text-white">{ts(selection?.outcome === "failed" ? "retry" : "start")}</button> : null}
        </div>
  );
}
