"use client";
import { useEffect, useRef, useState } from "react";
import { Loader2, Film } from "lucide-react";
import type { EditorWorkspace } from "@/lib/video-workspace/editor";
import { framingAt } from "@/lib/video-workspace/auto-framing";
import { browserCropStyle, coverCropBox } from "@/lib/video-workspace/presentation";
import { PreviewOverlays } from "./VideoClipEditor";
export function ClipStyledPoster({projectId,candidateId}:{projectId:string;candidateId:string}) {
  const host=useRef<HTMLDivElement>(null);
  const [workspace,setWorkspace]=useState<EditorWorkspace|null>(null);
  const [still,setStill]=useState<{url:string;width:number;height:number}|null>(null);
  const [failed,setFailed]=useState(false);
  useEffect(()=>{if(!host.current)return;const controller=new AbortController();const observer=new IntersectionObserver(entries=>{if(!entries.some(e=>e.isIntersecting))return;observer.disconnect();fetch(`/api/video-projects/${projectId}/editor?candidateId=${encodeURIComponent(candidateId)}&view=review`,{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error();return r.json() as Promise<EditorWorkspace>;}).then(setWorkspace).catch(()=>{if(!controller.signal.aborted)setFailed(true);});},{rootMargin:"80px"});observer.observe(host.current);return()=>{observer.disconnect();controller.abort();};},[projectId,candidateId]);
  const segment=workspace?.edl.segments.slice().sort((a,b)=>a.order-b.order)[0];
  const sourceMs=segment ? segment.sourceStartMs+Math.min(150,(segment.sourceEndMs-segment.sourceStartMs)/2):0;
  const proxy=workspace?.proxies.find(p=>p.segmentId===segment?.id);
  const framing=segment && workspace ? framingAt(workspace.renderSpec.segments[segment.id],sourceMs):null;
  const style=framing && still && framing.framingMode!=="fit" ? browserCropStyle(coverCropBox(still.width,still.height,framing.crop)):{width:"100%",height:"100%",objectFit:"contain" as const};
  return <div ref={host} className="absolute inset-0 overflow-hidden bg-black [container-type:inline-size]">
    {still ? <><img alt="" src={still.url} style={style} className="absolute max-w-none"/>{workspace && segment ? <PreviewOverlays guides={false} segmentId={segment.id} sourceMs={sourceMs} timelineMs={sourceMs-segment.sourceStartMs} renderSpec={workspace.renderSpec} assets={workspace.assets}/>:null}</> : proxy && !failed ? <video src={proxy.url} crossOrigin="anonymous" preload="metadata" playsInline muted className="size-full object-contain" onLoadedMetadata={e=>{e.currentTarget.currentTime=(sourceMs-proxy.proxySourceStartMs)/1000;}} onError={()=>setFailed(true)} onSeeked={e=>{try{const v=e.currentTarget,c=document.createElement("canvas");c.width=480;c.height=Math.round(480*v.videoHeight/v.videoWidth);c.getContext("2d")!.drawImage(v,0,0,c.width,c.height);setStill({url:c.toDataURL("image/jpeg",0.8),width:v.videoWidth,height:v.videoHeight});}catch{setFailed(true);}}}/> : <span className="grid size-full place-items-center text-white/40">{failed?<Film size={22}/>:<Loader2 size={20} className="animate-spin"/>}</span>}
  </div>;
}
