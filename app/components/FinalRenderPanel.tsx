"use client";

import { Download, Film, MoreHorizontal, Loader2, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { FinalRenderSummary } from "@/lib/video-workspace/final-jobs";
import { ACTIVE_EXPORT_STATUSES as ACTIVE, recordVideoDownload, useVideoExports } from "@/app/components/VideoExportProvider";


export function FinalRenderPanel({
  compact = false,
  projectId,
  candidateId,
  revision,
  disabled,
  disabledReason,
  generatedOnly = false,
  sourceAvailable = true,
  onConflict,
  onExportDeleted,
}: {
  compact?: boolean;
  projectId: string;
  candidateId: string;
  revision: number;
  disabled: boolean;
  disabledReason?: string;
  generatedOnly?: boolean;
  sourceAvailable?: boolean;
  onConflict: () => void;
  onExportDeleted?: () => void;
}) {
  const t = useTranslations("Dashboard.videoCandidates.editor.finalRender");
  const { renders, downloadedIds, statusError, refresh, watch, forget } = useVideoExports();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<"generic" | "limit" | null>(null);
  const candidateRenders = useMemo(() => renders.filter((render) => (
    render.candidateId === candidateId
  )), [candidateId, renders]);
  const active = useMemo(() => candidateRenders.some((render) => (
    ACTIVE.has(render.status)
  )), [candidateRenders]);
  const activeRender = candidateRenders.find(render => ACTIVE.has(render.status));
  const latestReady = candidateRenders.find((render) => (
    render.status === "completed" && render.videoUrl
  ));

  useEffect(() => { void refresh(); }, [refresh, revision]);

  useEffect(() => {
    if (!compact) return;
    const close = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        menuRef.current.open = false;
        setConfirmDelete(false);
      }
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [compact]);

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
      watch(payload.render);
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
      if (method === "POST") watch({ ...render, status: "queued" });
      else forget(render.id);
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

  const downloadUrl = latestReady && ((!disabled && latestReady.isCurrent) || !sourceAvailable)
    ? `/api/video-projects/${projectId}/renders/${latestReady.id}/download`
    : null;

  if (compact) {
    const actionClass = "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50";
    return (
      <section id="exports" className="relative text-ink">
        <div className="flex items-center gap-2">
          {downloadUrl && latestReady && !active ? (
            <a href={downloadUrl} download onClick={() => recordVideoDownload(projectId, latestReady)} className={actionClass}>
              <Download size={16} />{t("downloadVideo")}
            </a>
          ) : (
            <button type="button" title={disabled ? (disabledReason ?? t("saveFirst")) : undefined} disabled={busy || disabled || active || !sourceAvailable} onClick={() => void start()} className={actionClass}>
              {busy || active ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              {t(busy || active ? "rendering" : !sourceAvailable ? "unavailable" : "generate")}
            </button>
          )}
          {latestReady || activeRender ? (
            <details ref={menuRef} className="relative" onKeyDown={event => {
              if (event.key === "Escape" && menuRef.current) {
                menuRef.current.open = false;
                setConfirmDelete(false);
                menuRef.current.querySelector("summary")?.focus();
              }
            }}>
              <summary aria-label={t("moreActions")} title={t("moreActions")} className="grid size-10 cursor-pointer list-none place-items-center rounded-lg border border-line bg-card text-ink/60 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
                <MoreHorizontal size={18} />
              </summary>
              <div className="absolute right-0 top-full z-40 mt-2 w-72 max-w-[85vw] rounded-xl border border-line bg-card p-3 shadow-lg">
                {activeRender ? <button type="button" disabled={busy} onClick={() => void mutate(activeRender, "DELETE")} className="flex items-center gap-2 px-1 py-2 text-sm text-ink/70"><X size={14} />{t("cancel")}</button> : null}
                {latestReady ? (
                  <div>
                    {confirmDelete ? <>
                      <p className="text-sm font-medium">{t("deleteExportTitle")}</p>
                      <p className="mt-1 text-xs leading-5 text-ink/60">{t("deleteExportBody")}</p>
                      <div className="mt-3 flex gap-3">
                        <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)} className="rounded-lg border border-line px-3 py-2 text-xs">{t("cancelDelete")}</button>
                        <button type="button" disabled={busy} onClick={() => void mutate(latestReady, "DELETE")} className="rounded-lg bg-red-600 px-3 py-2 text-xs text-white">{t(busy ? "deletingExport" : "confirmDelete")}</button>
                      </div>
                    </> : <button type="button" disabled={busy} onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 text-xs text-red-600"><Trash2 size={14} />{t("deleteExport")}</button>}
                  </div>
                ) : null}
              </div>
            </details>
          ) : null}
        </div>
        {statusError || error ? <p role="alert" className="mt-2 max-w-64 text-xs text-red-600">{t(error ? error === "limit" ? "limit" : "failed" : "statusUnavailable")}</p> : null}
      </section>
    );
  }

  return (
    <section id="exports" className="video-export-card scroll-mt-6 rounded-xl border border-ink bg-ink p-5 text-paper shadow-[0_18px_44px_-30px_rgba(0,0,0,0.8)]">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div hidden={compact}>
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
              onClick={() => recordVideoDownload(projectId, latestReady)}
              className="inline-flex min-w-36 items-center justify-center gap-2 rounded-full bg-paper px-5 py-2.5 text-[12px] font-semibold text-ink transition hover:bg-accent hover:text-white"
            >
              <Download size={13} />
              {t(downloadedIds.has(latestReady.id) ? "downloadAgain" : "download")}
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
      {disabled && sourceAvailable ? <p className="mt-3 text-[10px] text-amber-300">{t("saveFirst")}</p> : null}
      {statusError ? <p className="mt-3 text-[10px] text-amber-300">{t("statusUnavailable")}</p> : null}
      {error ? <p className="mt-3 text-[10px] text-red-300">{t(error === "limit" ? "limit" : "failed")}</p> : null}
      {activeRender ? <button type="button" disabled={busy} onClick={() => void mutate(activeRender, "DELETE")} className="mt-3 inline-flex items-center gap-1 text-xs text-paper/70"><X size={12} />{t("cancel")}</button> : null}
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
