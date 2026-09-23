"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

function clock(seconds: number) {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

function parseClock(text: string) {
  const parts = text.trim().split(":").map(Number);
  if (!parts.length || parts.length > 3 || !parts.every((part) => Number.isFinite(part) && part >= 0)) return NaN;
  if (parts.slice(1).some((part) => part >= 60)) return NaN;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

/** Start/end selection over the whole source, in seconds. */
export function AnalysisRangePicker({
  durationMs,
  maxRangeMs,
  start,
  end,
  invalid,
  hint,
  onChange,
}: {
  durationMs: number;
  maxRangeMs: number;
  start: number;
  end: number;
  invalid: boolean;
  hint: string;
  onChange: (start: number, end: number) => void;
}) {
  const ts = useTranslations("Dashboard.videoCandidates.selection");
  const tc = useTranslations("SourceClips");
  const duration = Math.max(1, durationMs / 1000);
  const pct = (seconds: number) => `${Math.min(100, Math.max(0, (seconds / duration) * 100))}%`;
  const length = end - start;
  // Slider steps are whole seconds; never commit past the real (fractional) source end.
  const fit = (seconds: number) => Math.min(Math.max(0, seconds), duration);
  const tooLong = length * 1000 > maxRangeMs;

  return (
    <div className="mt-4 rounded-card border border-line bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-title-sm font-semibold text-ink">{ts("analysisRange")}</h3>
        <span className={`font-mono text-meta ${tooLong || invalid ? "text-rec" : "text-muted"}`}>
          {clock(length)} / {clock(maxRangeMs / 1000)}
        </span>
      </div>

      <div className="range-handles relative mt-4 h-9">
        <div aria-hidden className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-ink/[0.07]">
          <div
            className={`absolute h-full ${tooLong || invalid ? "bg-rec/70" : "bg-accent"}`}
            style={{ left: pct(start), width: pct(Math.max(0, length)) }}
          />
        </div>
        <input
          type="range"
          aria-label={tc("start")}
          min={0}
          max={Math.ceil(duration)}
          step={1}
          value={Math.min(start, duration)}
          onChange={(event) => onChange(Math.min(fit(Number(event.target.value)), end - 1), end)}
          className="absolute inset-0 m-0 h-full w-full"
        />
        <input
          type="range"
          aria-label={tc("end")}
          min={0}
          max={Math.ceil(duration)}
          step={1}
          value={Math.min(end, duration)}
          onChange={(event) => onChange(start, fit(Math.max(Number(event.target.value), start + 1)))}
          className="absolute inset-0 m-0 h-full w-full"
        />
      </div>
      <div aria-hidden className="mt-1 flex justify-between font-mono text-caption text-muted">
        {[0, 0.25, 0.5, 0.75, 1].map((step) => <span key={step}>{clock(duration * step)}</span>)}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-sm">
        <ClockField label={tc("start")} value={start} onCommit={(value) => { const next = fit(value); onChange(next, end); return next; }} />
        <ClockField label={tc("end")} value={end} onCommit={(value) => { const next = fit(value); onChange(start, next); return next; }} />
      </div>
      <p className="mt-3 text-meta text-muted">{hint}</p>
    </div>
  );
}

function ClockField({ label, value, onCommit }: { label: string; value: number; onCommit: (seconds: number) => number }) {
  const [draft, setDraft] = useState(clock(value));
  useEffect(() => setDraft(clock(value)), [value]);
  const commit = () => {
    // Unedited text is a rounded display of the precise value; keep the original.
    if (draft === clock(value)) return;
    const parsed = parseClock(draft);
    // Show what was actually committed; a clamped value may equal the old one and not re-render.
    setDraft(clock(Number.isFinite(parsed) ? onCommit(parsed) : value));
  };
  return (
    <label className="text-meta text-muted">
      {label}
      <input
        inputMode="numeric"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(); } }}
        className="mt-1 block w-full rounded-control border border-line bg-paper px-3 py-2 font-mono text-body-sm text-ink"
      />
    </label>
  );
}
