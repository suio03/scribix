"use client";

import { Download, Film, Loader2, RefreshCw, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { FinalRenderSummary } from "@/lib/video-workspace/final-jobs";
import { trackVideoWorkspaceEvent } from "@/app/components/video-event-client";

const ACTIVE = new Set(["queued", "preparing", "running", "uploading"]);

export function FinalRenderPanel({
  projectId,
  candidateId,
  revision,
  disabled,
  generatedOnly = false,
  sourceAvailable = true,
  initialRenders = [],
  onConflict,
  onExportDeleted,
}: {
  projectId: string;
  candidateId: string;
  revision: number;
  disabled: boolean;
  generatedOnly?: boolean;
  sourceAvailable?: boolean;
  initialRenders?: FinalRenderSummary[];
  onConflict: () => void;
  onExportDeleted?: () => void;
}) {
  const t = useTranslations("Dashboard.videoCandidates.editor.finalRender");
  const [renders, setRenders] = useState<FinalRenderSummary[]>(initialRenders);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<"generic" | "limit" | null>(null);
  const candidateRenders = useMemo(() => renders.filter((render) => (
    render.candidateId === candidateId
  )), [candidateId, renders]);
  const active = useMemo(() => candidateRenders.some((render) => (
    ACTIVE.has(render.status)
  )), [candidateRenders]);
  const latestReady = candidateRenders.find((render) => (
    render.status === "completed" && render.videoUrl
  ));

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/video-projects/${projectId}/renders`);
    if (!response.ok) throw new Error("render_list_failed");
    const payload = await response.json() as { renders?: FinalRenderSummary[] };
    setRenders(payload.renders ?? []);
  }, [projectId]);

  useEffect(() => {
    void refresh().catch(() => setError("generic"));
  }, [refresh, revision]);

  useEffect(() => {
    if (!active) return;
    const poll = window.setInterval(() => {
      void refresh().catch(() => setError("generic"));
    }, 4_000);
    return () => window.clearInterval(poll);
  }, [active, refresh]);

  const start = async () => {
    if (busy || disabled || !sourceAvailable) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/video-projects/${projectId}/renders`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          candidateId,
          expectedRevision: revision,
          idempotencyKey: `final:${projectId}:${crypto.randomUUID()}`,
        }),
      });
      if (response.status === 409) {
        if (generatedOnly) setError("generic");
        else onConflict();
        return;
      }
      const payload = await response.json() as { render?: FinalRenderSummary; error?: string };
      if (response.status === 429) {
        setError("limit");
        return;
      }
      if (!response.ok || !payload.render) throw new Error("render_create_failed");
      setRenders((current) => [
        payload.render as FinalRenderSummary,
        ...current.filter((render) => render.id !== payload.render?.id),
      ]);
    } catch {
      setError("generic");
    } finally {
      setBusy(false);
    }
  };

  const mutate = async (render: FinalRenderSummary, method: "POST" | "DELETE") => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/video-projects/${projectId}/renders/${render.id}`,
        { method }
      );
      if (response.status === 429) {
        setError("limit");
        return;
      }
      if (!response.ok) throw new Error("render_update_failed");
      await refresh();
      if (method === "DELETE" && render.status === "completed") {
        setConfirmDelete(false);
        onExportDeleted?.();
      }
    } catch {
      setError("generic");
    } finally {
      setBusy(false);
    }
  };

  const trackDownload = (render: FinalRenderSummary) => {
    trackVideoWorkspaceEvent(projectId, {
      eventName: "render_downloaded",
      eventKey: `render-download:${render.id}:package`,
      renderJobId: render.id,
      properties: { assetKind: "package" },
    });
  };

  const downloadUrl = latestReady && (latestReady.isCurrent || !sourceAvailable)
    ? `/api/video-projects/${projectId}/renders/${latestReady.id}/download`
    : null;

  return (
    <section id="exports" className="scroll-mt-6 rounded-xl border border-ink bg-ink p-5 text-paper shadow-[0_18px_44px_-30px_rgba(0,0,0,0.8)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-paper/45">{t("eyebrow")}</p>
          <h5 className="mt-1 font-display text-lg font-semibold">{t("title")}</h5>
          <p className="mt-1 max-w-md text-[11px] leading-5 text-paper/55">
            {t(!sourceAvailable
              ? "descriptionArchived"
              : generatedOnly
                ? "descriptionGenerated"
                : "description")}
          </p>
        </div>
        {downloadUrl && latestReady ? (
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={downloadUrl}
              download
              onClick={() => trackDownload(latestReady)}
              className="inline-flex min-w-36 items-center justify-center gap-2 rounded-full bg-paper px-5 py-2.5 text-[12px] font-semibold text-ink transition hover:bg-accent hover:text-white"
            >
              <Download size={13} />
              {t("download")}
            </a>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
              aria-label={t("deleteExport")}
              className="inline-grid size-9 place-items-center rounded-full border border-paper/20 text-paper/60 transition hover:border-red-300/50 hover:bg-red-400/10 hover:text-red-200 disabled:opacity-40"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy || disabled || active || !sourceAvailable}
            onClick={() => void start()}
            className="inline-flex min-w-36 items-center justify-center gap-2 rounded-full bg-paper px-5 py-2.5 text-[12px] font-semibold text-ink transition hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            {busy || active ? <Loader2 size={13} className="animate-spin" /> : <Film size={13} />}
            {active
              ? t("rendering")
              : !sourceAvailable
                ? t("unavailable")
                : latestReady
                  ? t("exportUpdated")
                  : t("generate")}
          </button>
        )}
      </div>
      {latestReady?.expiresAt ? (
        <p className="mt-3 text-[10px] text-paper/45">
          {t("availableUntil", { date: formatAssetDate(latestReady.expiresAt) })}
        </p>
      ) : null}
      {disabled && sourceAvailable ? <p className="mt-3 text-[10px] text-amber-300">{t("saveFirst")}</p> : null}
      {error ? <p className="mt-3 text-[10px] text-red-300">{t(error === "limit" ? "limit" : "failed")}</p> : null}
      {candidateRenders.length > 0 ? (
        <details className="group mt-4 border-t border-paper/15 pt-3">
          <summary className="cursor-pointer text-[10px] font-medium text-paper/45 transition hover:text-paper/70">
            {t("history")}
          </summary>
          <div className="mt-3 space-y-2">
          {candidateRenders.slice(0, 4).map((render) => (
            <article key={render.id} className="rounded-lg bg-white/[0.06] px-3 py-2 text-[10px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-paper/45">v{render.version}</span>
                <span className="capitalize text-paper/70">{t(`status.${render.status}`)}</span>
                <span className="ml-auto font-mono text-paper/35">#{render.attempt}</span>
                {ACTIVE.has(render.status) ? (
                  <button type="button" disabled={busy} onClick={() => void mutate(render, "DELETE")} className="inline-flex items-center gap-1 text-paper/55 hover:text-red-300"><X size={11} />{t("cancel")}</button>
                ) : null}
                {!generatedOnly && (render.status === "failed" || render.status === "canceled") ? (
                  <button type="button" disabled={busy} onClick={() => void mutate(render, "POST")} className="inline-flex items-center gap-1 text-paper/55 hover:text-paper"><RefreshCw size={11} />{t("retry")}</button>
                ) : null}
              </div>
            </article>
          ))}
          </div>
        </details>
      ) : null}
      {confirmDelete && latestReady ? (
        <div className="mt-4 rounded-lg border border-red-300/20 bg-red-300/[0.07] p-3">
          <p className="text-[11px] font-semibold text-paper">{t("deleteExportTitle")}</p>
          <p className="mt-1 text-[10px] leading-5 text-paper/55">{t("deleteExportBody")}</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              disabled={busy}
              className="rounded-full border border-paper/20 px-3 py-1.5 text-[10px] font-semibold text-paper/70 transition hover:text-paper disabled:opacity-40"
            >
              {t("cancelDelete")}
            </button>
            <button
              type="button"
              onClick={() => void mutate(latestReady, "DELETE")}
              disabled={busy}
              className="rounded-full bg-red-500 px-3 py-1.5 text-[10px] font-semibold text-white transition hover:bg-red-400 disabled:opacity-40"
            >
              {busy ? t("deletingExport") : t("confirmDelete")}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function formatAssetDate(value: string): string {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}
