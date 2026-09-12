"use client";
import {useEffect, useState} from "react";
import {useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";
type Account = {id: string; displayName: string; status: string};
export function PublishingAccounts({compact = false}: {compact?: boolean}) {
 const t = useTranslations("PublishingAccounts");
 const [accounts, setAccounts] = useState<Account[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(false);
 useEffect(() => {const controller = new AbortController();
  fetch("/api/social/connections", {signal:controller.signal,cache:"no-store"}).then(async response => {if(!response.ok)throw new Error();const data=await response.json() as {accounts:Account[]};setAccounts(data.accounts);}).catch(()=>{if(!controller.signal.aborted)setError(true);}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
  return ()=>controller.abort();
 }, []);
 const button = "rounded-xl border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-paper";
  return <aside className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-card p-4">
    <div className="min-w-0"><p className="text-sm font-semibold text-ink">{t("heading")}</p><p className="mt-1 text-sm text-muted" role="status">{loading ? t("loading") : error ? t("optional") : accounts.some(a => a.status === "active") ? accounts.filter(a => a.status === "active").map(a => a.displayName).join(", ") : t("optional")}</p></div>
    <Link href="/dashboard/accounts" className={button}>{t("manage")}</Link>
  </aside>;
}
