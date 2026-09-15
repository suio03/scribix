"use client";
import {useCallback, useEffect, useState} from "react";
import {useTranslations} from "next-intl";
import {HistoryWorkspace} from "./HistoryWorkspace";
import {createPost, getPosts} from "./api";
import {readPublishTask, type PublishTask} from "./publish-task";
import {readPlatformBatch, submitPlatformBatch, type PlatformBatch} from "./platform-batch";
import type {PublicPost} from "./shared/posts";

const storage = {getItem: (key: string) => localStorage.getItem(key), setItem: (key: string, value: string) => localStorage.setItem(key, value)};
export function pendingTaskPosts(task: PublishTask, batch: PlatformBatch | null): PublicPost[] {
  return task.submissions.map((item, index) => {
    const entry = batch?.entries[index];
    return {id: entry?.postId ?? entry?.submissionId ?? `${task.id}:${index}`, batchId: task.id,
      mediaId: task.draft.media.id, createdAt: task.createdAt, caption: item.input.caption,
      status: entry?.failed ? "failed" : entry?.sending || entry?.postId ? "submitting" : "waiting", media: {filename: task.draft.title, width: task.draft.media.width, height: task.draft.media.height},
      targets: [{id: `${task.id}:${index}`, platform: item.platform, accountName: item.platform === "youtube" ? "YouTube" : "LinkedIn", status: entry?.failed ? "failed" : entry?.sending || entry?.postId ? "submitting" : "waiting"}],
    } as PublicPost;
  });
}
export function PublishProgress({id, userId, onHistory}: {id: string; userId: string; onHistory: () => void}) {
  const t = useTranslations("PublishFlow");
  const [task, setTask] = useState<PublishTask | null>(null);
  const [batch, setBatch] = useState<PlatformBatch | null>(null);
  const [running, setRunning] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { const saved = readPublishTask(userId, id); setTask(saved); setBatch(saved ? readPlatformBatch(saved.draft, storage) : null); setLoaded(true); }, [userId, id]);
  useEffect(() => {
    if (!task) return;
    let active = true;
    setRunning(true);
    void submitPlatformBatch({draft: task.draft, submissions: task.submissions, storage, send: createPost, onUpdate: value => {if (active) setBatch(value);}})
      .then(value => {if (active) setBatch(value);})
      .finally(() => {if (active) setRunning(false);});
    return () => {active = false;};
  }, [task, attempt]);
  const loadPosts = useCallback(async (signal?: AbortSignal) => {
    const posts = await getPosts(signal);
    if (!task) return posts;
    const pending = pendingTaskPosts(task, batch).filter((_, index) => !posts.some(post => post.submissionId === batch?.entries[index]?.submissionId || post.id === batch?.entries[index]?.postId));
    return [...pending, ...posts].sort((a, b) => b.createdAt - a.createdAt);
  }, [id, task, batch]);
  if (!loaded) return <p role="status">{t("loading")}</p>;
  return <>
    {task && !batch && <p role="status">{t("saving")}</p>}
    {batch?.entries.some(entry => entry.failed) && <div role="alert" className="mb-6 rounded-xl border border-line p-4"><p>{t("submitFailed")}</p><button disabled={running} onClick={() => setAttempt(value => value + 1)} className="mt-3 rounded-lg border border-line px-4 py-2">{running ? t("saving") : t("retry")}</button></div>}
    <HistoryWorkspace highlightedPostId={id} onNewPost={onHistory} initialPosts={task ? pendingTaskPosts(task, batch) : []} loadPosts={loadPosts} />
  </>;
}
