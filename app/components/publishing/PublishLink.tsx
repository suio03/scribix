"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { UpgradePlanButton } from "../UpgradePlanButton";
import { Send } from "lucide-react";
import { useRouter } from "@/i18n/navigation";

export function PublishLink({ projectId, candidateId, disabled }: {
  projectId: string; candidateId: string; disabled: boolean;
}) {
  const t = useTranslations("ClipActions");
  const socialT = useTranslations("SocialAccess");
  const [upgrade, setUpgrade] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/social/availability", { signal: controller.signal })
      .then(response => { setUpgrade(response.status === 402); setAvailable(response.ok); })
      .catch(() => { if (!controller.signal.aborted) setAvailable(false); });
    return () => controller.abort();
  }, [projectId]);
  if (upgrade) return <UpgradePlanButton className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-line px-4 text-sm font-semibold text-accent"><Send size={16} />{socialT("upgrade")}</UpgradePlanButton>;
  return <button type="button" disabled={disabled || !available} title={disabled ? t("saveFirst") : available === false ? t("unavailable") : undefined} onClick={() => router.push({ pathname: "/dashboard/publish", query: { projectId, candidateId } })} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><Send size={16} />{t("publish")}</button>;
}
