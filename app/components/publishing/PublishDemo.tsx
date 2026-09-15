"use client";
import {useCallback, useEffect, useState} from "react";
import {useTranslations} from "next-intl";
import {useRouter} from "@/i18n/navigation";
import {HistoryWorkspace} from "./HistoryWorkspace";
import type {PublicPost} from "./shared/posts";

type Demo = {startedAt: number; partial: boolean; platforms: string[]; captions: Record<string, string>; retriedAt?: number};
const storageKey = "scribix:local-publish-demo";
export function PublishDemo({history}: {history: boolean}) {
  const t = useTranslations("PublishFlow");
  const router = useRouter();
  const [demo, setDemo] = useState<Demo | null>(null);
  useEffect(() => {try {setDemo(JSON.parse(sessionStorage.getItem(storageKey) ?? "null"));} catch {}}, []);
  const [platforms, setPlatforms] = useState(["youtube", "linkedin"]);
  const [tab, setTab] = useState("youtube");
  const [partial, setPartial] = useState(false);
  const [captions, setCaptions] = useState<Record<string, string>>({youtube: "Choosing impact over doing more.", linkedin: "Do fewer things well. Choose meaningful impact."});
  const progress = history && demo;
  const loadPosts = useCallback(async () => {
    if (!demo) return [];
    const elapsed = Date.now() - demo.startedAt;
    return demo.platforms.map(platform => {
      const failed = platform === "linkedin" && demo.partial && !demo.retriedAt;
      const processing = demo.retriedAt && platform === "linkedin" ? Date.now() - demo.retriedAt < 4000 : elapsed < 7000;
      const status = elapsed < 2500 ? "submitting" : processing ? "processing" : failed ? "failed" : "published";
      return {id: `demo-${platform}`, batchId: "demo", mediaId: "demo", caption: demo.captions[platform], status, createdAt: Math.floor(demo.startedAt / 1000),
        media: {filename: "Choose impact over doing everything", width: 1080, height: 1920},
        targets: [{id: platform, platform, accountName: platform === "youtube" ? "YouTube" : "LinkedIn", status, canRetry: failed, errorMessage: status === "failed" ? t("demoFailure") : null}],
      } as PublicPost;
    });
  }, [demo, t]);
  const retry = useCallback(async () => {
    if (!demo) return;
    const next = {...demo, retriedAt: Date.now()};
    sessionStorage.setItem(storageKey, JSON.stringify(next)); setDemo(next);
  }, [demo]);
  const start = () => {
    const next: Demo = {startedAt: Date.now(), partial, platforms, captions};
    sessionStorage.setItem(storageKey, JSON.stringify(next)); setDemo(next);
    router.push("/dashboard/publishing?demo=1");
  };
  return <div>
    <div className="mb-8 rounded-xl border border-accent/40 bg-accent/10 p-4 text-sm" role="status"><strong>{t("demo")}</strong><p className="mt-1">{t("demoHint")}</p></div>
    {progress ? <><button className="mb-6 text-accent underline" onClick={() => router.push("/dashboard/publish?demo=1")}>{t("restart")}</button><HistoryWorkspace highlightedPostId="demo" onNewPost={() => router.push("/dashboard/publish?demo=1")} loadPosts={loadPosts} retryTarget={retry} pollMs={1000} /></> : <div className="mx-auto max-w-2xl rounded-2xl border border-line bg-card p-6 sm:p-8">
      <h1 className="font-display text-3xl font-semibold">{t("demoSetup")}</h1>
      <p className="mb-6 mt-2 text-muted">Choose impact over doing everything · 0:21</p>
      <div className="mb-6 flex gap-6">{["youtube", "linkedin"].map(platform => <label key={platform} className="flex items-center gap-2"><input type="checkbox" checked={platforms.includes(platform)} onChange={event => setPlatforms(value => event.target.checked ? [...value, platform] : value.filter(item => item !== platform))} />{platform === "youtube" ? "YouTube" : "LinkedIn"}</label>)}</div>
      <div role="tablist" aria-label={t("postText")} className="mb-3 flex gap-3">{["youtube", "linkedin"].map(platform => <button key={platform} role="tab" aria-selected={tab === platform} className={`rounded-lg px-4 py-2 ${tab === platform ? "bg-accent/15 text-accent" : "text-muted"}`} onClick={() => setTab(platform)}>{platform === "youtube" ? "YouTube" : "LinkedIn"}</button>)}</div>
      <textarea aria-label={t("postText")} className="min-h-32 w-full rounded-xl border border-line bg-paper p-4" value={captions[tab]} onChange={event => setCaptions(value => ({...value, [tab]: event.target.value}))} />
      <label className="my-6 flex items-center gap-2"><input type="checkbox" checked={partial} onChange={event => setPartial(event.target.checked)} />{t("simulateFailure")}</label>
      <button disabled={!platforms.length} className="w-full rounded-xl bg-accent px-5 py-3 font-semibold text-paper disabled:opacity-40" onClick={start}>{t("startDemo")}</button>
    </div>}
  </div>;
}
