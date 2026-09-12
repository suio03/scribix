import type { Edl, RenderSpec } from "./contracts";
export const PUBLISH_LIMITS = { title: 120, body: 2000, tags: 5, perMinute: 5, leaseSeconds: 180 } as const;
export type PublishDraft = {
  titles: string[];
  title: string;
  body: string;
  tags: string[];
  contentKey: string;
  edited: { title: boolean; body: boolean; tags: boolean; opening: boolean; cover: boolean };
};
export function publishContent(edl: Edl, spec: RenderSpec): string {
  return [...edl.segments].sort((a, b) => a.order - b.order).map(segment => spec.captions.cues
    .filter(cue => cue.segmentId === segment.id)
    .flatMap(cue => cue.words)
    .filter(word => word.sourceEndMs > segment.sourceStartMs && word.sourceStartMs < segment.sourceEndMs)
    .map(word => word.text).join(" ")).join("\n");
}
export function publishContentKey(edl: Edl, spec: RenderSpec): string {
  return JSON.stringify([edl.segments, publishContent(edl, spec)]);
}
export function parsePublishDraft(input: unknown): PublishDraft | null {
  if (input === null || input === undefined) return null;
  const v = input as PublishDraft;
  const text = (value: unknown, max: number) => typeof value === "string" && Array.from(value).length <= max;
  if (!v || typeof v !== "object" || !Array.isArray(v.titles) || v.titles.length > 3 ||
    v.titles.some(x => !text(x, PUBLISH_LIMITS.title)) || !text(v.title, PUBLISH_LIMITS.title) ||
    !text(v.body, PUBLISH_LIMITS.body) || !Array.isArray(v.tags) || v.tags.length > PUBLISH_LIMITS.tags ||
    v.tags.some(x => !text(x, 80)) || !text(v.contentKey, 100_000) || !v.edited ||
    ["title", "body", "tags", "opening", "cover"].some(k => typeof v.edited[k as keyof PublishDraft["edited"]] !== "boolean")) throw new Error("invalid_publish_draft");
  return { titles: v.titles, title: v.title, body: v.body, tags: v.tags, contentKey: v.contentKey, edited: { ...v.edited } };
}
export function publishTags(tags: string[]): string {
  return tags.map(tag => tag.replace(/^#+/, "").trim().replace(/\s+/g, "_")).filter(Boolean).map(tag => `#${tag}`).join(" ");
}
export function publishText(draft: PublishDraft): string {
  return [draft.title, draft.body, publishTags(draft.tags)].join("\n\n") + "\n";
}
export function mergePublishDraft(current: PublishDraft | null, generated: Pick<PublishDraft, "titles" | "title" | "body" | "tags">, contentKey: string, mode: "all" | "titles" | "copy"): PublishDraft {
  const edited = current?.edited ?? { title: false, body: false, tags: false, opening: false, cover: false };
  return {
    titles: mode === "copy" && current ? current.titles : generated.titles,
    title: current && (edited.title || mode === "titles") ? current.title : generated.title,
    body: current && (edited.body || mode === "titles") ? current.body : generated.body,
    tags: current && (edited.tags || mode === "titles") ? current.tags : generated.tags,
    contentKey: current && current.contentKey !== contentKey && (mode === "titles" || edited.title || edited.body || edited.tags) ? current.contentKey : contentKey, edited,
  };
}

export function remapCoverFrame(previous: Edl, next: Edl, timelineMs: number): { timelineMs: number; removed: boolean } {
  let cursor = 0;
  let sourceMs = -1;
  for (const segment of [...previous.segments].sort((a, b) => a.order - b.order)) {
    const duration = segment.sourceEndMs - segment.sourceStartMs;
    if (timelineMs >= cursor && timelineMs < cursor + duration) { sourceMs = segment.sourceStartMs + timelineMs - cursor; break; }
    cursor += duration;
  }
  cursor = 0;
  for (const segment of [...next.segments].sort((a, b) => a.order - b.order)) {
    if (sourceMs >= segment.sourceStartMs && sourceMs < segment.sourceEndMs) return { timelineMs: cursor + sourceMs - segment.sourceStartMs, removed: false };
    cursor += segment.sourceEndMs - segment.sourceStartMs;
  }
  return { timelineMs: 0, removed: true };
}
