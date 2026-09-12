"use client";
import {useTranslations} from "next-intl";
import {Link} from "@/i18n/navigation";
import {useEffect, useState} from "react";
export function PublishLink({projectId, candidateId, renderJobId, disabled}: {projectId: string; candidateId: string; renderJobId?: string; disabled: boolean}) {
  const t = useTranslations("DistributionNav");
  const [enabled, setEnabled] = useState(false);
  useEffect(() => { const c = new AbortController(); fetch("/api/social/availability", {signal: c.signal}).then(r => setEnabled(r.ok)).catch(() => {}); return () => c.abort(); }, [projectId]);
  if (!enabled || !renderJobId || disabled) return null;
  return <Link className="my-2 inline-flex rounded-lg border border-line px-4 py-2 text-sm font-semibold text-accent" href={{pathname: "/dashboard/publish", query: {projectId, candidateId, renderJobId}}}>{t("goPublish")}</Link>;
}
