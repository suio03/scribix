"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpRight, Check, ChevronDown, Minus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { CompactPlatformIcon } from "@/app/components/publishing/icons";
import { PaddleCheckoutButton } from "@/app/components/PaddleCheckoutButton";
import { BillingCycleToggle, paidPlanPrice, planIdForTier, useUsd, type Cycle } from "@/app/components/PricingShared";
import { PUBLISH_PLATFORMS, SPECS } from "@/app/components/publishing/shared/specs";
import { PRICING_V2 } from "@/lib/pricing-v2";
import { youtubeImportsFor } from "@/lib/plans";

type PlanId = keyof typeof PRICING_V2;

const PLAN_ORDER: PlanId[] = ["free", "starter", "pro"];
const FAQ_KEYS = ["clips", "regenerate", "minutes", "social", "yearly"] as const;

export function PricingV2({
  currentTier,
  checkoutEnabled,
  signedIn,
  checkoutSuccessPath,
}: {
  currentTier: "free" | "basic" | "pro";
  checkoutEnabled: boolean;
  signedIn: boolean;
  checkoutSuccessPath: string;
}) {
  const t = useTranslations("PricingV2");
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const usd = useUsd();
  const currentPlan = signedIn ? planIdForTier(currentTier) : null;
  const plans = {
    free: {
      summary: t("plans.free.summary"),
      highlights: [
        t("plans.free.highlight1"),
        t("plans.free.highlight2"),
        t("plans.free.highlight3", { days: PRICING_V2.free.sourceRetentionDays }),
      ],
    },
    starter: {
      summary: t("plans.starter.summary"),
      highlights: [
        t("plans.socialAccounts", { count: PRICING_V2.starter.socialAccounts }),
        t("plans.starter.highlight1"),
        t("plans.starter.highlight2"),
        t("plans.starter.highlight3"),
        t("plans.starter.highlight4", { questions: PRICING_V2.starter.askAiQuestions }),
        t("plans.starter.highlight5", { storage: PRICING_V2.starter.sourceStorageGiB }),
      ],
    },
    pro: {
      summary: t("plans.pro.summary"),
      highlights: [
        t("plans.socialAccounts", { count: PRICING_V2.pro.socialAccounts }),
        t("plans.pro.highlight1", { questions: PRICING_V2.pro.askAiQuestions }),
        t("plans.pro.highlight2", { imports: PRICING_V2.pro.youtubeImports }),
        t("plans.pro.highlight3", { storage: PRICING_V2.pro.sourceStorageGiB }),
      ],
    },
  };
  const included = t("values.included");
  const unavailable = "—";
  const comparisonRows: Array<{ key: string; label: string; values: Record<PlanId, string> }> = [
    { key: "minutes", label: t("compare.minutes"), values: {
      free: t("values.lifetimeMinutes", { minutes: PRICING_V2.free.processingMinutes }),
      starter: t("values.monthlyMinutes", { minutes: PRICING_V2.starter.processingMinutes }),
      pro: t("values.monthlyMinutes", { minutes: PRICING_V2.pro.processingMinutes }),
    } },
    { key: "customClips", label: t("compare.customClips"), values: { free: unavailable, starter: included, pro: included } },
    { key: "editing", label: t("compare.editing"), values: { free: unavailable, starter: included, pro: included } },
    { key: "output", label: t("compare.output"), values: {
      free: t("values.freeOutput"), starter: t("values.paidOutput"), pro: t("values.paidOutput"),
    } },
    { key: "notes", label: t("compare.notes"), values: { free: unavailable, starter: included, pro: included } },
    { key: "translation", label: t("compare.translation"), values: { free: unavailable, starter: included, pro: included } },
    { key: "askAi", label: t("compare.askAi"), values: {
      free: t("values.lifetimeQuestions", { count: PRICING_V2.free.askAiQuestions }),
      starter: t("values.monthlyQuestions", { count: PRICING_V2.starter.askAiQuestions }),
      pro: t("values.monthlyQuestions", { count: PRICING_V2.pro.askAiQuestions }),
    } },
    { key: "youtube", label: t("compare.youtube"), values: {
      free: t("values.dailyImports", { count: youtubeImportsFor("free", null, checkoutEnabled ? "v2" : null) }),
      starter: t("values.monthlyImports", { count: PRICING_V2.starter.youtubeImports }),
      pro: t("values.monthlyImports", { count: PRICING_V2.pro.youtubeImports }),
    } },
    { key: "accounts", label: t("compare.accounts"), values: {
      free: unavailable,
      starter: t("values.upToAccounts", { count: PRICING_V2.starter.socialAccounts }),
      pro: t("values.upToAccounts", { count: PRICING_V2.pro.socialAccounts }),
    } },
    { key: "publishing", label: t("compare.publishing"), values: { free: unavailable, starter: t("values.includedFootnote"), pro: t("values.includedFootnote") } },
    { key: "storage", label: t("compare.storage"), values: {
      free: t("values.storage", { storage: PRICING_V2.free.sourceStorageGiB, days: PRICING_V2.free.sourceRetentionDays }),
      starter: t("values.storage", { storage: PRICING_V2.starter.sourceStorageGiB, days: PRICING_V2.starter.sourceRetentionDays }),
      pro: t("values.storage", { storage: PRICING_V2.pro.sourceStorageGiB, days: PRICING_V2.pro.sourceRetentionDays }),
    } },
  ];
  const actionClass = "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition";

  function planAction(id: PlanId) {
    const planName = t(`plans.${id}.name`);
    if (currentPlan === id) {
      return id === "free"
        ? <Link href="/dashboard/new" className={`${actionClass} border border-line text-ink hover:bg-ink/5`}>{t("actions.openDashboard")}</Link>
        : <Link href="/dashboard/billing" className={`${actionClass} border border-line text-ink hover:bg-ink/5`}>{t("actions.manage")}</Link>;
    }
    if (id === "free") {
      if (currentPlan) return null;
      return (
        <Link href="/dashboard/new" className={`${actionClass} bg-ink text-paper hover:opacity-85`}>
          {t("actions.startFree")} <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      );
    }
    // Paid subscribers change plans in the Paddle portal; new checkout rejects them.
    if (currentPlan && currentPlan !== "free") {
      return <Link href="/dashboard/billing" className={`${actionClass} bg-ink text-paper hover:opacity-85`}>{t("actions.changePlan")}</Link>;
    }
    if (!checkoutEnabled) {
      return <button type="button" disabled className={`${actionClass} cursor-not-allowed bg-accent text-paper opacity-60`}>{t("actions.checkoutSoon")}</button>;
    }
    return (
      <PaddleCheckoutButton tier={id === "starter" ? "basic" : "pro"} cycle={cycle} version="v2"
        signedIn={signedIn} checkoutSuccessPath={checkoutSuccessPath}
        className={`${actionClass} ${id === "starter" ? "bg-accent" : "bg-ink"} text-paper hover:opacity-85`}>
        {t("actions.getPlan", { plan: planName })}
      </PaddleCheckoutButton>
    );
  }

  return (
    <div className="pricing-surface">
      <main>
        <section className="px-4 pb-14 pt-12 sm:px-8 sm:pb-20 sm:pt-16">
          <div className="mx-auto max-w-[1140px]">
            <div className="mx-auto max-w-[760px] text-center">
              {currentPlan ? (
                <>
                  <h1 className="font-display text-[36px] font-semibold leading-[1.08] tracking-[-0.04em] text-ink sm:text-[46px]">{t("signedIn.title")}</h1>
                  <p className="mt-4 text-[16px] leading-7 text-muted">{t("signedIn.body", { plan: t(`plans.${currentPlan}.name`) })}</p>
                </>
              ) : (
                <>
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">{t("hero.eyebrow")}</p>
                  <h1 className="mt-4 font-display text-[38px] font-semibold leading-[1.05] tracking-[-0.045em] text-ink sm:text-[54px]">{t("plans.title")}</h1>
                  <p className="mt-5 text-[16px] leading-7 text-muted sm:text-[17px]">{t("hero.body")}</p>
                </>
              )}
            </div>
            <div className="mt-8 flex justify-center">
              <BillingCycleToggle cycle={cycle} onChange={setCycle} />
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-3 lg:items-stretch">
              {PLAN_ORDER.map((id) => {
                const plan = PRICING_V2[id];
                const paid = id !== "free";
                const price = paid ? paidPlanPrice(id, cycle) : null;
                const isCurrent = currentPlan === id;
                const featured = currentPlan ? isCurrent : id === "starter";
                return (
                  <article key={id} className={`relative flex flex-col rounded-2xl border bg-card p-6 sm:p-7 ${featured ? "border-accent shadow-[6px_6px_0_0_var(--accent-soft)]" : "border-line"}`}>
                    {isCurrent || (!currentPlan && id === "starter") ? (
                      <span className="absolute -top-3.5 left-6 rounded-full bg-accent px-3.5 py-1 text-[11.5px] font-semibold text-paper">
                        {isCurrent ? t("plans.current") : t("plans.recommended")}
                      </span>
                    ) : null}
                    <h2 className="font-display text-[26px] font-semibold tracking-tight text-ink">{t(`plans.${id}.name`)}</h2>
                    <p className="mt-1.5 min-h-12 text-[14px] leading-6 text-muted">{plans[id].summary}</p>
                    <div className="mt-6 flex items-end gap-2">
                      <span className="font-display text-[48px] font-semibold leading-none tracking-[-0.05em] text-ink">{usd(price?.perMonth ?? 0)}</span>
                      <span className="pb-1.5 text-[13px] text-muted">{paid ? t("billing.perMonth") : t("billing.forever")}</span>
                    </div>
                    <p className="mt-2 text-[12.5px] text-muted">{!price
                      ? t("billing.noCard")
                      : cycle === "yearly" ? t("billing.billedYearly", { price: usd(price.billed) }) : t("billing.billedMonthly")}</p>
                    <div className="mt-6 border-y border-line py-3.5">
                      <p className="text-[12px] text-muted">{t("plans.sourceLabel")}</p>
                      <p className="mt-1 font-display text-[18px] font-semibold text-ink">
                        {paid ? t("values.monthlyMinutes", { minutes: plan.processingMinutes }) : t("values.lifetimeMinutes", { minutes: plan.processingMinutes })}
                      </p>
                    </div>
                    <p className="mt-6 text-[13px] font-semibold text-ink">{id === "free" ? t("plans.keyFeatures") : t("plans.everythingPlus", { plan: t(id === "starter" ? "plans.free.name" : "plans.starter.name") })}</p>
                    <ul className="mt-3 space-y-2.5">{plans[id].highlights.map((highlight) => (
                      <li key={highlight} className="flex items-start gap-2.5 text-[13.5px] leading-5 text-ink"><Check size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />{highlight}</li>
                    ))}</ul>
                    <div className="mt-auto pt-7">{planAction(id)}</div>
                  </article>
                );
              })}
            </div>
            <p className="mx-auto mt-8 max-w-[760px] text-center text-[13px] leading-6 text-muted">{t("explanation", { minutes: 30 })}</p>
          </div>
        </section>

        <section id="compare-plans" className="border-t border-line bg-card px-4 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-[1140px]">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">{t("compare.eyebrow")}</p>
            <h2 className="mt-3 font-display text-[36px] font-semibold tracking-[-0.035em]">{t("compare.title")}</h2>
            <p className="mt-3 max-w-[70ch] text-[14px] leading-6 text-muted">{t("compare.allPlans")}</p>
            <div className="mt-8 overflow-x-auto rounded-xl border border-line bg-paper">
              <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
                <thead><tr className="border-b border-line bg-accent-soft/25">
                  <th scope="col" className="w-[34%] px-5 py-4 font-semibold">{t("compare.feature")}</th>
                  {PLAN_ORDER.map((id) => <th key={id} scope="col" className="w-[22%] px-5 py-4 font-display text-[18px] font-semibold">{t(`plans.${id}.name`)}</th>)}
                </tr></thead>
                <tbody>
                  {comparisonRows.map((row) => <tr key={row.key} className="border-b border-line last:border-0">
                    <th scope="row" className="px-5 py-4 font-medium text-ink">{row.label}</th>
                    {PLAN_ORDER.map((id) => <td key={id} className="px-5 py-4 text-muted">
                      {row.values[id] === unavailable ? (
                        <span className="flex items-center"><Minus size={15} aria-hidden="true" /><span className="sr-only">{t("values.notIncluded")}</span></span>
                      ) : (
                        <span className="flex items-start gap-2"><Check size={15} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />{row.values[id]}</span>
                      )}
                    </td>)}
                  </tr>)}
                  <tr><th scope="row" className="px-5 py-4 font-medium text-ink">{t("compare.platforms")}</th>
                    {PLAN_ORDER.map((id) => <td key={id} className="px-5 py-4 text-muted">
                      {id === "free" ? <span className="flex items-center"><Minus size={15} aria-hidden="true" /><span className="sr-only">{t("values.notIncluded")}</span></span> : (
                        <div className="flex items-center gap-3" role="img" aria-label={PUBLISH_PLATFORMS.map(platform => SPECS[platform].label).join(", ")}>
                          {PUBLISH_PLATFORMS.map(platform => <span key={platform} title={SPECS[platform].label} className="inline-flex shrink-0 items-center justify-center"><CompactPlatformIcon platform={platform} size={23} /></span>)}
                        </div>
                      )}
                    </td>)}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-[12px] leading-5 text-muted">{t("compare.footnote")}</p>
          </div>
        </section>

        {currentPlan ? null : <>
        <section className="px-4 py-14 sm:px-8 sm:py-20"><div className="mx-auto max-w-[1140px] grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div><p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">{t("how.eyebrow")}</p>
            <h2 className="mt-3 max-w-[12ch] font-display text-[36px] font-semibold leading-[1.1] tracking-[-0.035em]">{t("how.title")}</h2></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-card p-5"><span className="font-mono text-[11px] font-semibold text-accent">01 / {t("how.processLabel")}</span><p className="mt-4 text-[14px] leading-6 text-ink">{t("how.processBody")}</p></div>
            <div className="rounded-xl border border-line bg-card p-5"><span className="font-mono text-[11px] font-semibold text-accent">02 / {t("how.editLabel")}</span><p className="mt-4 text-[14px] leading-6 text-ink">{t("how.editBody")}</p></div>
          </div>
        </div></section>

        <section className="border-t border-line bg-card px-4 py-14 sm:px-8 sm:py-20"><div className="mx-auto max-w-[1140px]">
          <h2 className="font-display text-[36px] font-semibold tracking-[-0.035em]">{t("faq.title")}</h2>
          <div className="mt-7 divide-y divide-line border-y border-line">{FAQ_KEYS.map((key) => <details key={key} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5 text-[15px] font-semibold text-ink [&::-webkit-details-marker]:hidden">{t(`faq.${key}.question`)}<ChevronDown size={18} className="shrink-0 text-muted transition group-open:rotate-180" aria-hidden="true" /></summary>
            <p className="max-w-[75ch] pb-5 text-[14px] leading-7 text-muted">{t(`faq.${key}.answer`, { starterAccounts: PRICING_V2.starter.socialAccounts, proAccounts: PRICING_V2.pro.socialAccounts })}</p>
          </details>)}</div>
        </div></section>
        </>}
      </main>
    </div>
  );
}
