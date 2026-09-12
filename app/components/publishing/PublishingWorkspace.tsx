"use client";
import {useEffect, useState} from "react";
import {useTranslations} from "next-intl";
import {useSearchParams} from "next/navigation";
import {Link, useRouter} from "@/i18n/navigation";
import {AccountsWorkspace} from "./AccountsWorkspace";
import {ComposeWorkspace, type ComposeDraft} from "./ComposeWorkspace";
import {HistoryWorkspace} from "./HistoryWorkspace";
import "./publishing.css";
export function PublishingWorkspace({view, userId}: {view: "accounts" | "compose" | "history"; userId: string}) {
  const t = useTranslations("DistributionNav");
  const router = useRouter(); const search = useSearchParams();
  const [draft, setDraft] = useState<ComposeDraft | null>(null);
  const [phase, setPhase] = useState("loading");
  const returnKey = `scribix:compose-return:${userId}`;
  const [resume, setResume] = useState<string | null>(null);
  useEffect(() => { try {const value = sessionStorage.getItem(returnKey); if (value?.startsWith("/dashboard/publish?")) setResume(value);} catch {} }, [returnKey]);
  const [attempt, setAttempt] = useState(0);
  const query = new URLSearchParams({projectId: search.get("projectId") ?? "", candidateId: search.get("candidateId") ?? "", renderJobId: search.get("renderJobId") ?? ""}).toString();
  useEffect(() => {
    if (view !== "compose" || !search.get("renderJobId")) { setPhase("ready"); return; }
    const controller = new AbortController(); setPhase("loading");
    fetch(`/api/social/review?${query}`, {signal: controller.signal, cache: "no-store"}).then(async response => {
      if (!response.ok) throw new Error();
      const value = await response.json() as ComposeDraft;
      if (!controller.signal.aborted) {setDraft(value); setPhase("ready"); const target = `/dashboard/publish?${query}`; setResume(target); try {sessionStorage.setItem(returnKey, target);} catch {}}
    }).catch(() => {if (!controller.signal.aborted) setPhase("error");});
    return () => controller.abort();
  }, [view, query, attempt, returnKey]);
  const library = () => router.push("/dashboard");
  return <div className="mx-auto max-w-[1320px] px-4 py-8 sm:px-8">
    <nav aria-label={t("navigation")} className="mb-8 flex flex-wrap gap-2 border-b border-line pb-4">
      {([['accounts', '/dashboard/accounts'], ['compose', '/dashboard/publish'], ['history', '/dashboard/publishing']] as const).map(([key, href]) => <Link key={key} href={key === "compose" && resume ? resume : href} aria-current={key === view ? "page" : undefined} className={`rounded-lg px-4 py-2 text-sm font-semibold ${key === view ? "bg-accent/15 text-accent" : "text-muted hover:bg-card"}`}>{t(key)}</Link>)}
    </nav>
    {view === "accounts" && resume && <Link className="mb-5 inline-block text-sm text-accent underline" href={resume}>{t("compose")}</Link>}
    {view === "accounts" && <AccountsWorkspace onNewPost={library} />}
    {view === "history" && <HistoryWorkspace highlightedPostId={search.get("post")} onNewPost={library} />}
    {view === "compose" && <>
      {search.get("projectId") && <Link className="mb-5 inline-block text-sm text-accent underline" href={`/dashboard/video-projects/${encodeURIComponent(search.get("projectId")!)}`}>{t("back")}</Link>}
      {phase === "loading" ? <p role="status">{t("loading")}</p> : phase === "error" ? <div role="alert"><p>{t("unavailable")}</p><button className="mt-3 rounded-lg border border-line px-4 py-2" onClick={() => setAttempt(a => a + 1)}>{t("retry")}</button></div> : <ComposeWorkspace draft={draft} onNewPost={library} onConnectChannel={() => {try {sessionStorage.setItem(returnKey, `/dashboard/publish?${query}`);} catch {} router.push("/dashboard/accounts");}} onPublished={id => {try {sessionStorage.removeItem(returnKey);} catch {} router.push(`/dashboard/publishing?post=${encodeURIComponent(id)}`);}} />}
    </>}
  </div>;
}
