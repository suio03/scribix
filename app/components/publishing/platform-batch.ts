import type { PostInput } from "./api";
import type { ComposeDraft } from "./ComposeWorkspace";

export type PlatformSubmission = { platform: string; input: PostInput };
export type PlatformBatch = {
  revision: number;
  mediaId: string;
  entries: (PlatformSubmission & { submissionId: string; postId?: string; failed?: boolean; sending?: boolean })[];
};
type Store = Pick<Storage, "getItem" | "setItem">;
const batches = new Map<string, PlatformBatch>();
const keyFor = (draft: ComposeDraft) => `${draft.storageKey}:platform-batch`;
export function readPlatformBatch(draft: ComposeDraft, storage: Store): PlatformBatch | null {
  const key = keyFor(draft);
  if (batches.has(key)) return batches.get(key)!;
  try {
    const saved = JSON.parse(storage.getItem(key) ?? "null") as PlatformBatch | null;
    if (saved?.mediaId === draft.media.id && Array.isArray(saved.entries) && saved.entries.length > 0 && saved.entries.every(entry => typeof entry.submissionId === "string" && typeof entry.platform === "string" && entry.input)) {
      batches.set(key, saved); return saved;
    }
  } catch { /* Storage can be unavailable. */ }
  return null;
}
export function clearCompletedBatch(draft: ComposeDraft, storage: Store): boolean {
  const batch = readPlatformBatch(draft, storage);
  if (!batch || !batch.entries.every(entry => entry.postId)) return false;
  const key = keyFor(draft);
  batches.delete(key);
  try { storage.setItem(key, "null"); } catch {}
  return true;
}
async function runPlatformBatch({ draft, submissions, storage, send, onUpdate }: {
  draft: ComposeDraft;
  submissions: PlatformSubmission[];
  storage: Store;
  send: (input: PostInput, draft: ComposeDraft, submissionId: string) => Promise<{postId: string}>;
  onUpdate: (batch: PlatformBatch) => void;
}): Promise<PlatformBatch> {
  const key = keyFor(draft);
  let batch: PlatformBatch = readPlatformBatch(draft, storage) ?? {
    revision: draft.revision, mediaId: draft.media.id,
    entries: submissions.map(item => ({...item, submissionId: crypto.randomUUID()})),
  };
  const save = () => {
    batches.set(key, batch);
    try { storage.setItem(key, JSON.stringify(batch)); } catch { /* Keep the exact requests in memory. */ }
    onUpdate(batch);
  };
  // Persist every request ID before the first network call, including requests not sent yet.
  save();
  for (let index = 0; index < batch.entries.length; index++) {
    const entry = batch.entries[index];
    if (entry.postId) continue;
    batch = {...batch, entries: batch.entries.map((item, i) => i === index ? {...item, sending: true, failed: false} : item)};
    save();
    try {
      const result = await send(entry.input, {...draft, revision: batch.revision, storageKey: `${key}:${entry.submissionId}`}, entry.submissionId);
      batch = {...batch, entries: batch.entries.map((item, i) => i === index ? {...item, postId: result.postId, failed: false, sending: false} : item)};
    } catch {
      batch = {...batch, entries: batch.entries.map((item, i) => i === index ? {...item, failed: true, sending: false} : item)};
    }
    save();
  }
  return batch;
}

// React remounts and multiple readers share one sender for this task.
const inFlight = new Map<string, Promise<PlatformBatch>>();
export function submitPlatformBatch(options: Parameters<typeof runPlatformBatch>[0]): Promise<PlatformBatch> {
  const key = keyFor(options.draft);
  const existing = inFlight.get(key);
  if (existing) return existing;
  const promise = runPlatformBatch(options).finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}
