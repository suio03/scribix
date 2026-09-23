"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { V2_PLANS } from "@/lib/plans";

export type UpgradeReason =
  | "plan"
  | "translation"
  | "summary"
  | "chat"
  | "quota"
  | "duration"
  | "file_size"
  | "video_storage";

export function UpgradePlanModal({
  reason,
  open,
  onClose,
}: {
  reason: UpgradeReason | null;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("Dashboard.viewer");
  const pricingT = useTranslations("PricingV2");

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open || !reason || typeof document === "undefined") return null;
  const copy = reason === "plan"
    ? { title: pricingT("plans.title"), body: pricingT("hero.body") }
    : upgradeReasonCopy(reason, t);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-labelledby="upgrade-plan-title"
      className="surface-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-ink/35 px-4 py-4 backdrop-blur-sm"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="surface-modal max-h-[calc(100vh-2rem)] w-full max-w-[620px] overflow-y-auto rounded-2xl border border-line bg-paper p-5 shadow-[0_30px_80px_-35px_rgba(14,13,11,0.45)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="upgrade-plan-title" className="text-[21px] font-semibold tracking-tight text-ink">{copy.title}</h2>
            <p className="mt-2 max-w-[520px] text-[14px] leading-6 text-ink/62">{copy.body}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={safeT(t, "closeUpgrade", "Close upgrade modal")}
            className="inline-grid size-9 shrink-0 place-items-center rounded-lg text-ink/55 transition hover:bg-ink/5 hover:text-ink"><X size={17} /></button>
        </div>
        <Link href="/pricing#compare-plans" onClick={onClose}
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 text-[14px] font-semibold text-paper transition hover:bg-accent/90">
          {pricingT("compare.eyebrow")} <ArrowRight size={16} strokeWidth={1.8} />
        </Link>
      </div>
    </div>,
    document.body
  );
}

function upgradeReasonCopy(
  reason: UpgradeReason,
  t: ((key: string) => string) & { has?: (key: string) => boolean }
) {
  if (reason === "summary") return {
    title: safeT(t, "upgradeSummaryModalTitle", "Create AI notes"),
    body: safeT(t, "upgradeSummaryModalBody", "Upgrade to turn completed transcripts into an overview, key points, and action items."),
  };
  if (reason === "chat") return {
    title: safeT(t, "upgradeChatModalTitle", "Ask this transcript"),
    body: safeTValues(t, "upgradeChatModalBody", `Starter includes ${V2_PLANS.basic.aiQuestionsPerMonth} and Pro includes ${V2_PLANS.pro.aiQuestionsPerMonth} Ask AI questions per month.`,
      { starterCount: V2_PLANS.basic.aiQuestionsPerMonth, proCount: V2_PLANS.pro.aiQuestionsPerMonth }),
  };
  if (reason === "quota") return {
    title: safeT(t, "upgradeQuotaModalTitle", "Keep transcribing"),
    body: safeT(t, "upgradeQuotaModalBody", "Upgrade to add more transcription minutes and continue without waiting."),
  };
  if (reason === "duration") return {
    title: safeT(t, "upgradeDurationModalTitle", "Transcribe this longer file"),
    body: safeT(t, "upgradeDurationModalBody", "Choose a plan whose per-file duration limit covers this recording."),
  };
  if (reason === "file_size") return {
    title: safeT(t, "upgradeFileSizeModalTitle", "Upload this larger video"),
    body: safeT(t, "upgradeFileSizeModalBody", "Paid plans support larger direct video uploads. Audio files still have a 1 GB limit."),
  };
  if (reason === "video_storage") return {
    title: safeT(t, "upgradeVideoStorageModalTitle", "Keep your source videos"),
    body: safeT(t, "upgradeVideoStorageModalBody", "Upgrade to retain more source-video storage and keep creating clips without re-uploading."),
  };
  return {
    title: safeT(t, "upgradeTranslationModalTitle", "Translate this transcript"),
    body: safeT(t, "upgradeTranslationModalBody", "Upgrade to translate completed transcripts into supported languages with speaker-aligned output."),
  };
}

function safeT(t: ((key: string) => string) & { has?: (key: string) => boolean }, key: string, fallback: string): string {
  try {
    if (typeof t.has === "function" && !t.has(key)) return fallback;
    return t(key);
  } catch { return fallback; }
}

function safeTValues(
  t: ((key: string, values?: Record<string, string | number>) => string) & { has?: (key: string) => boolean },
  key: string,
  fallback: string,
  values: Record<string, string | number>
): string {
  try {
    if (typeof t.has === "function" && !t.has(key)) return fallback;
    return t(key, values);
  } catch { return fallback; }
}
