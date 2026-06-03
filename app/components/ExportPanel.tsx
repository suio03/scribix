"use client";

import { useState } from "react";
import {
  Check,
  Copy as CopyIcon,
  FileAudio,
  FileSpreadsheet,
  FileText,
  FileType2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { trackEvent } from "@/lib/analytics";

type Props = {
  id: string;
  audioAvailable: boolean;
};

const DOWNLOADS = [
  { format: "txt", label: "TXT", icon: FileText, timestamped: true },
  { format: "docx", label: "DOCX", icon: FileType2, timestamped: true },
  { format: "srt", label: "SRT", icon: FileText, timestamped: false },
  { format: "vtt", label: "VTT", icon: FileText, timestamped: false },
  { format: "csv", label: "CSV", icon: FileSpreadsheet, timestamped: false },
] as const;

export function ExportPanel({
  id,
  audioAvailable,
}: Props) {
  const t = useTranslations("Dashboard.exportPanel");
  const [withTimestamps, setWithTimestamps] = useState(true);
  const [copyState, setCopyState] = useState<"idle" | "busy" | "ok" | "err">("idle");

  const onCopy = async () => {
    if (copyState === "busy") return;
    setCopyState("busy");
    try {
      const qs = new URLSearchParams({ format: "txt" });
      if (withTimestamps) qs.set("timestamps", "1");
      const res = await fetch(`/api/transcripts/${id}/export?${qs}`);
      if (!res.ok) throw new Error(`copy_failed_${res.status}`);
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      setCopyState("ok");
      setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setCopyState("err");
      setTimeout(() => setCopyState("idle"), 1500);
    }
  };

  return (
    <div className="space-y-6 rounded-2xl border border-line bg-paper p-4 sm:p-5">
      <section>
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-semibold text-ink">{t("downloadTitle")}</h3>
          <label className="flex items-center gap-2 text-[13px] text-ink/70">
            <span>{t("withTimestamps")}</span>
            <Toggle checked={withTimestamps} onChange={setWithTimestamps} />
          </label>
        </div>
        <div className="mt-4 h-px bg-line" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          {DOWNLOADS.map((f) => {
            const Icon = f.icon;
            const qs = new URLSearchParams({ format: f.format });
            if (f.timestamped && withTimestamps) qs.set("timestamps", "1");
            return (
              <a
                key={f.format}
                href={`/api/transcripts/${id}/export?${qs}`}
                onClick={() => trackEvent("download_click", { format: f.format })}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-3 py-2.5 text-[13px] font-medium text-ink/85 transition hover:border-accent/40 hover:bg-accent-soft/40 hover:text-ink"
              >
                <Icon size={16} className="text-ink/60" />
                {t("downloadFormat", { format: f.label })}
              </a>
            );
          })}
          <AudioDownload id={id} available={audioAvailable} />
        </div>
      </section>

      <section>
        <h3 className="text-[15px] font-semibold text-ink">{t("actionsTitle")}</h3>
        <div className="mt-4 h-px bg-line" />
        <button
          type="button"
          onClick={onCopy}
          disabled={copyState === "busy"}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-3 py-2.5 text-[13px] font-medium text-paper transition hover:bg-accent/90 disabled:opacity-60"
        >
          {copyState === "ok" ? <Check size={16} /> : <CopyIcon size={16} />}
          {copyState === "ok"
            ? t("copied")
            : copyState === "err"
              ? t("copyFailed")
              : copyState === "busy"
                ? t("copying")
                : t("copy")}
        </button>
      </section>
    </div>
  );
}

function AudioDownload({ id, available }: { id: string; available: boolean }) {
  const t = useTranslations("Dashboard.exportPanel");
  const className =
    "inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-paper px-3 py-2.5 text-[13px] font-medium transition";
  if (!available) {
    return (
      <span
        title={t("audioUnavailable")}
        className={`${className} cursor-not-allowed text-ink/40 opacity-70`}
      >
        <FileAudio size={16} />
        {t("downloadFormat", { format: t("audio") })}
      </span>
    );
  }
  return (
    <a
      href={`/api/transcripts/${id}/audio`}
      onClick={() => trackEvent("download_click", { format: "audio" })}
      className={`${className} text-ink/85 hover:border-accent/40 hover:bg-accent-soft/40 hover:text-ink`}
    >
      <FileAudio size={16} className="text-ink/60" />
      {t("downloadFormat", { format: t("audio") })}
    </a>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
        checked ? "bg-accent" : "bg-ink/15"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-paper shadow transition ${
          checked ? "translate-x-[18px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}
