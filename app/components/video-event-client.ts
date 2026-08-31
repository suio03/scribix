"use client";

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
  void fetch(`/api/video-projects/${projectId}/events`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(event),
    keepalive: true,
  }).catch(() => undefined);
}
