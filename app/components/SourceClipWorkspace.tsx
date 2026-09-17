"use client";
import {useEffect, useMemo, useRef, useState} from "react";
import {useTranslations} from "next-intl";
import {VIDEO_WORKSPACE_LIMITS} from "@/lib/video-workspace/contracts";
import type {StoredClipCandidate} from "@/lib/video-workspace/candidates";
import {Link} from "@/i18n/navigation";

type Word = {text:string;start:number;end:number};
type Source = {url:string;durationMs:number;words:Word[]};

function timestamp(ms:number) {const seconds=ms/1000;return `${Math.floor(seconds/60)}:${(seconds%60).toFixed(2).padStart(5,"0")}`;}
function milliseconds(text:string) {const parts=text.split(":").map(Number);return parts.length===2 && parts.every(Number.isFinite) && parts[0]>=0 && parts[1]>=0 && parts[1]<60 ? Math.round((parts[0]*60+parts[1])*1000) : NaN;}
export function SourceClipWorkspace({projectId,canEdit,onCreated,active}: {active:boolean;projectId:string;canEdit:boolean;onCreated:(candidates:StoredClipCandidate[],id:string)=>void}) {
  const t=useTranslations("SourceClips");
  const [source,setSource]=useState<Source|null>(null);
  const [error,setError]=useState(false);
  const [loading,setLoading]=useState(true);
  const [attempt,setAttempt]=useState(0);
  const [start,setStart]=useState("0:00.00");
  const [end,setEnd]=useState("0:30.00");
  const [match,setMatch]=useState(0);
  const currentWord=useRef<HTMLElement|null>(null);
  const [busy,setBusy]=useState(false);
  const [playingSelection,setPlayingSelection]=useState(false);
  const [search,setSearch]=useState("");
  const video=useRef<HTMLVideoElement>(null);
  const transcript=useRef<HTMLDivElement>(null);
  const pending=useRef<{requestId:string;startMs:number;endMs:number}|null>(null);
  const storageKey=`scribix:source-selection:${projectId}`;
  const anchor=useRef<number|null>(null);
  useEffect(()=>{if(!active){video.current?.pause();setPlayingSelection(false);}},[active]);

  const startMs=milliseconds(start),endMs=milliseconds(end);
  useEffect(()=>{video.current?.pause();setPlayingSelection(false);},[startMs,endMs]);
  const valid=Boolean(source && Number.isInteger(startMs) && Number.isInteger(endMs) && startMs>=0 && endMs<=source.durationMs && endMs-startMs>=VIDEO_WORKSPACE_LIMITS.minSegmentDurationMs && endMs-startMs<=VIDEO_WORKSPACE_LIMITS.maxTimelineDurationMs);
  useEffect(()=>{
    const controller=new AbortController(); let timer: ReturnType<typeof setTimeout>;
    setLoading(true);setError(false);
    try {const saved=JSON.parse(sessionStorage.getItem(storageKey)??"null");if(saved?.requestId && Number.isInteger(saved.startMs) && Number.isInteger(saved.endMs))pending.current=saved;}catch{}
    async function load(){try {
      const response=await fetch(`/api/video-projects/${projectId}/source-clips`,{signal:controller.signal,cache:"no-store"});
      if(response.status===409){timer=setTimeout(load,4000);return;}
      if(!response.ok)throw new Error();
      const data=await response.json() as Source;
      if(!controller.signal.aborted){setSource(data);setStart(timestamp(pending.current?.startMs??0));setEnd(timestamp(pending.current?.endMs??Math.min(30000,data.durationMs)));setLoading(false);}
    }catch {if(!controller.signal.aborted){setError(true);setLoading(false);}}}
    void load();return()=>{controller.abort();clearTimeout(timer);};
  },[projectId,attempt,storageKey]);
  const paragraphs=useMemo(()=>{
    const groups:{offset:number;words:Word[]}[]=[];
    for(const [index,word] of (source?.words??[]).entries()) {
      const last=groups.at(-1);
      if(!last || last.words.length>=65 || (last.words.length>=25 && /[.!?]$/.test(last.words.at(-1)!.text))) groups.push({offset:index,words:[word]});
      else last.words.push(word);
    }
    return groups;
  },[source]);
  const matches=useMemo(()=>{
    const query=search.trim().toLocaleLowerCase();
    if(!query || !source)return [];
    const text=source.words.map(word=>word.text.toLocaleLowerCase()).join(" ");
    const offsets:number[]=[];let offset=0;
    for(const word of source.words){offsets.push(offset);offset+=word.text.length+1;}
    const found:number[]=[];
    for(let position=text.indexOf(query);position>=0;position=text.indexOf(query,position+query.length)) {
      let index=0;while(index+1<offsets.length && offsets[index+1]<=position)index++;
      if(found.at(-1)!==index)found.push(index);
    }
    return found;
  },[source,search]);
  function reveal(index:number) {
    const element=transcript.current?.querySelector<HTMLElement>(`[data-word="${index}"]`);
    element?.scrollIntoView({block:"center",behavior:"instant"});
  }
  function findMatch(next:number) {
    if(!matches.length)return;
    const index=(next+matches.length)%matches.length;setMatch(index);reveal(matches[index]);
  }
  function chooseWord(index:number,extend:boolean) {
    if(!source || busy)return;
    if(extend && anchor.current!==null){setStart(timestamp(source.words[Math.min(index,anchor.current)].start));setEnd(timestamp(source.words[Math.max(index,anchor.current)].end));}
    else {anchor.current=index;if(video.current)video.current.currentTime=source.words[index].start/1000;}
  }
  function updatePlayback() {
    if(!video.current || !source)return;
    const time=video.current.currentTime*1000;
    let low=0,high=source.words.length-1;
    while(low<=high){const middle=(low+high)>>1;if(source.words[middle].start<=time)low=middle+1;else high=middle-1;}
    const index=high>=0 && source.words[high].end>=time ? high : -1;
    const element=transcript.current?.querySelector<HTMLElement>(`[data-word="${index}"]`)??null;
    if(element!==currentWord.current){currentWord.current?.removeAttribute("data-playing");element?.setAttribute("data-playing","true");currentWord.current=element;}
    if(playingSelection && time>=endMs){video.current.pause();video.current.currentTime=endMs/1000;setPlayingSelection(false);}
  }
  const selectText=()=>{
    if(busy)return;
    const selection=window.getSelection();if(!selection || selection.isCollapsed || !transcript.current)return;
    const wordIndex=(node:Node|null)=>{const element=node?.nodeType===Node.ELEMENT_NODE ? node as Element : node?.parentElement;const span=element?.closest<HTMLElement>("[data-word]");return span && transcript.current?.contains(span) ? Number(span.dataset.word) : null;};
    const a=wordIndex(selection.anchorNode),b=wordIndex(selection.focusNode);
    if(a===null || b===null || !source)return;
    setStart(timestamp(source.words[Math.min(a,b)].start));setEnd(timestamp(source.words[Math.max(a,b)].end));
  };
  async function create(){
    if(!valid || busy || !canEdit)return;setBusy(true);setError(false);
    if(!pending.current || pending.current.startMs!==startMs || pending.current.endMs!==endMs)pending.current={requestId:crypto.randomUUID(),startMs,endMs};
    try {
      sessionStorage.setItem(storageKey,JSON.stringify(pending.current));
      const response=await fetch(`/api/video-projects/${projectId}/source-clips`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(pending.current)});
      if(!response.ok)throw new Error();
      const result=await response.json() as {candidates:StoredClipCandidate[];candidateId:string};
      onCreated(result.candidates,result.candidateId);pending.current=null;sessionStorage.removeItem(storageKey);
    }catch{setError(true);}finally{setBusy(false);}
  }
  if(loading)return <p role="status" className="rounded-2xl border border-line bg-card p-8 text-muted">{t("loading")}</p>;
  if(!source)return <div role="alert" className="p-6">{t("error")} <button className="text-accent underline" onClick={()=>setAttempt(value=>value+1)}>{t("retry")}</button></div>;
  const duration=Number.isFinite(endMs-startMs) ? Math.max(0,(endMs-startMs)/1000) : 0;
  return <div className="rounded-xl border border-line bg-card p-4 sm:p-5">
    <div className="mb-4 flex items-start justify-between gap-3">
      <div><h2 className="font-display text-lg font-semibold">{t("title")}</h2><p className="mt-1 text-sm text-muted">{t("hint")}</p></div>
      <details className="relative shrink-0 text-sm text-muted"><summary className="cursor-pointer rounded-lg px-2 py-1">{t("help")}</summary><p className="absolute right-0 z-10 mt-2 w-64 rounded-xl border border-line bg-paper p-4 shadow-lg">{t("selectionHelp")}</p></details>
    </div>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="min-w-0">
        <video ref={video} src={source.url} controls preload="metadata" className="aspect-video w-full rounded-lg bg-black" onTimeUpdate={updatePlayback} onPause={()=>setPlayingSelection(false)} />
        <fieldset disabled={busy} className="mt-4">
          <div className="relative mb-3 h-8">
            <div className="absolute inset-x-0 top-3 h-2 overflow-hidden rounded-full bg-accent/10" aria-hidden="true"><div className="absolute h-full bg-accent" style={{left:`${Math.max(0,startMs/source.durationMs*100)||0}%`,width:`${Math.max(0,(endMs-startMs)/source.durationMs*100)||0}%`}} /></div>
            {(["start","end"] as const).map(boundary=><input key={boundary} style={{background:"transparent"}} type="range" aria-label={t(boundary==="start"?"adjustStart":"adjustEnd")} min={0} max={source.durationMs} step={10} value={Math.max(0,Math.min(source.durationMs,(boundary==="start"?startMs:endMs)||0))} onChange={event=>(boundary==="start"?setStart:setEnd)(timestamp(Number(event.target.value)))} className="pointer-events-none absolute inset-0 m-0 h-8 w-full appearance-none bg-transparent focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:cursor-ew-resize [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-paper [&::-webkit-slider-thumb]:bg-accent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:cursor-ew-resize [&::-moz-range-thumb]:rounded [&::-moz-range-thumb]:bg-accent" />)}
          </div>
          <div className="grid grid-cols-2 gap-4">
            {(["start","end"] as const).map(boundary=><label key={boundary} className="text-xs text-muted">
              {t(boundary)}
              <input aria-label={t(boundary)} value={boundary==="start"?start:end} onChange={event=>(boundary==="start"?setStart:setEnd)(event.target.value)} className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 font-mono text-sm text-ink" />

              <button type="button" className="mt-1 min-h-8 text-accent hover:underline" onClick={()=>(boundary==="start"?setStart:setEnd)(timestamp(Math.round((video.current?.currentTime??0)*1000)))}>{t(boundary==="start"?"setStart":"setEnd")}</button>
            </label>)}
          </div>
        </fieldset>
        <div className="mt-3 border-t border-line pt-3">
          <p className={`mb-3 text-sm ${valid?"text-muted":"text-red-500"}`} role="status">{valid?t("selectedDuration",{seconds:Math.round(duration*10)/10,max:VIDEO_WORKSPACE_LIMITS.maxTimelineDurationMs/1000}):t("invalidRange",{max:VIDEO_WORKSPACE_LIMITS.maxTimelineDurationMs/1000})}</p>
          <div className="flex flex-wrap gap-2">
            <button disabled={!valid || busy} className="min-h-10 rounded-lg border border-line px-4 text-sm disabled:opacity-40" onClick={()=>{if(video.current){if(playingSelection){video.current.pause();return;}video.current.currentTime=startMs/1000;setPlayingSelection(true);void video.current.play().catch(()=>setPlayingSelection(false));}}}>{t(playingSelection?"stopPreview":"preview")}</button>
            {canEdit?<button disabled={!valid || busy} className="min-h-10 rounded-lg bg-accent px-5 text-sm font-semibold text-white disabled:opacity-40" onClick={()=>void create()}>{t(busy?"creating":"create")}</button>:<Link href="/dashboard/billing" className="rounded-lg border border-line px-4 py-2 text-sm">{t("upgrade")}</Link>}
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-red-500">{t("error")}</p>}
        </div>
      </div>
      <div className="flex min-w-0 flex-col lg:h-[min(620px,calc(100dvh-240px))] lg:min-h-[420px]">
        <form className="flex items-center gap-1 border-b border-line pb-3" onSubmit={event=>{event.preventDefault();findMatch(match);}}>
          <input aria-label={t("search")} placeholder={t("search")} value={search} onChange={event=>{setSearch(event.target.value);setMatch(0);}} className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm" />
          <button className="min-h-10 rounded-lg px-2 text-sm hover:bg-accent/10">{t("find")}</button>
        </form>
        <div className="flex min-h-10 items-center justify-between gap-2 text-xs text-muted">
          <span role="status">{search.trim()?t("matches",{current:matches.length?match+1:0,total:matches.length}):t("transcript")}</span>
          <div className="flex items-center gap-1">{search.trim() && <><button aria-label={t("previous")} disabled={!matches.length} onClick={()=>findMatch(match-1)} className="h-8 w-8 rounded hover:bg-accent/10 disabled:opacity-30">↑</button><button aria-label={t("next")} disabled={!matches.length} onClick={()=>findMatch(match+1)} className="h-8 w-8 rounded hover:bg-accent/10 disabled:opacity-30">↓</button></>}<button disabled={!source.words.length} onClick={()=>reveal(Math.max(0,source.words.findIndex(word=>word.end>startMs)))} className="min-h-8 px-2 text-accent">{t("backToSelection")}</button></div>
        </div>
        <div ref={transcript} onMouseUp={selectText} onTouchEnd={selectText} className="max-h-[460px] flex-1 overflow-y-auto overscroll-contain pr-3 text-sm leading-7 lg:max-h-none" aria-label={t("transcript")} aria-busy={busy}>
          {paragraphs.map(paragraph=><p key={paragraph.offset} className="mb-5" style={{contentVisibility:"auto",containIntrinsicSize:"auto 160px"}}>
            <button className="mb-1 block font-mono text-[11px] text-muted hover:text-accent" aria-label={`${t("source")} ${timestamp(paragraph.words[0].start)}`} onClick={()=>chooseWord(paragraph.offset,false)}>{timestamp(paragraph.words[0].start)}</button>
            {paragraph.words.map((word,offset)=>{const index=paragraph.offset+offset;return <span key={index} role="button" tabIndex={0} data-word={index} aria-label={`${timestamp(word.start)} ${word.text}`} className={`cursor-pointer py-0.5 hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent data-[playing=true]:bg-accent data-[playing=true]:text-white ${word.start>=startMs && word.end<=endMs?"bg-accent/15":""} ${matches[match]===index?"underline decoration-accent decoration-2 underline-offset-4":""}`} onClick={event=>{if(window.getSelection()?.isCollapsed===false)return;chooseWord(index,event.shiftKey);}} onKeyDown={event=>{if(event.key==="Enter" || event.key===" "){event.preventDefault();chooseWord(index,event.shiftKey);}}}>{word.text}{" "}</span>;})}
          </p>)}
          {!source.words.length && <p>{t("noWords")}</p>}
        </div>
      </div>
    </div>
  </div>;
}
