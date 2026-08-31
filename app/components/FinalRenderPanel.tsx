"use client";

import { Download, Film, Image as ImageIcon, Loader2, RefreshCw, X } from "lucide-react";
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
  onConflict,
}: {
  projectId: string;
  candidateId: string;
  revision: number;
  disabled: boolean;
  onConflict: () => void;
}) {
  const t = useTranslations("Dashboard.videoCandidates.editor.finalRender");
  const [renders, setRenders] = useState<FinalRenderSummary[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"generic" | "limit" | null>(null);
  const [externalEditReports, setExternalEditReports] = useState<Set<string>>(() => new Set());
  const active = useMemo(() => renders.some((render) => ACTIVE.has(render.status)), [renders]);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/video-projects/${projectId}/renders`);
    if (!response.ok) throw new Error("render_list_failed");
    const payload = await response.json() as { renders?: FinalRenderSummary[] };
    setRenders(payload.renders ?? []);
  }, [projectId]);

  useEffect(() => {
    void refresh().catch(() => setError("generic"));
  }, [refresh]);

  useEffect(() => {
    if (!active) return;
    const poll = window.setInterval(() => {
      void refresh().catch(() => setError("generic"));
    }, 4_000);
    return () => window.clearInterval(poll);
  }, [active, refresh]);

  const start = async () => {
    if (busy || disabled) return;
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
        onConflict();
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
    } catch {
      setError("generic");
    } finally {
      setBusy(false);
    }
  };

  const trackDownload = (render: FinalRenderSummary, assetKind: "video" | "cover") => {
    trackVideoWorkspaceEvent(projectId, {
      eventName: "render_downloaded",
      eventKey: `render-download:${render.id}:${assetKind}`,
      renderJobId: render.id,
      properties: { assetKind },
    });
  };

  const reportExternalEdit = (render: FinalRenderSummary) => {
    trackVideoWorkspaceEvent(projectId, {
      eventName: "external_edit_required",
      eventKey: `external-edit:${render.id}`,
      renderJobId: render.id,
      properties: { reason: "other" },
    });
    setExternalEditReports((current) => new Set(current).add(render.id));
  };

  return (
    <section className="rounded-xl border border-ink bg-ink p-4 text-paper">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-paper/45">{t("eyebrow")}</p>
          <h5 className="mt-1 font-display text-lg font-semibold">{t("title")}</h5>
          <p className="mt-1 max-w-md text-[11px] leading-5 text-paper/55">{t("description")}</p>
        </div>
        <button
          type="button"
          disabled={busy || disabled || active}
          onClick={() => void start()}
          className="inline-flex items-center gap-2 rounded-full bg-paper px-4 py-2 text-[11px] font-semibold text-ink transition hover:bg-accent hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
        >
          {busy || active ? <Loader2 size={13} className="animate-spin" /> : <Film size={13} />}
          {active ? t("rendering") : t("generate")}
        </button>
      </div>
      {disabled ? <p className="mt-3 text-[10px] text-amber-300">{t("saveFirst")}</p> : null}
      {error ? <p className="mt-3 text-[10px] text-red-300">{t(error === "limit" ? "limit" : "failed")}</p> : null}
      {renders.length > 0 ? (
        <div className="mt-4 space-y-2 border-t border-paper/15 pt-4">
          {renders.slice(0, 4).map((render) => (
            <div key={render.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/[0.06] px-3 py-2 text-[10px]">
              <span className="font-mono text-paper/45">v{render.version}</span>
              <span className="capitalize text-paper/70">{t(`status.${render.status}`)}</span>
              <span className="ml-auto font-mono text-paper/35">#{render.attempt}</span>
              {render.status === "completed" && render.videoUrl && render.coverUrl ? (
                <>
                  <a href={render.videoUrl} download onClick={() => trackDownload(render, "video")} className="inline-flex items-center gap-1 rounded-full bg-paper px-2.5 py-1 font-semibold text-ink"><Download size={11} />{t("video")}</a>
                  <a href={render.coverUrl} download onClick={() => trackDownload(render, "cover")} className="inline-flex items-center gap-1 rounded-full border border-paper/25 px-2.5 py-1 font-semibold text-paper"><ImageIcon size={11} />{t("cover")}</a>
                  <button
                    type="button"
                    disabled={externalEditReports.has(render.id)}
                    onClick={() => reportExternalEdit(render)}
                    className="text-paper/45 underline decoration-paper/20 underline-offset-2 hover:text-paper disabled:no-underline"
                  >
                    {externalEditReports.has(render.id) ? t("externalEditRecorded") : t("externalEdit")}
                  </button>
                </>
              ) : null}
              {ACTIVE.has(render.status) ? (
                <button type="button" disabled={busy} onClick={() => void mutate(render, "DELETE")} className="inline-flex items-center gap-1 text-paper/55 hover:text-red-300"><X size={11} />{t("cancel")}</button>
              ) : null}
              {render.status === "failed" || render.status === "canceled" ? (
                <button type="button" disabled={busy} onClick={() => void mutate(render, "POST")} className="inline-flex items-center gap-1 text-paper/55 hover:text-paper"><RefreshCw size={11} />{t("retry")}</button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
