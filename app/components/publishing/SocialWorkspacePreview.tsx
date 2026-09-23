"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clapperboard, LockKeyhole, Plus, Send, Link2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { UpgradePlanButton } from "../UpgradePlanButton";
import { PUBLISH_PLATFORMS, SPECS } from "./shared/specs";

export type SocialPreviewView = "posts" | "planner" | "channels";
export function SocialWorkspacePreview({view}: {view: SocialPreviewView}) {
  const t = useTranslations("SocialAccess");
  const nav = useTranslations("WorkspaceNav");
  const planner = useTranslations("Planner");
  const locale = useLocale();
  const [status, setStatus] = useState("published");
  const [platform, setPlatform] = useState("all");
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const days = new Date(month.getFullYear(), month.getMonth()+1, 0).getDate();
  const upgradeClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90";
  const outlineClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium hover:bg-accent/10";
  return <>
    <header className="mb-6 flex items-center justify-between gap-4"><h1 className="font-display text-2xl font-semibold">{nav(view)}</h1><UpgradePlanButton className={outlineClass}><LockKeyhole size={15}/>{t("unlock")}</UpgradePlanButton></header>
    <section className="relative overflow-hidden rounded-2xl border border-accent/25 bg-accent/10 p-6 sm:p-8">
      <div className="grid items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div><h2 className="max-w-xl font-display text-2xl font-semibold tracking-tight sm:text-3xl">{t("workspaceTitle")}</h2>
          <ul className="my-6 grid gap-3 text-sm text-ink/75">{(["benefitChannels","benefitPublish","benefitSchedule"] as const).map(key=><li key={key} className="flex items-start gap-3"><Check size={17} className="mt-0.5 shrink-0 text-accent"/><span>{t(key)}</span></li>)}</ul>
          <UpgradePlanButton className={upgradeClass}><LockKeyhole size={16}/>{t("unlock")}</UpgradePlanButton>
        </div>
        <div className="hidden rounded-xl border border-line bg-paper p-5 shadow-sm lg:block" aria-label={t("example")}>
          <div className="mb-4 flex items-center justify-between text-xs text-muted"><span>{t("example")}</span><Send size={16}/></div>
          <div className="flex gap-4"><div className="flex aspect-[9/16] w-24 shrink-0 flex-col items-center justify-center gap-3 rounded-lg bg-accent/15 text-accent"><Clapperboard size={30}/><span className="px-2 text-center text-xs">{t("exampleClip")}</span></div>
            <div className="flex flex-1 flex-col justify-center gap-3">{PUBLISH_PLATFORMS.map(p=><div key={p} className="flex items-center justify-between rounded-lg border border-line bg-card px-3 py-2 text-sm"><span>{SPECS[p].label}</span><Check size={14} className="text-accent"/></div>)}<div className="flex items-center gap-2 text-xs text-muted"><CalendarDays size={14}/>{t("benefitSchedule")}</div></div>
          </div>
        </div>
      </div>
    </section>
    {view!=="channels" && <section className="my-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-card p-5"><div className="flex items-center gap-4"><div className="rounded-full bg-accent/10 p-3 text-accent"><Link2 size={22}/></div><div><h2 className="font-semibold">{t("manageChannels")}</h2><p className="mt-1 text-sm text-muted">{PUBLISH_PLATFORMS.map(p=>SPECS[p].label).join(" · ")}</p></div></div><Link href="/dashboard/accounts" className="text-sm font-medium underline underline-offset-4">{nav("channels")}</Link></section>}
    <section className="mt-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-lg font-semibold">{nav(view)}</h2><UpgradePlanButton className={outlineClass}><Plus size={16}/>{t(view==="channels"?"connect":view==="planner"?"schedulePost":"newPost")}</UpgradePlanButton></div>
      {view==="posts" && <div className="overflow-hidden rounded-xl border border-line bg-card">
        <div className="flex overflow-x-auto border-b border-line px-4" role="tablist" aria-label={nav("posts")}>{(["published","scheduled","failed"] as const).map(value=><button key={value} role="tab" aria-selected={status===value} onClick={()=>setStatus(value)} className={`flex min-h-14 items-center gap-2 whitespace-nowrap border-b-2 px-4 text-sm ${status===value?"border-accent font-semibold text-ink":"border-transparent text-muted"}`}>{planner(value)}<LockKeyhole size={12}/></button>)}</div>
        <div className="border-b border-line p-4"><select aria-label={t("platformFilter")} value={platform} onChange={e=>setPlatform(e.target.value)} className="rounded-lg border border-line bg-paper px-3 py-2 text-sm"><option value="all">{t("platformFilter")}</option>{PUBLISH_PLATFORMS.map(p=><option key={p} value={p}>{SPECS[p].label}</option>)}</select></div>
        <div className="grid grid-cols-[1.5fr_1fr] gap-4 border-b border-line bg-paper px-5 py-3 text-xs text-muted sm:grid-cols-[1.5fr_1fr_1fr]"><span>{t("content")}</span><span>{planner("dateTime")}</span><span className="hidden sm:block">{nav("channels")}</span></div>
        <div className="relative min-h-64 p-5"><div aria-hidden="true" className="grid gap-5 opacity-35 blur-[3px]">{[0,1,2].map(i=><div key={i} className="flex items-center gap-4"><div className="h-16 w-12 rounded bg-accent/20"/><div className="flex-1 space-y-3"><div className="h-3 w-2/5 rounded bg-muted/25"/><div className="h-2 w-1/4 rounded bg-muted/15"/></div><div className="h-3 w-1/5 rounded bg-accent/20"/></div>)}</div><div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/50 px-5 text-center"><span className="rounded-full border border-line bg-card px-3 py-1 text-xs text-muted">{t("example")}</span><p className="font-semibold">{t("unlockHistory")}</p><UpgradePlanButton className="text-sm font-semibold text-accent underline underline-offset-4">{t("unlock")}</UpgradePlanButton></div></div>
      </div>}
      {view==="planner" && <div className="overflow-hidden rounded-xl border border-line bg-card"><div className="flex items-center justify-between gap-3 border-b border-line p-4"><h3 className="font-semibold">{new Intl.DateTimeFormat(locale,{month:"long",year:"numeric"}).format(month)}</h3><div className="flex gap-2"><button aria-label={planner("previous")} onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))} className="rounded-lg border border-line p-2"><ChevronLeft size={18}/></button><button aria-label={planner("next")} onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))} className="rounded-lg border border-line p-2"><ChevronRight size={18}/></button></div></div><div className="grid grid-cols-7">{Array.from({length:7},(_,i)=><div key={i} className="border-b border-line p-2 text-center text-xs text-muted">{new Intl.DateTimeFormat(locale,{weekday:"short"}).format(new Date(2026,0,4+i))}</div>)}{Array.from({length:month.getDay()+days},(_,i)=>{const day=i-month.getDay()+1;return <div key={i} className="min-h-16 border-b border-r border-line p-2 sm:min-h-24">{day>0 && <UpgradePlanButton aria-label={`${t("schedulePost")} ${day}`} className="flex h-full flex-col gap-2 rounded text-xs hover:bg-accent/10"><span>{day}</span>{day===12 && <span className="hidden rounded bg-accent/10 p-1 text-accent sm:block">{t("example")}</span>}</UpgradePlanButton>}</div>;})}</div><div className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm"><span className="text-muted">{t("calendarHint")}</span><UpgradePlanButton className="font-semibold text-accent">{t("unlock")}</UpgradePlanButton></div></div>}
      {view==="channels" && <div className="grid gap-4 md:grid-cols-3">{PUBLISH_PLATFORMS.map(p=><div key={p} className="rounded-xl border border-line bg-card p-6"><div className="mb-5 flex items-center justify-between"><h3 className="font-semibold">{SPECS[p].label}</h3><Link2 size={20} className="text-muted"/></div><p className="mb-5 text-sm text-muted">{t("channelHint")}</p><UpgradePlanButton className={outlineClass}><Plus size={16}/>{t("connect")}</UpgradePlanButton></div>)}</div>}
    </section>
  </>;
}
