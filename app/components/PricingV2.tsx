"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight, Check, ChevronDown, Link2, Minus } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { CompactPlatformIcon } from "@/app/components/publishing/icons";
import { PaddleCheckoutButton } from "@/app/components/PaddleCheckoutButton";
import { PUBLISH_PLATFORMS, SPECS } from "@/app/components/publishing/shared/specs";
import { PRICING_V2 } from "@/lib/pricing-v2";
import { youtubeImportsFor } from "@/lib/plans";

type Cycle = "monthly" | "yearly";
type PlanId = keyof typeof PRICING_V2;

const PLAN_ORDER: PlanId[] = ["free", "starter", "pro"];
const FAQ_KEYS = ["clips", "regenerate", "minutes", "social", "yearly"] as const;
const YEARLY_DISCOUNT_PERCENT = Math.round(
  (1 - PRICING_V2.starter.yearlyUsd / (12 * PRICING_V2.starter.monthlyUsd)) * 100
);

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
  const locale = useLocale();
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const usd = (value: number) => new Intl.NumberFormat(locale, {
    style: "currency", currency: "USD", minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
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
    { key: "transcript", label: t("compare.transcript"), values: { free: included, starter: included, pro: included } },
    { key: "speakers", label: t("compare.speakers"), values: { free: included, starter: included, pro: included } },
    { key: "exports", label: t("compare.exports"), values: { free: included, starter: included, pro: included } },
    { key: "aiClips", label: t("compare.aiClips"), values: {
      free: t("values.onePass"), starter: t("values.onePass"), pro: t("values.onePass"),
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

  return (
    <div className="pricing-surface">
      <main>
        <section className="border-b border-line px-4 pb-12 pt-12 sm:px-8 sm:pb-16 sm:pt-16">
          <div className="mx-auto max-w-[1140px]">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">{t("hero.eyebrow")}</p>
            <h1 className="mt-5 max-w-[850px] font-display text-[44px] font-semibold leading-[1.02] tracking-[-0.045em] text-ink sm:text-[64px]">{t("hero.title")}</h1>
            <p className="mt-6 max-w-[690px] text-[17px] leading-7 text-muted">{t("hero.body")}</p>
            {!checkoutEnabled ? (
              <div className="mt-8 inline-flex items-center gap-3 border-l-2 border-accent bg-accent-soft/55 px-4 py-3 text-[13px] leading-5 text-ink" role="status">
                <span className="font-semibold">{t("hero.previewTitle")}</span>{t("hero.previewBody")}
              </div>
            ) : null}
          </div>
        </section>

        <section className="px-4 py-12 sm:px-8 sm:py-16">
          <div className="mx-auto max-w-[1140px]">
            <div className="text-center">
              <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">{t("plans.eyebrow")}</p>
              <h2 className="mt-3 font-display text-[33px] font-semibold leading-tight tracking-[-0.035em] sm:text-[40px]">{t("plans.title")}</h2>
            </div>
            <div className="mt-6 flex justify-center">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-card px-3 py-2 sm:gap-3 sm:px-5" role="group" aria-label={t("billing.label")}>
                <button type="button" aria-pressed={cycle === "monthly"} onClick={() => setCycle("monthly")}
                  className={`min-h-10 text-sm font-semibold transition sm:text-base ${cycle === "monthly" ? "text-ink" : "text-muted hover:text-ink"}`}>
                  {t("billing.monthly")}
                </button>
                <button type="button" role="switch" aria-checked={cycle === "yearly"} aria-label={t("billing.yearly")}
                  onClick={() => setCycle(cycle === "monthly" ? "yearly" : "monthly")}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${cycle === "yearly" ? "bg-accent" : "bg-muted/45"}`}>
                  <span aria-hidden="true" className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-paper shadow-sm transition-transform ${cycle === "yearly" ? "translate-x-5" : "translate-x-0"}`} />
                </button>
                <button type="button" aria-pressed={cycle === "yearly"} onClick={() => setCycle("yearly")}
                  className={`min-h-10 text-sm font-semibold transition sm:text-base ${cycle === "yearly" ? "text-ink" : "text-muted hover:text-ink"}`}>
                  {t("billing.yearly")}
                </button>
                <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-800 sm:text-xs">
                  {t("billing.discountBadge", { percent: YEARLY_DISCOUNT_PERCENT })}
                </span>
              </div>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-3 lg:items-stretch">
              {PLAN_ORDER.map((id) => {
                const plan = PRICING_V2[id];
                const paid = id !== "free";
                const yearly = paid && cycle === "yearly";
                const annual = id === "free" ? null : PRICING_V2[id].yearlyUsd;
                const price = yearly ? (annual ?? 0) / 12 : plan.monthlyUsd;
                const discountPercent = yearly ? Math.round((1 - (annual ?? 0) / (plan.monthlyUsd * 12)) * 100) : 0;
                return (
                  <article key={id} className={`relative flex flex-col rounded-2xl border ${id === "starter" ? "border-accent bg-card shadow-[6px_6px_0_0_var(--accent-soft)]" : "border-line bg-card"}`}>
                    {id === "starter" ? <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-accent px-5 py-1.5 text-xs font-semibold text-paper">{t("plans.recommended")}</span> : null}
                    <div className="flex flex-1 flex-col p-6 sm:p-7 lg:min-h-[405px]">
                      <h3 className="font-display text-[31px] font-semibold tracking-tight text-ink">{t(`plans.${id}.name`)}</h3>
                      <p className="mt-2 min-h-12 text-[14px] leading-6 text-muted">{plans[id].summary}</p>
                      <div className="mt-9 flex min-h-[94px] flex-col justify-end">
                        {yearly ? <div className="mb-2 flex items-center gap-2">
                          <del className="font-display text-[27px] font-semibold leading-none tracking-[-0.045em] text-muted/65">{usd(plan.monthlyUsd)}</del>
                          <span className="whitespace-nowrap rounded-full bg-amber-100 px-2 py-1 text-xs font-bold leading-none text-amber-800">{t("billing.discountBadge", { percent: discountPercent })}</span>
                        </div> : null}
                        <div className="flex items-end gap-2">
                          <span className="font-display text-[54px] font-semibold leading-none tracking-[-0.05em] text-ink">{usd(price)}</span>
                          <span className="pb-1.5 text-[13px] text-muted">{paid ? t("billing.perMonth") : t("billing.forever")}</span>
                        </div>
                      </div>
                      <p className="mt-2 min-h-6 text-[12px] text-muted">{yearly
                        ? t("billing.billedYearly", { price: usd(annual ?? 0) })
                        : paid ? t("billing.billedMonthly") : t("billing.noCard")}</p>
                      <div className="mt-auto pt-8">
                        <p className="mb-2 text-[12px] text-muted">{t("plans.sourceLabel")}</p>
                        <div className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-line bg-paper px-4 py-3">
                          <span className="font-display text-[19px] font-semibold text-ink">{t("values.minutes", { minutes: plan.processingMinutes })}</span>
                          <span className="shrink-0 text-[12px] text-muted">{paid ? t("billing.perMonth") : t("billing.oneTime")}</span>
                        </div>
                        {id === "free" ? (
                          <Link href="/dashboard/new" className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink px-5 text-sm font-semibold text-paper transition hover:opacity-85">
                            {t("actions.startFree")} <ArrowUpRight size={16} aria-hidden="true" />
                          </Link>
                        ) : currentTier !== "free" ? (
                          <Link href="/dashboard/billing" className="mt-3 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-line px-5 text-sm font-semibold text-ink">{t("actions.manage")}</Link>
                        ) : checkoutEnabled ? (
                          <PaddleCheckoutButton tier={id === "starter" ? "basic" : "pro"} cycle={cycle} version="v2"
                            signedIn={signedIn} checkoutSuccessPath={checkoutSuccessPath}
                            className="mt-3 min-h-12 w-full rounded-xl bg-accent px-5 text-sm font-semibold text-paper transition hover:opacity-85">
                            {t("actions.getPlan", { plan: t(`plans.${id}.name`) })}
                          </PaddleCheckoutButton>
                        ) : (
                          <button type="button" disabled className="mt-3 min-h-12 w-full cursor-not-allowed rounded-xl bg-accent px-5 text-sm font-semibold text-paper opacity-65">{t("actions.checkoutSoon")}</button>
                        )}
                        <div className="mt-3 min-h-5 text-[12px] text-muted">{paid && !yearly ? (
                          <button type="button" onClick={() => setCycle("yearly")} className="font-medium text-accent underline-offset-2 hover:underline">
                            {t("billing.saveYearly", { percent: YEARLY_DISCOUNT_PERCENT })} <ArrowUpRight size={12} className="inline" aria-hidden="true" />
                          </button>
                        ) : yearly ? t("billing.yearlyRefresh", { percent: YEARLY_DISCOUNT_PERCENT }) : t("billing.freeAllowance")}</div>
                      </div>
                    </div>
                    <div className="border-t border-line p-6 sm:p-7 lg:min-h-[330px]">
                      <p className="text-[14px] font-semibold text-ink">{t("plans.includes")}</p>
                      <div className={`mt-4 flex items-start gap-2.5 text-[13.5px] leading-5 ${plan.socialAccounts === 0 ? "text-muted" : "text-ink"}`}>
                        {plan.socialAccounts === 0 ? <Minus size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> : <Link2 size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />}
                        {plan.socialAccounts === 0 ? t("plans.noSocial") : t("plans.socialAccounts", { count: plan.socialAccounts })}
                      </div>
                      <p className="mt-6 text-[14px] font-semibold text-ink">{id === "free" ? t("plans.keyFeatures") : t("plans.everythingPlus", { plan: t(id === "starter" ? "plans.free.name" : "plans.starter.name") })}</p>
                      <ul className="mt-4 space-y-3">{plans[id].highlights.map((highlight) => (
                        <li key={highlight} className="flex items-start gap-2.5 text-[13.5px] leading-5 text-ink"><Check size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />{highlight}</li>
                      ))}</ul>
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="mt-6 text-center text-[13px] leading-6 text-muted">{t("explanation", { minutes: 30 })}</p>
          </div>
        </section>

        <section id="compare-plans" className="border-t border-line bg-card px-4 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-[1140px]">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">{t("compare.eyebrow")}</p>
            <h2 className="mt-3 font-display text-[36px] font-semibold tracking-[-0.035em]">{t("compare.title")}</h2>
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
      </main>
    </div>
  );
}
