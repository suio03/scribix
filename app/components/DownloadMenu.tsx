"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { trackEvent } from "@/lib/analytics";

type Props = {
  id: string;
  audioAvailable: boolean;
  variant?: "icon" | "button";
};

const FORMATS = [
  { format: "txt", label: "TXT" },
  { format: "docx", label: "DOCX" },
  { format: "srt", label: "SRT" },
  { format: "vtt", label: "VTT" },
  { format: "csv", label: "CSV" },
] as const;

export function DownloadMenu({ id, audioAvailable, variant = "icon" }: Props) {
  const t = useTranslations("Dashboard.download");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const trigger =
    variant === "icon" ? (
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("label")}
        className="rounded-md p-1.5 text-ink/60 transition hover:bg-ink/5 hover:text-ink"
      >
        <Download size={16} />
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-[13px] font-medium hover:bg-ink/5"
      >
        <Download size={14} />
        {t("label")}
      </button>
    );

  return (
    <div ref={ref} className="relative inline-flex">
      {trigger}
      {open && (
        <div className="absolute right-0 top-full z-10 mt-1 w-40 overflow-hidden rounded-lg border border-line bg-paper shadow-lg">
          {FORMATS.map((f) => (
            <a
              key={f.format}
              href={`/api/transcripts/${id}/export?format=${f.format}${f.format === "docx" ? "&timestamps=1" : ""}`}
              onClick={() => {
                trackEvent("download_click", { format: f.format });
                setOpen(false);
              }}
              className="block px-3 py-2 text-[13px] hover:bg-ink/5"
            >
              {f.label}
            </a>
          ))}
          {audioAvailable && (
            <a
              href={`/api/transcripts/${id}/audio`}
              onClick={() => {
                trackEvent("download_click", { format: "audio" });
                setOpen(false);
              }}
              className="block border-t border-line px-3 py-2 text-[13px] hover:bg-ink/5"
            >
              {t("audio")}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
