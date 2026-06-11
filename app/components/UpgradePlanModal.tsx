"use client";

import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PLANS, PRICING_DISPLAY } from "@/lib/plans";
import { PaddleCheckoutButton } from "./PaddleCheckoutButton";

export type UpgradeReason = "translation" | "summary" | "quota";
type UpgradeTier = "basic" | "pro";

export function UpgradePlanModal({
  reason,
  open,
  checkoutSuccessPath,
  onClose,
}: {
  reason: UpgradeReason | null;
  open: boolean;
  checkoutSuccessPath: string;
  onClose: () => void;
}) {
  const t = useTranslations("Dashboard.viewer");
  const [selectedTier, setSelectedTier] = useState<UpgradeTier>("pro");
  if (!open || !reason) return null;

  const selectedPlan = upgradePlanCopy(selectedTier, t);
  const copy = upgradeReasonCopy(reason, t);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-plan-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 px-4 py-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[560px] rounded-2xl border border-line bg-paper p-5 shadow-[0_30px_80px_-35px_rgba(14,13,11,0.45)]">
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

        <div className="mt-5 grid grid-cols-2 rounded-xl bg-ink/5 p-1" aria-label={safeT(t, "upgradePlanToggle", "Choose plan")}>
          <PlanToggleButton
            active={selectedTier === "basic"}
            onClick={() => setSelectedTier("basic")}
          >
            {safeT(t, "upgradeStarter", "Starter")}
          </PlanToggleButton>
          <PlanToggleButton
            active={selectedTier === "pro"}
            onClick={() => setSelectedTier("pro")}
          >
            {safeT(t, "upgradePro", "Pro")}
          </PlanToggleButton>
        </div>

        <div className="mt-4 rounded-2xl border border-line bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-[17px] font-semibold text-ink">{selectedPlan.title}</h3>
              <p className="mt-2 text-[13px] leading-5 text-ink/62">{selectedPlan.description}</p>
            </div>
            <div className="shrink-0 sm:text-right">
              <div className="text-[28px] font-semibold tracking-tight text-ink">{selectedPlan.price}</div>
              <div className="text-[12px] text-ink/50">
                {safeT(t, "upgradeMonthlyCadence", "/month")}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2">
            {selectedPlan.bullets.map((bullet) => (
              <div key={bullet} className="flex items-start gap-2 text-[13px] leading-5 text-ink/70">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
                <span>{bullet}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <PaddleCheckoutButton
            tier={selectedTier}
            cycle="monthly"
            signedIn={true}
            checkoutSuccessPath={checkoutSuccessPath}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-accent px-5 text-[14px] font-semibold text-paper transition hover:bg-accent/90"
          >
            {safeT(t, "upgradeContinue", "Continue")}
          </PaddleCheckoutButton>
          <Link
            href="/pricing"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-line bg-paper px-5 text-[14px] font-semibold text-ink transition hover:border-ink/35 hover:bg-card"
          >
            {safeT(t, "upgradeComparePlans", "Compare all plans")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function PlanToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition ${
        active ? "bg-paper text-ink shadow-sm" : "text-ink/55 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function upgradeReasonCopy(
  reason: UpgradeReason,
  t: ((key: string) => string) & { has?: (key: string) => boolean }
) {
  if (reason === "summary") {
    return {
      title: safeT(t, "upgradeSummaryModalTitle", "Summarize this transcript"),
      body: safeT(
        t,
        "upgradeSummaryModalBody",
        "Upgrade to turn long transcripts into an overview, key points, and action items."
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
  tier: UpgradeTier,
  t: ((key: string) => string) & { has?: (key: string) => boolean }
) {
  const monthlyMinutes = PLANS[tier].monthly.minutesPerCycle;
  const maxFileHours = PLANS[tier].maxFileSec / 3600;

  if (tier === "pro") {
    return {
      title: safeT(t, "upgradePro", "Pro"),
      price: formatPlanPrice(tier),
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
        safeT(t, "upgradeProMonthlyBulletAi", "Includes AI translation and AI summaries"),
      ],
    };
  }

  return {
    title: safeT(t, "upgradeStarter", "Starter"),
    price: formatPlanPrice(tier),
    description: safeT(
      t,
      "upgradeStarterMonthlyDescription",
      "For steady personal transcription with the paid AI tools unlocked."
    ),
    bullets: [
      safeTValues(t, "upgradeStarterMonthlyBulletMinutes", `${formatNumber(monthlyMinutes)} minutes each month`, {
        minutes: monthlyMinutes,
      }),
      safeT(t, "upgradeStarterMonthlyBulletAi", "Includes AI translation and AI summaries"),
      safeT(t, "upgradeStarterMonthlyBulletExports", "Unlimited transcript exports"),
    ],
  };
}

function formatPlanPrice(tier: UpgradeTier): string {
  const price = PRICING_DISPLAY[tier].monthly;
  if (price.currency === "USD") return `$${price.amount}`;
  return `${formatNumber(price.amount)} ${price.currency}`;
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
