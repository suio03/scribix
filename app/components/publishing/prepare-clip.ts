import type { ComposeDraft } from "./ComposeWorkspace";
import type { FinalRenderSummary } from "@/lib/video-workspace/final-jobs";

const ACTIVE = new Set(["queued", "preparing", "running", "uploading"]);
export class ClipChangedError extends Error {}

export async function prepareClipForPublishing({ projectId, candidateId, signal, requestKey, onGenerating }: {
  projectId: string; candidateId: string; signal: AbortSignal; requestKey: string; onGenerating: () => void;
}): Promise<ComposeDraft> {
  const list = async () => {
    const response = await fetch(`/api/video-projects/${projectId}/renders`, { signal, cache: "no-store" });
    if (!response.ok) throw new Error("video_unavailable");
    return (await response.json() as { renders: FinalRenderSummary[] }).renders.filter(item => item.candidateId === candidateId);
  };
  let items = await list();
  let ready = items.find(item => item.videoUrl && item.isVideoCurrent);
  if (!ready) {
    onGenerating();
    let active = items.find(item => ACTIVE.has(item.status) && item.isVideoCurrent);
    if (!active) {
      const editor = await fetch(`/api/video-projects/${projectId}/editor?candidateId=${encodeURIComponent(candidateId)}`, { signal, cache: "no-store" });
      if (!editor.ok) throw new Error("video_unavailable");
      const { revision } = await editor.json() as { revision: number };
      const response = await fetch(`/api/video-projects/${projectId}/renders`, {
        method: "POST", signal, headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidateId, expectedRevision: revision, idempotencyKey: requestKey }),
      });
      if (response.status === 409) throw new ClipChangedError();
      if (!response.ok) throw new Error("video_unavailable");
      active = (await response.json() as { render: FinalRenderSummary }).render;
    }
    while (!signal.aborted) {
      items = await list();
      ready = items.find(item => item.id === active!.id && item.videoUrl && item.isVideoCurrent);
      if (ready) break;
      const job = items.find(item => item.id === active!.id);
      if (!job || !ACTIVE.has(job.status)) throw new Error("video_unavailable");
      await new Promise<void>((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); };
        const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 4000);
        signal.addEventListener("abort", abort, { once: true });
      });
    }
  }
  if (signal.aborted || !ready) throw new DOMException("Aborted", "AbortError");
  const query = new URLSearchParams({ projectId, candidateId, renderJobId: ready.id });
  const response = await fetch(`/api/social/review?${query}`, { signal, cache: "no-store" });
  if (response.status === 409) throw new ClipChangedError();
  if (!response.ok) throw new Error("video_unavailable");
  return response.json() as Promise<ComposeDraft>;
}
