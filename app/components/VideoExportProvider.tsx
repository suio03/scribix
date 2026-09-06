"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { FinalRenderSummary } from "@/lib/video-workspace/final-jobs";
import { observeVideoRenderResults, trackVideoAction, trackVideoWorkspaceEvent } from "@/app/components/video-event-client";

export const ACTIVE_EXPORT_STATUSES = new Set(["queued", "preparing", "running", "uploading"]);

type ExportContext = {
  renders: FinalRenderSummary[];
  downloadedIds: Set<string>;
  statusError: boolean;
  refresh: () => Promise<void>;
  watch: (render: FinalRenderSummary) => void;
  forget: (id: string) => void;
};
const Context = createContext<ExportContext | null>(null);

export function VideoExportProvider({ projectId, initialRenders, children }: {
  projectId: string;
  initialRenders: FinalRenderSummary[];
  children: ReactNode;
}) {
  const [renders, setRenders] = useState(initialRenders);
  const [downloadedIds, setDownloadedIds] = useState(new Set<string>());
  const [statusError, setStatusError] = useState(false);
  const pending = useRef(new Set<string>());
  const observedStatuses = useRef(new Map(initialRenders.map((render) => [render.id, render.status])));
  const mounted = useRef(true);
  const refreshSequence = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    try {
      const response = await fetch(`/api/video-projects/${projectId}/renders`);
      if (!response.ok) throw new Error("render_list_failed");
      const payload = await response.json() as { renders: FinalRenderSummary[] };
      if (!mounted.current || sequence !== refreshSequence.current) return;
      observeVideoRenderResults(observedStatuses.current, payload.renders);
      setRenders(payload.renders);
      setStatusError(false);
    } catch {
      if (mounted.current && sequence === refreshSequence.current) setStatusError(true);
    }
  }, [projectId]);
  const watch = useCallback((render: FinalRenderSummary) => {
    if (!mounted.current) return;
    // Ignore list responses started before this newly accepted request.
    ++refreshSequence.current;
    if (ACTIVE_EXPORT_STATUSES.has(render.status) && !ACTIVE_EXPORT_STATUSES.has(observedStatuses.current.get(render.id) ?? "")) {
      trackVideoAction("video_render_requested");
    }
    observedStatuses.current.set(render.id, render.status);
    pending.current.add(render.id);
    setRenders((current) => [render, ...current.filter((item) => item.id !== render.id)]);
  }, []);
  const forget = useCallback((id: string) => { pending.current.delete(id); }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  const polling = statusError || renders.some((render) => ACTIVE_EXPORT_STATUSES.has(render.status));
  useEffect(() => {
    if (!polling) return;
    const interval = window.setInterval(() => { void refresh(); }, 4_000);
    return () => window.clearInterval(interval);
  }, [polling, refresh]);

  useEffect(() => {
    for (const render of renders) {
      if (!pending.current.has(render.id) || ACTIVE_EXPORT_STATUSES.has(render.status)) continue;
      pending.current.delete(render.id);
      if (render.status !== "completed" || !render.videoUrl) continue;
      const link = document.createElement("a");
      link.href = `/api/video-projects/${projectId}/renders/${render.id}/download`;
      link.download = "";
      document.body.appendChild(link);
      link.click();
      link.remove();
      recordVideoDownload(projectId, render);
      setDownloadedIds((current) => new Set(current).add(render.id));
    }
  }, [projectId, renders]);

  return <Context.Provider value={{ renders, downloadedIds, statusError, refresh, watch, forget }}>{children}</Context.Provider>;
}

export function useVideoExports() {
  const context = useContext(Context);
  if (!context) throw new Error("VideoExportProvider is required");
  return context;
}

export function recordVideoDownload(projectId: string, render: FinalRenderSummary) {
  trackVideoWorkspaceEvent(projectId, {
    eventName: "render_downloaded",
    eventKey: `render-download:${render.id}:package`,
    renderJobId: render.id,
    properties: { assetKind: "package" },
  });
}
