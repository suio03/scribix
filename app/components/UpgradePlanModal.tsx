"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  PLANS,
  PRICING_DISPLAY,
  type BillingCycle,
} from "@/lib/plans";
import { PaddleCheckoutButton } from "./PaddleCheckoutButton";

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
  checkoutSuccessPath,
  onCheckoutStart,
  onClose,
}: {
  reason: UpgradeReason | null;
  open: boolean;
  checkoutSuccessPath: string;
  onCheckoutStart?: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("Dashboard.viewer");
  const [cycle, setCycle] = useState<BillingCycle>("yearly");

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open || !reason) return null;
  if (typeof document === "undefined") return null;

  const selectedPlan = upgradePlanCopy(t);
  const copy = upgradeReasonCopy(reason, t);
  const monthlyPrice = formatPrice(PRICING_DISPLAY.pro.monthly.amount);
  const yearlyPrice = formatPrice(PRICING_DISPLAY.pro.yearly.amount);
  const yearlyMonthlyEquivalent = formatPrice(
    PRICING_DISPLAY.pro.yearly.amount / 12
  );

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-plan-title"
      className="surface-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-ink/35 px-4 py-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="surface-modal max-h-[calc(100vh-2rem)] w-full max-w-[620px] overflow-y-auto rounded-2xl border border-line bg-paper p-5 shadow-[0_30px_80px_-35px_rgba(14,13,11,0.45)] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="upgrade-plan-title" className="text-[21px] font-semibold tracking-tight text-ink">
              {copy.title}
            </h2>
            <p className="mt-2 max-w-[520px] text-[14px] leading-6 text-ink/62">
              {copy.body}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={safeT(t, "closeUpgrade", "Close upgrade modal")}
            className="inline-grid size-9 shrink-0 place-items-center rounded-lg text-ink/55 transition hover:bg-ink/5 hover:text-ink"
          >
            <X size={17} />
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-line bg-card p-4 sm:p-5">
          <div>
            <h3 className="text-[17px] font-semibold text-ink">{selectedPlan.title}</h3>
            <p className="mt-1.5 text-[13px] leading-5 text-ink/62">{selectedPlan.description}</p>
          </div>

          <div
            aria-label={safeT(t, "upgradeBillingLabel", "Choose billing")}
            className="mt-4 grid grid-cols-2 rounded-xl border border-line bg-paper p-1"
            role="radiogroup"
          >
            <BillingCycleButton
              active={cycle === "monthly"}
              label={safeT(t, "upgradeMonthly", "Monthly")}
              onClick={() => setCycle("monthly")}
            />
            <BillingCycleButton
              active={cycle === "yearly"}
              badge={safeT(t, "upgradeYearlyBadge", "Save 50%")}
              label={safeT(t, "upgradeYearly", "Yearly")}
              onClick={() => setCycle("yearly")}
            />
          </div>

          <div className="mt-5 border-t border-line pt-5">
            <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
              {cycle === "yearly" ? (
                <span className="pb-0.5 font-display text-[27px] font-medium leading-none tracking-tight text-muted/55 line-through decoration-2">
                  {monthlyPrice}
                </span>
              ) : null}
              <span className="font-display text-[46px] font-semibold leading-none tracking-[-0.05em] text-ink">
                {cycle === "yearly" ? yearlyMonthlyEquivalent : monthlyPrice}
              </span>
              <span className="pb-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                {safeT(t, "upgradeMonthlyCadence", "/month")}
              </span>
            </div>
            <p className="mt-2 text-[12px] font-medium text-muted">
              {cycle === "yearly"
                ? safeTValues(t, "upgradeYearlyBilled", `Billed ${yearlyPrice} yearly`, {
                    price: yearlyPrice,
                  })
                : safeT(t, "upgradeMonthlyDetail", "Billed monthly")}
            </p>
          </div>

          <div className="mt-5 grid gap-2">
            {selectedPlan.bullets.map((bullet) => (
              <div key={bullet} className="flex items-start gap-2 text-[13px] leading-5 text-ink/70">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                <span>{bullet}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <PaddleCheckoutButton
            tier="pro"
            cycle={cycle}
            signedIn={true}
            checkoutSuccessPath={checkoutSuccessPath}
            onCheckoutStart={onCheckoutStart}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-accent px-5 text-[14px] font-semibold text-paper transition hover:bg-accent/90"
          >
            {cycle === "yearly"
              ? safeT(t, "upgradeContinueYearly", "Continue with yearly")
              : safeT(t, "upgradeContinueMonthly", "Continue with monthly")}
          </PaddleCheckoutButton>
        </div>

        <Link
          href="/pricing#compare-plans"
          onClick={onClose}
          className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg px-1 text-[13px] font-semibold text-accent underline decoration-accent/35 underline-offset-4 transition hover:decoration-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/35"
        >
          {safeT(t, "upgradeComparePlans", "Compare all plan features")}
          <ArrowRight size={15} strokeWidth={1.8} />
        </Link>
      </div>
    </div>,
    document.body
  );
}

function BillingCycleButton({
  active,
  badge,
  label,
  onClick,
}: {
  active: boolean;
  badge?: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-checked={active}
      className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-2 text-center transition sm:flex-row sm:gap-2 sm:px-4 ${
        active
          ? "bg-accent text-[var(--action-text)] shadow-[0_8px_24px_-18px_rgba(108,53,255,0.8)]"
          : "text-muted hover:bg-card hover:text-ink"
      }`}
      onClick={onClick}
      role="radio"
      type="button"
    >
      <span className="text-[13px] font-semibold">{label}</span>
      {badge ? (
        <span
          className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.1em] ${
            active ? "bg-paper/16 text-[var(--action-text)]" : "bg-accent-soft text-accent"
          }`}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function upgradeReasonCopy(
  reason: UpgradeReason,
  t: ((key: string) => string) & { has?: (key: string) => boolean }
) {
  if (reason === "plan") {
    return {
      title: safeT(t, "upgradePlanModalTitle", "Upgrade your plan"),
      body: safeT(
        t,
        "upgradePlanModalBody",
        "Get more processing time and unlock every Creator feature."
      ),
    };
  }

  if (reason === "summary") {
    return {
      title: safeT(t, "upgradeSummaryModalTitle", "Create AI notes"),
      body: safeT(
        t,
        "upgradeSummaryModalBody",
        "Upgrade to turn completed transcripts into an overview, key points, and action items."
      ),
    };
  }

  if (reason === "chat") {
    return {
      title: safeT(t, "upgradeChatModalTitle", "Ask this transcript"),
      body: safeTValues(
        t,
        "upgradeChatModalBody",
        `Upgrade to Pro for ${formatNumber(PLANS.pro.aiQuestionsPerCycle)} Ask AI questions each allowance period.`,
        { count: PLANS.pro.aiQuestionsPerCycle }
      ),
    };
  }

  if (reason === "quota") {
    return {
      title: safeT(t, "upgradeQuotaModalTitle", "Keep transcribing"),
      body: safeT(
        t,
        "upgradeQuotaModalBody",
        "Upgrade to add more transcription minutes and continue without waiting."
      ),
    };
  }

  if (reason === "duration") {
    return {
      title: safeT(t, "upgradeDurationModalTitle", "Transcribe this longer file"),
      body: safeT(
        t,
        "upgradeDurationModalBody",
        "Choose a plan whose per-file duration limit covers this recording."
      ),
    };
  }

  if (reason === "file_size") {
    return {
      title: safeT(t, "upgradeFileSizeModalTitle", "Upload this larger video"),
      body: safeT(
        t,
        "upgradeFileSizeModalBody",
        "Paid plans support larger direct video uploads. Audio files still have a 1 GB limit."
      ),
    };
  }

  if (reason === "video_storage") {
    return {
      title: safeT(t, "upgradeVideoStorageModalTitle", "Keep your source videos"),
      body: safeT(
        t,
        "upgradeVideoStorageModalBody",
        "Upgrade to retain more source-video storage and keep creating clips without re-uploading."
      ),
    };
  }

  return {
    title: safeT(t, "upgradeTranslationModalTitle", "Translate this transcript"),
    body: safeT(
      t,
      "upgradeTranslationModalBody",
      "Upgrade to translate completed transcripts into supported languages with speaker-aligned output."
    ),
  };
}

function upgradePlanCopy(
  t: ((key: string) => string) & { has?: (key: string) => boolean }
) {
  const monthlyMinutes = PLANS.pro.monthly.minutesPerCycle;
  const maxFileHours = PLANS.pro.maxFileSec / 3600;
  return {
    title: "Creator",
    description: safeT(
      t,
      "upgradeProMonthlyDescription",
      "For long files, priority processing, and heavier transcript volume."
    ),
    bullets: [
      safeTValues(t, "upgradeProMonthlyBulletMinutes", `${formatNumber(monthlyMinutes)} priority minutes each month`, {
        minutes: monthlyMinutes,
      }),
      safeTValues(t, "upgradeProMonthlyBulletLength", `Transcribe files up to ${formatDurationHours(maxFileHours)}`, {
        hours: maxFileHours,
      }),
      safeT(t, "upgradeProMonthlyBulletAi", "Includes Ask AI, AI translation, and AI notes"),
    ],
  };
}

function formatPrice(amount: number): string {
  if (PRICING_DISPLAY.pro.monthly.currency === "USD") return `$${amount}`;
  return `${formatNumber(amount)} ${PRICING_DISPLAY.pro.monthly.currency}`;
}

function formatDurationHours(hours: number): string {
  const formattedHours = Number.isInteger(hours) ? formatNumber(hours) : formatNumber(Number(hours.toFixed(1)));
  return `${formattedHours} ${hours === 1 ? "hour" : "hours"}`;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function safeT(t: ((key: string) => string) & { has?: (key: string) => boolean }, key: string, fallback: string): string {
  try {
    if (typeof t.has === "function" && !t.has(key)) return fallback;
    return t(key);
  } catch {
    return fallback;
  }
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
  } catch {
    return fallback;
  }
}
