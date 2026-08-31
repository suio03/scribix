"use client";

import { useState } from "react";
import { Clapperboard, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function CreateVideoProjectButton({ transcriptId }: { transcriptId: string }) {
  const t = useTranslations("Dashboard.videoCandidates");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const openWorkspace = async () => {
    if (busy) return;
    setBusy(true);
    setError(false);
    try {
      const response = await fetch("/api/video-projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcriptId }),
      });
      const payload = (await response.json()) as { projectId?: string };
      if (!response.ok || !payload.projectId) throw new Error("project_create_failed");
      router.push(`/dashboard/video-projects/${payload.projectId}`);
    } catch {
      setError(true);
      setBusy(false);
    }
  };

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={() => void openWorkspace()}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-paper transition hover:bg-accent disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <Clapperboard size={15} />}
        {busy ? t("creatingClips") : t("createClips")}
      </button>
      {error ? <p className="text-[11px] text-red-600">{t("createClipsFailed")}</p> : null}
    </div>
  );
}
