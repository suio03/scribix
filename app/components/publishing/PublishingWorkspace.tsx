"use client";
import {useEffect, useState} from "react";
import {useTranslations} from "next-intl";
import {useSearchParams} from "next/navigation";
import {Link, useRouter} from "@/i18n/navigation";
import {AccountsWorkspace} from "./AccountsWorkspace";
import {ComposeWorkspace, type ComposeDraft} from "./ComposeWorkspace";
import {HistoryWorkspace} from "./HistoryWorkspace";
import {ClipChangedError, prepareClipForPublishing} from "./prepare-clip";
import {createPublishTask} from "./publish-task";
import {PublishProgress} from "./PublishProgress";
import {PublishDemo} from "./PublishDemo";
import "./publishing.css";

export function PublishingWorkspace({view, userId, allowDemo = false}: {allowDemo?: boolean; view: "accounts" | "compose" | "history"; userId: string}) {
  const t = useTranslations("DistributionNav");
  const flow = useTranslations("PublishFlow");
  const ta = useTranslations("ClipActions");
  const router = useRouter();
  const search = useSearchParams();
  const [draft, setDraft] = useState<ComposeDraft | null>(null);
  const [phase, setPhase] = useState("loading");
  const returnKey = `scribix:compose-return:${userId}`;
  const [resume, setResume] = useState<string | null>(null);
  const [requestId] = useState(() => crypto.randomUUID());
  const [attempt, setAttempt] = useState(0);
  const taskId = search.get("task");
  const demo = allowDemo && search.get("demo") === "1";
  const projectId = search.get("projectId") ?? "";
  const candidateId = search.get("candidateId") ?? "";
  const query = new URLSearchParams({projectId, candidateId}).toString();
  const editorUrl = `/dashboard/video-projects/${encodeURIComponent(projectId)}?candidateId=${encodeURIComponent(candidateId)}`;
  useEffect(() => { try { const value = sessionStorage.getItem(returnKey); if (value?.startsWith("/dashboard/publish?")) setResume(value); } catch {} }, [returnKey]);
  useEffect(() => {
    if (demo || view !== "compose" || !projectId || !candidateId) { setPhase("ready"); setDraft(null); return; }
    const controller = new AbortController();
    setPhase("loading"); setDraft(null);
    const target = `/dashboard/publish?${query}`;
    setResume(target);
    try { sessionStorage.setItem(returnKey, target); } catch {}
    void prepareClipForPublishing({projectId, candidateId, signal: controller.signal, requestKey: `publish:${projectId}:${candidateId}:${attempt}:${requestId}`, onGenerating: () => setPhase("generating")})
      .then(value => { if (!controller.signal.aborted) { setDraft(value); setPhase("ready"); } })
      .catch(error => { if (!controller.signal.aborted) setPhase(error instanceof ClipChangedError ? "changed" : "error"); });
    return () => controller.abort();
  }, [demo, view, projectId, candidateId, query, attempt, returnKey, requestId]);
  const library = () => router.push("/dashboard");
  return <div className="mx-auto max-w-[1320px] px-4 py-8 sm:px-8">
    {!demo && view === "history" && <div className="mb-6 flex justify-end"><Link className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-[var(--action-text)]" href={resume ?? "/dashboard/publish"}>{t("compose")}</Link></div>}
    {view === "accounts" && resume && <Link className="mb-5 inline-block text-sm text-accent underline" href={resume}>{ta("backToPublish")}</Link>}
    {view === "accounts" && <AccountsWorkspace onNewPost={library} />}
    {!demo && view === "history" && !taskId && <HistoryWorkspace highlightedPostId={search.get("post")} onNewPost={library} />}
    {demo && <PublishDemo history={view === "history"} />}
    {!demo && view === "history" && taskId && <PublishProgress key={taskId} id={taskId} userId={userId} onHistory={() => router.push("/dashboard/publishing")} />}
    {allowDemo && !demo && <Link className="mb-6 inline-block text-sm text-accent underline" href="/dashboard/publish?demo=1">{flow("tryDemo")}</Link>}
    {!demo && view === "compose" && <>
      {projectId && <Link className="mb-5 inline-block text-sm text-accent underline" href={editorUrl}>{ta("backToEdit")}</Link>}
      {phase === "loading" || phase === "generating" ? <p role="status" className="py-12">{ta(phase === "generating" ? "preparingVideo" : "loading")}</p> : phase === "error" || phase === "changed" ? <div role="alert"><p>{ta(phase === "changed" ? "changed" : "failed")}</p><button className="mt-3 rounded-lg border border-line px-4 py-2" onClick={() => setAttempt(a => a + 1)}>{ta("retry")}</button></div> : <ComposeWorkspace onStart={(value, submissions) => { const task = createPublishTask(userId, value, submissions); router.push(`/dashboard/publishing?task=${task.id}`); }} draft={draft} onNewPost={library} onConnectChannel={() => router.push("/dashboard/accounts")} onPublished={id => router.push(`/dashboard/publishing?post=${encodeURIComponent(id)}`)} />}
    </>}
  </div>;
}
