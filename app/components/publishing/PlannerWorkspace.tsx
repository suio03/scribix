"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cancelSchedule, changeSchedule, getPosts } from "./api";
import type { PublicPost } from "./shared/posts";

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function localInput(seconds: number) {
  const date = new Date(seconds * 1000);
  return `${dayKey(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
export function PlannerWorkspace() {
  const t = useTranslations("Planner");
  const nav = useTranslations("WorkspaceNav");
  const distribution = useTranslations("DistributionNav");
  const locale = useLocale();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dateTime, setDateTime] = useState("");
  const [canceling, setCanceling] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try { const values = await getPosts(controller.signal, undefined, true); if (!controller.signal.aborted) {setPosts(values); setError(false);} }
      catch { if (!controller.signal.aborted) setError(true); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    const timer = setInterval(() => void load(), 15000);
    return () => {controller.abort(); clearInterval(timer);};
  }, [refresh]);
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(first); gridStart.setDate(1 - (first.getDay() + 6) % 7);
  const days = Array.from({length: 42}, (_, index) => {const day = new Date(gridStart); day.setDate(day.getDate() + index); return day;});
  const scheduled = posts.filter(post => post.scheduledAt != null);
  const current = posts.find(post => post.id === selected);
  const visible = scheduled.filter(post => {const date = new Date(post.scheduledAt! * 1000); return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();}).sort((a,b) => a.scheduledAt! - b.scheduledAt!);
  function select(post: PublicPost) {setSelected(post.id); setDateTime(localInput(post.scheduledAt!)); setCanceling(false);}
  async function save(cancel: boolean) {
    if (!current) return;
    setBusy(true); setError(false);
    try {
      if (cancel) await cancelSchedule(current.id);
      else await changeSchedule(current.id, Math.floor(new Date(dateTime).getTime() / 1000), timezone);
      setSelected(null); setRefresh(value => value + 1);
    } catch {setError(true);} finally {setBusy(false);}
  }
  return <main className="mx-auto max-w-[1320px] px-4 py-8 sm:px-8">
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4"><div><h1 className="font-display text-3xl font-semibold text-ink">{nav("planner")}</h1><p className="mt-2 text-sm text-muted">{timezone}</p></div><Link className="rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-[var(--action-text)]" href="/dashboard/publish">{distribution("compose")}</Link></header>
    <div className="mb-5 flex items-center gap-3"><button aria-label={t("previous")} className="rounded-lg border border-line p-2" onClick={() => setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronLeft size={18}/></button><h2 className="min-w-44 text-lg font-semibold">{new Intl.DateTimeFormat(locale,{year:"numeric",month:"long"}).format(month)}</h2><button aria-label={t("next")} className="rounded-lg border border-line p-2" onClick={() => setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronRight size={18}/></button><button className="ml-auto rounded-lg border border-line px-3 py-2 text-sm" onClick={() => {setMonth(new Date(new Date().getFullYear(),new Date().getMonth(),1)); setRefresh(value=>value+1);}}>{t("today")}</button></div>
    {error && <p role="alert" className="mb-4 text-danger">{t("error")}</p>}
    {loading ? <p role="status">{t("loading")}</p> : <>
      <div className="hidden overflow-hidden rounded-2xl border border-line bg-card md:block"><div className="grid grid-cols-7">{days.slice(0,7).map(day=><div key={dayKey(day)} className="border-b border-line p-3 text-sm text-muted">{new Intl.DateTimeFormat(locale,{weekday:"short"}).format(day)}</div>)}</div><div className="grid grid-cols-7">{days.map(day=><div key={dayKey(day)} className={`min-h-28 border-b border-r border-line p-2 ${day.getMonth() === month.getMonth() ? "" : "bg-paper text-muted"}`}><span className={`inline-grid size-7 place-items-center rounded-full text-sm ${dayKey(day) === dayKey(new Date()) ? "bg-accent text-[var(--action-text)]" : ""}`}>{day.getDate()}</span>{scheduled.filter(post=>dayKey(new Date(post.scheduledAt!*1000))===dayKey(day)).map(post=><button key={post.id} onClick={()=>select(post)} className="mt-2 block w-full rounded-lg bg-accent-soft p-2 text-left text-xs text-ink"><span className="block font-semibold">{new Intl.DateTimeFormat(locale,{hour:"2-digit",minute:"2-digit"}).format(post.scheduledAt!*1000)} · {post.targets.map(target=>target.platform).join(", ")}</span><span className="line-clamp-2">{post.caption || post.media?.filename}</span><span className="text-muted">{t(post.status === "scheduled" ? "scheduled" : post.status === "canceled" ? "canceled" : post.status === "published" ? "published" : post.status === "failed" || post.status === "partial" ? "failed" : "inProgress")}</span></button>)}</div>)}</div></div>
      {visible.length === 0 && <p className="py-10 text-center text-muted">{t("empty")}</p>}
      <div className="grid gap-3 md:hidden">{visible.map(post=><button key={post.id} className="rounded-xl border border-line bg-card p-4 text-left" onClick={()=>select(post)}><p className="text-sm text-muted">{new Intl.DateTimeFormat(locale,{dateStyle:"medium",timeStyle:"short"}).format(post.scheduledAt!*1000)}</p><p className="mt-2 line-clamp-2">{post.caption}</p></button>)}</div>
    </>}
    {current && <section className="mt-6 rounded-2xl border border-line bg-card p-6"><div className="flex justify-between gap-4"><h2 className="font-semibold">{current.targets.map(target=>target.accountName ?? target.platform).join(", ")}</h2><button onClick={()=>setSelected(null)}>{t("close")}</button></div><p className="my-4 whitespace-pre-wrap">{current.caption}</p>{current.status === "scheduled" && <><label className="block text-sm">{t("dateTime")}<input className="mt-2 block rounded-lg border border-line bg-paper p-3" type="datetime-local" value={dateTime} onChange={event=>setDateTime(event.target.value)} disabled={busy}/></label><div className="mt-4 flex flex-wrap gap-3"><button disabled={busy || !Number.isFinite(new Date(dateTime).getTime()) || new Date(dateTime).getTime() <= Date.now()} className="rounded-lg bg-accent px-4 py-2 text-[var(--action-text)] disabled:opacity-50" onClick={()=>void save(false)}>{t("save")}</button><button disabled={busy} className="rounded-lg border border-line px-4 py-2" onClick={()=>setCanceling(true)}>{t("cancel")}</button></div>{canceling && <div className="mt-4 rounded-lg border border-line p-4"><p>{t("cancelQuestion")}</p><button disabled={busy} className="mt-3 rounded-lg border border-line px-4 py-2 text-danger" onClick={()=>void save(true)}>{t("confirmCancel")}</button></div>}</>}</section>}
  </main>;
}
