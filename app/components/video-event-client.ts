"use client";

import { trackEvent } from "@/lib/analytics";
import { publicVideoProperties, type VideoAnalyticsEvent } from "@/lib/video-workspace/analytics-contract";

export function trackVideoAction(event: VideoAnalyticsEvent, properties: Record<string, unknown> = {}) {
  trackEvent(event, publicVideoProperties(properties));
}
export function trackVideoFailure(stage: "project" | "editor_load" | "editor_save" | "export" | "generation" | "manual", status = 0) {
  const events = {
    project: "video_project_failed", editor_load: "video_editor_load_failed",
    editor_save: "video_editor_save_failed", export: "video_export_request_failed",
    generation: "video_candidate_request_failed", manual: "video_manual_request_failed",
  } as const;
  trackVideoAction(events[stage], {
    error_code: status === 409 ? "conflict" : status === 429 || status === 402 ? "limit" : "request_failed",
  });
}
export function trackVideoWorkspaceEvent(
  projectId: string,
  event: {
    eventName: "editor_opened" | "edit_saved" | "render_downloaded" | "external_edit_required";
    eventKey: string;
    candidateId?: string;
    renderJobId?: string;
    properties: Record<string, string | number | boolean>;
  }
): void {
  trackVideoAction(`video_${event.eventName}`, event.properties);
  void fetch(`/api/video-projects/${projectId}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => undefined);
}

// Observe transitions from the existing render-status polling; do not replay history.
export function observeVideoRenderResults(
  previous: Map<string, string>,
  renders: Array<{ id: string; status: string; createdAt: string; completedAt: string | null; errorCode: string | null }>
): void {
  for (const render of renders) {
    const before = previous.get(render.id);
    previous.set(render.id, render.status);
    if (!before || !["queued", "preparing", "running", "uploading"].includes(before)) continue;
    if (render.status !== "completed" && render.status !== "failed") continue;
    const timestamp = (value: string) => Date.parse(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
    const elapsed = render.completedAt ? timestamp(render.completedAt) - timestamp(render.createdAt) : NaN;
    trackVideoAction(render.status === "completed" ? "video_render_completed" : "video_render_failed", {
      ...(Number.isFinite(elapsed) && elapsed >= 0 ? { elapsed_ms: elapsed } : {}),
      ...(render.status === "failed" ? { error_code: render.errorCode } : {}),
    });
  }
}

// Request IDs stay in memory; public events contain no task/project identifiers.
export function createCandidateResultObserver() {
  let active: { requestId: string; startedAt: number; armed: boolean } | null = null;
  const settled = new Set<string>();
  return {
    begin(requestId: string, startedAt = Date.now()) {
      settled.delete(requestId);
      active = { requestId, startedAt, armed: false };
    },
    accept(requestId: string) {
      if (active?.requestId === requestId) active.armed = true;
    },
    abandon(requestId: string) {
      if (active?.requestId === requestId) active = null;
    },
    watch(requestId: string, startedAt = Date.now()) {
      settled.delete(requestId);
      active = { requestId, startedAt, armed: true };
    },
    observe(snapshot: {
      status?: string;
      task?: { requestId: string; status: string } | null;
      selection?: { requestId: string | null } | null;
    }) {
      const requestId = snapshot.task?.requestId ?? snapshot.selection?.requestId;
      if (!requestId || settled.has(requestId)) return;
      const running = snapshot.status === "waiting" || snapshot.status === "analyzing";
      if (!active) {
        if (running) active = { requestId, startedAt: Date.now(), armed: true };
        return; // Historical terminal states are not observations of a transition.
      }
      if (!active.armed || active.requestId !== requestId || running) return;
      const failed = snapshot.status === "failed" || snapshot.status === "transcript_failed";
      const completed = snapshot.status === "candidates_ready" || snapshot.status === "editing";
      if (!failed && !completed) return;
      settled.add(requestId);
      const elapsed = Date.now() - active.startedAt;
      active = null;
      trackVideoAction(failed ? "video_candidates_failed" : snapshot.status === "editing"
        ? "video_manual_clip_ready" : "video_candidates_completed", {
        elapsed_ms: elapsed,
        ...(failed ? { error_code: "generation_failed" } : {}),
      });
    },
  };
}
