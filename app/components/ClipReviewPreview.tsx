"use client";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Heart, ThumbsDown, Scissors, Loader2, RotateCw } from "lucide-react";
import { ContinuousProxyPlayer } from "./VideoClipEditor";
import { FinalRenderPanel } from "./FinalRenderPanel";
import { Link } from "@/i18n/navigation";
import type { StoredClipCandidate } from "@/lib/video-workspace/candidates";
import type { EditorWorkspace } from "@/lib/video-workspace/editor";
import { publishContent } from "@/lib/video-workspace/publish";
import { buildTimelineSegments } from "@/lib/video-workspace/timeline";
const noop = () => {};
export function clipTime(ms: number) { const s=Math.floor(ms/1000),h=Math.floor(s/3600),m=Math.floor(s%3600/60),ss=String(s%60).padStart(2,"0"); return h ? `${h}:${String(m).padStart(2,"0")}:${ss}` : `${m}:${ss}`; }
export function ClipReviewPreview({projectId,candidate,canEdit,onEdit,onMark,previewStatus}: {projectId:string;candidate:StoredClipCandidate;canEdit:boolean;onEdit:()=>void;onMark:(mark:"keep"|"discard"|null)=>Promise<void>;previewStatus?:string}) {
  const t=useTranslations("ClipWorkflow"); const te=useTranslations("Dashboard.videoCandidates.editor");
  const [workspace,setWorkspace]=useState<EditorWorkspace|null>(null); const [error,setError]=useState(false); const [reload,setReload]=useState(0); const [markBusy,setMarkBusy]=useState(false);
  useEffect(()=>{ const controller=new AbortController();setError(false);
    fetch(`/api/video-projects/${projectId}/editor?candidateId=${encodeURIComponent(candidate.id)}&view=review`,{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();return r.json() as Promise<EditorWorkspace>;}).then(setWorkspace).catch(()=>{if(!controller.signal.aborted)setError(true);});
    return ()=>controller.abort();
  },[projectId,candidate.id,reload,previewStatus]);
  const timeline=useMemo(()=>workspace ? buildTimelineSegments(workspace.edl,workspace.proxies):[],[workspace]);
  const text=workspace ? workspace.edl.segments.slice().sort((a,b)=>a.order-b.order).map(s=>({id:s.id,start:s.sourceStartMs,end:s.sourceEndMs,text:publishContent({...workspace.edl,segments:[s]},workspace.renderSpec)})):[];
  const prepareDraft=async()=>{if(!workspace)throw Error("workspace_not_ready");if(!canEdit)return workspace.revision;
    const r=await fetch(`/api/video-projects/${projectId}/editor`,{method:"PUT",headers:{"content-type":"application/json"},body:JSON.stringify({candidateId:candidate.id,expectedRevision:workspace.revision,edl:workspace.edl,renderSpec:workspace.renderSpec,publishDraft:workspace.publishDraft})});if(!r.ok){setReload(n=>n+1);throw Error("draft_conflict");}const data=await r.json() as {revision:number};setWorkspace({...workspace,revision:data.revision});return data.revision;};
  const mark=async(value:"keep"|"discard")=>{setMarkBusy(true);try{await onMark(candidate.reviewMark===value ? null : value);}finally{setMarkBusy(false);}};
  return <section aria-label={t("review")} className="flex min-w-0 flex-col p-4 lg:h-full lg:pb-20">
    <div className="mb-3 flex shrink-0 items-start justify-between gap-4"><div><h3 className="font-display text-title font-semibold leading-snug tracking-tight text-ink">{candidate.theme==="manual_source" ? te("customClipTitle") : candidate.theme}</h3><p className="mt-1.5 font-mono text-meta text-muted tabular-nums">{(text.length ? text.map(s=>({startMs:s.start,endMs:s.end})):candidate.segments).map(s=>`${clipTime(s.startMs)} – ${clipTime(s.endMs)}`).join(" · ")}</p></div><div className="flex shrink-0 gap-1">{(["keep","discard"] as const).map(value=><button key={value} type="button" aria-label={t(value)} aria-pressed={candidate.reviewMark===value} disabled={markBusy} onClick={()=>void mark(value)} title={t(value)} className="grid size-10 place-items-center rounded-control border border-line text-muted transition hover:border-ink/30 hover:text-ink aria-pressed:border-accent aria-pressed:bg-accent/10 aria-pressed:text-accent">{value==="keep"?<Heart size={17} fill={candidate.reviewMark===value?"currentColor":"none"}/>:<ThumbsDown size={17}/>}</button>)}</div></div>
    {workspace ? <div className="mx-auto h-[48dvh] w-full min-h-[230px] max-w-[390px] lg:h-auto lg:flex-1"><ContinuousProxyPlayer readOnly panel="content" setPanel={noop} controlsHost={null} onDraftActive={noop} timeline={timeline} renderSpec={workspace.renderSpec} assets={workspace.assets} onChange={noop} labels={{play:te("play"),pause:te("pause"),previewMissing:te("previewMissing"),dragToReframe:""}}/></div> : <div className="fixed-media-surface mx-auto grid aspect-[9/16] h-[max(260px,calc(100dvh-540px))] w-auto place-items-center rounded-card bg-black text-white/70">{error?<button onClick={()=>setReload(n=>n+1)} className="flex items-center gap-2 p-4"><RotateCw size={18}/>{t("retry")}</button>:<Loader2 className="animate-spin"/>}</div>}
    <div className="mx-auto mt-3 flex shrink-0 max-w-xl flex-wrap items-center justify-center gap-2">{canEdit?<button onClick={onEdit} className="inline-flex min-h-10 items-center gap-2 rounded-control bg-accent px-4 text-body-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"><Scissors size={16}/>{t("edit")}</button>:<Link href="/pricing" className="inline-flex min-h-10 items-center rounded-control border border-line px-4 text-body-sm font-medium transition hover:border-ink/30">{t("upgradeEdit")}</Link>}{workspace?<FinalRenderPanel compact generatedOnly={!canEdit} projectId={projectId} candidateId={candidate.id} revision={workspace.revision} disabled={false} prepareDraft={prepareDraft} onConflict={()=>setReload(n=>n+1)}/>:null}</div>
    <div className="mt-3 grid shrink-0 grid-cols-2 items-start gap-2"><details className="rounded-control border border-line bg-card"><summary className="cursor-pointer px-4 py-3 text-body-sm font-semibold">{t("transcript")}</summary><div className="max-h-72 space-y-4 overflow-y-auto border-t border-line px-4 py-4">{text.map(s=><div key={s.id}><p className="mb-1.5 font-mono text-caption text-muted">{clipTime(s.start)} – {clipTime(s.end)}</p><p className="text-body-sm leading-6 text-ink/85">{s.text}</p></div>)}</div></details>
    {candidate.origin==="ai" ? <details className="rounded-control border border-generated/40 bg-generated/[0.08] text-body-sm"><summary className="cursor-pointer px-4 py-3 font-semibold text-ink">{t("reason")}</summary><p className="px-4 pb-3 leading-6 text-ink/75">{candidate.reason}</p></details>:null}
    </div>
  </section>;
}
