import type { ComposeDraft } from "./ComposeWorkspace";
import type { PlatformSubmission } from "./platform-batch";
import type { PublicPost } from "./shared/posts";

export type PublishTask = {
  id: string;
  createdAt: number;
  draft: ComposeDraft;
  submissions: PlatformSubmission[];
};
const key = (userId: string, id: string) => `scribix:publish-task:${userId}:${id}`;
export function createPublishTask(userId: string, draft: ComposeDraft, submissions: PlatformSubmission[]): PublishTask {
  const fingerprint = JSON.stringify({revision: draft.revision, submissions});
  const pointer = `${key(userId, draft.storageKey)}:latest`;
  try {
    const previous = JSON.parse(localStorage.getItem(pointer) ?? "null");
    if (previous?.fingerprint === fingerprint) {
      const existing = readPublishTask(userId, previous.id);
      if (existing) return existing;
    }
  } catch { /* A fresh task can replace an invalid local draft. */ }
  const id = crypto.randomUUID();
  const task: PublishTask = {id, createdAt: Math.floor(Date.now() / 1000),
    // Keep only metadata. Media URLs and File objects never enter persistent storage.
    draft: {...draft, previewUrl: "", file: undefined, storageKey: key(userId, id)},
    submissions: submissions.map(item => ({...item, input: {...item.input, batchId: id, platform: item.platform, title: draft.title}})),
  };
  localStorage.setItem(key(userId, id), JSON.stringify(task));
  localStorage.setItem(pointer, JSON.stringify({id, fingerprint}));
  return task;
}
export function readPublishTask(userId: string, id: string): PublishTask | null {
  try { const task = JSON.parse(localStorage.getItem(key(userId, id)) ?? "null"); return task?.id === id ? task : null; } catch { return null; }
}

export function groupPublishPosts(posts: PublicPost[]): PublicPost[] {
  const groups = new Map<string, PublicPost[]>();
  for (const post of posts) { const key = post.batchId ?? post.id; groups.set(key, [...(groups.get(key) ?? []), post]); }
  return [...groups.entries()].map(([id, items]) => {
    const targets = items.flatMap(post => post.targets.map(target => ({...target, postId: post.id, caption: post.caption})));
    const states = targets.length ? targets.map(target => target.status) : items.map(post => post.status);
    const terminal = states.every(status => ["published", "failed", "canceled"].includes(status));
    const status = states.every(status => status === "published") ? "published" : terminal ? states.includes("published") ? "partial" : "failed" : "publishing";
    return {...items[0], id, targets, status: items.length === 1 ? items[0].status : status};
  });
}
