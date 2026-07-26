"use client";

import { useEffect, useState } from "react";
import {
  FreePlanButton,
  PaddleCheckoutButton,
} from "@/app/components/PaddleCheckoutButton";
import { trackEvent } from "@/lib/analytics";
import type { PlanFeatureCopy } from "@/lib/pricing-feature-rows";
import type { PlanCopy, PlanId } from "@/lib/pricing-plans";
import type { BillingCycle, Tier } from "@/lib/plans";

export type { PlanCopy, PlanId } from "@/lib/pricing-plans";

type PricingPlansProps = {
  billingLabels: {
    label: string;
    monthly: string;
    yearly: string;
    yearlyBadge: string;
    yearlyNote: string;
  };
  analyticsSource: "pricing" | "billing";
  bestValue: string;
  checkoutSuccessPath: string;
  chooseLabels: Record<PlanId, string>;
  currentPlanLabel: string;
  currentCycle?: BillingCycle | null;
  currentTier?: Tier;
  dashboardNewPath: string;
  density?: "default" | "compact";
  featureRows: PlanFeatureCopy[];
  noCreditCard: string;
  plans: PlanCopy[];
  signedIn: boolean;
  supportUpgradeLabel: string;
  unavailableLabel: string;
};

export function PricingPlans({
  analyticsSource,
  billingLabels,
  bestValue,
  checkoutSuccessPath,
  chooseLabels,
  currentPlanLabel,
  currentCycle = null,
  currentTier = "free",
  dashboardNewPath,
  density = "default",
  featureRows,
  noCreditCard,
  plans,
  signedIn,
  supportUpgradeLabel,
  unavailableLabel,
}: PricingPlansProps) {
  const initialCycle = currentCycle ?? "yearly";
  const [cycle, setCycle] = useState<BillingCycle>(initialCycle);
  const singlePlanLayout = plans.length === 1;
  const featuredLayout = plans.length === 2;
  const planGridClass = singlePlanLayout
    ? ""
    : featuredLayout
      ? "lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start"
      : "lg:grid-cols-3";

  useEffect(() => {
    trackEvent("pricing_billing_cycle_view", {
      cycle: initialCycle,
      source: analyticsSource,
      signed_in: signedIn,
      current_tier: currentTier,
    });
  }, [analyticsSource, currentTier, initialCycle, signedIn]);

  function selectCycle(nextCycle: BillingCycle) {
    if (nextCycle === cycle) return;
    setCycle(nextCycle);
    trackEvent("pricing_billing_cycle_change", {
      cycle: nextCycle,
      source: analyticsSource,
      signed_in: signedIn,
      current_tier: currentTier,
    });
  }

  return (
    <div
      className={`pricing-plans ${singlePlanLayout ? "pricing-plans-single" : ""}`}
    >
      <div className="pricing-billing-control mb-8 flex justify-center sm:mb-10">
        <div className="flex w-full max-w-[420px] flex-col items-center gap-2.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            {billingLabels.label}
          </p>
          <div
            aria-label={billingLabels.label}
            className="pricing-billing-switch grid w-full grid-cols-2 border border-ink bg-card p-1 shadow-[4px_4px_0_0_var(--accent)]"
            role="group"
          >
            <BillingTab
              active={cycle === "monthly"}
              label={billingLabels.monthly}
              onClick={() => selectCycle("monthly")}
            />
            <BillingTab
              active={cycle === "yearly"}
              label={billingLabels.yearly}
              badge={billingLabels.yearlyBadge}
              onClick={() => selectCycle("yearly")}
            />
          </div>
        </div>
      </div>

      <div className={`pricing-plan-grid grid gap-4 ${planGridClass}`}>
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            bestValue={bestValue}
            checkoutSuccessPath={checkoutSuccessPath}
            chooseLabel={chooseLabels[plan.id]}
            cycle={cycle}
            currentCycle={currentCycle}
            currentPlanLabel={currentPlanLabel}
            currentTier={currentTier}
            dashboardNewPath={dashboardNewPath}
            density={density}
            featureRows={featureRows}
            featuredLayout={featuredLayout}
            noCreditCard={noCreditCard}
            plan={plan}
            singlePlanLayout={singlePlanLayout}
            signedIn={signedIn}
            supportUpgradeLabel={supportUpgradeLabel}
            unavailableLabel={unavailableLabel}
            yearlyNote={billingLabels.yearlyNote}
          />
        ))}
      </div>
    </div>
  );
}

function BillingTab({
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
      aria-pressed={active}
      className={`pricing-billing-tab flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 px-3 text-center text-[14px] font-medium transition sm:min-h-11 sm:flex-row sm:gap-2 sm:px-4 ${
        active
          ? "pricing-billing-tab-active bg-ink text-paper"
          : "text-muted hover:bg-paper hover:text-ink"
      }`}
      onClick={onClick}
      type="button"
    >
      <span>{label}</span>
      {badge ? (
        <span
          className={`whitespace-nowrap px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${
            active ? "bg-accent text-paper" : "bg-accent-soft text-accent"
          }`}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function PlanCard({
  bestValue,
  checkoutSuccessPath,
  chooseLabel,
  cycle,
  currentCycle,
  currentPlanLabel,
  currentTier,
  dashboardNewPath,
  density,
  featureRows,
  featuredLayout,
  noCreditCard,
  plan,
  singlePlanLayout,
  signedIn,
  supportUpgradeLabel,
  unavailableLabel,
  yearlyNote,
}: {
  bestValue: string;
  checkoutSuccessPath: string;
  chooseLabel: string;
  cycle: BillingCycle;
  currentCycle: BillingCycle | null;
  currentPlanLabel: string;
  currentTier: Tier;
  dashboardNewPath: string;
  density: "default" | "compact";
  featureRows: PlanFeatureCopy[];
  featuredLayout: boolean;
  noCreditCard: string;
  plan: PlanCopy;
  singlePlanLayout: boolean;
  signedIn: boolean;
  supportUpgradeLabel: string;
  unavailableLabel: string;
  yearlyNote: string;
}) {
  const primary = plan.id === "pro";
  const display = planDisplay(plan, cycle, yearlyNote);
  const secondaryBilling = plan.id !== "free" && display.note?.trim();

  return (
    <article
      className={`pricing-plan-card relative flex flex-col border p-6 transition ${
        primary
          ? "pricing-plan-card-primary border-ink bg-ink text-paper shadow-[8px_8px_0_0_var(--accent)]"
          : "pricing-plan-card-secondary border-line bg-card hover:border-ink/35"
      } ${singlePlanLayout ? "pricing-plan-card-single" : ""} ${
        density === "compact" ? "min-h-[520px]" : "min-h-[590px]"
      } ${featuredLayout
          ? primary
            ? "lg:-mt-2 lg:min-h-[570px]"
            : "lg:mt-6"
          : ""
      }`}
    >
      {primary && !singlePlanLayout ? (
        <div className="pricing-best-value absolute right-5 top-5 inline-flex items-center gap-1.5 bg-accent px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-paper">
          {bestValue}
        </div>
      ) : null}

      <div
        className={`pricing-plan-intro ${density === "compact" ? "mt-6" : "mt-7"}`}
      >
        <h2 className="pricing-plan-name font-display text-[31px] font-medium tracking-tight">
          {plan.name}
        </h2>
        <p
          className={`pricing-plan-summary mt-2 min-h-[54px] text-[14.5px] leading-[1.65] ${
            primary ? "text-paper/68" : "text-muted"
          }`}
        >
          {plan.summary}
        </p>
      </div>

      <div
        className={`pricing-plan-price ${density === "compact" ? "mt-7" : "mt-8"}`}
      >
        <div className="pricing-plan-price-line flex flex-wrap items-end gap-x-2 gap-y-1">
          <span className="pricing-plan-price-value whitespace-nowrap font-display text-[56px] font-medium leading-none tracking-tight tabular">
            {display.price}
          </span>
          <span
            className={`pricing-plan-cadence pb-1.5 font-mono text-[11px] uppercase tracking-[0.16em] ${
              primary ? "text-paper/55" : "text-muted"
            }`}
          >
            {display.cadence}
          </span>
        </div>
        <p
          className={`pricing-plan-billing-note mt-2 min-h-4 ${
            secondaryBilling ? "text-[14px]" : "font-mono text-[11px] uppercase tracking-[0.16em]"
          } ${
            primary ? "text-paper/45" : "text-muted"
          }`}
        >
          {secondaryBilling || (plan.id === "free" ? noCreditCard : "\u00a0")}
        </p>
      </div>

      <dl
        className={`pricing-plan-features ${
          density === "compact" ? "mt-7" : "mt-8"
        } grid gap-0 border-t border-current/15`}
      >
        {featureRows.map((row) => (
          <Spec
            key={row.key}
            density={density}
            label={cycle === "yearly" ? row.annualLabel ?? row.label : row.label}
            value={
              cycle === "yearly"
                ? row.annualValues?.[plan.id] ?? row.values[plan.id]
                : row.values[plan.id]
            }
            primary={primary}
          />
        ))}
      </dl>

      <PlanAction
        checkoutSuccessPath={checkoutSuccessPath}
        chooseLabel={chooseLabel}
        cycle={cycle}
        currentCycle={currentCycle}
        currentPlanLabel={currentPlanLabel}
        currentTier={currentTier}
        dashboardNewPath={dashboardNewPath}
        plan={plan}
        primary={primary}
        signedIn={signedIn}
        supportUpgradeLabel={supportUpgradeLabel}
        unavailableLabel={unavailableLabel}
      />
      {plan.purchaseNote ? (
        <p
          className={`pricing-plan-purchase-note mt-2 text-center font-mono text-[10px] uppercase tracking-[0.14em] ${
            primary ? "text-paper/45" : "text-muted"
          }`}
        >
          {plan.purchaseNote}
        </p>
      ) : null}
    </article>
  );
}

function PlanAction({
  checkoutSuccessPath,
  chooseLabel,
  cycle,
  currentCycle,
  currentPlanLabel,
  currentTier,
  dashboardNewPath,
  plan,
  primary,
  signedIn,
  supportUpgradeLabel,
  unavailableLabel,
}: {
  checkoutSuccessPath: string;
  chooseLabel: string;
  cycle: BillingCycle;
  currentCycle: BillingCycle | null;
  currentPlanLabel: string;
  currentTier: Tier;
  dashboardNewPath: string;
  plan: PlanCopy;
  primary: boolean;
  signedIn: boolean;
  supportUpgradeLabel: string;
  unavailableLabel: string;
}) {
  const baseClass = `pricing-plan-action mt-auto inline-flex h-12 items-center justify-center gap-2 border px-4 text-[14px] font-medium transition ${
    primary ? "border-paper bg-paper text-ink" : "border-ink bg-ink text-paper"
  }`;
  const planTier = tierForPlan(plan.id);
  const hasPaidPlan = signedIn && currentTier !== "free";
  const selectedCycleMatchesCurrent = currentCycle === null || cycle === currentCycle;

  if (signedIn && planTier === currentTier && selectedCycleMatchesCurrent) {
    return <DisabledPlanButton className={baseClass}>{currentPlanLabel}</DisabledPlanButton>;
  }

  if (
    signedIn &&
    currentTier === "basic" &&
    planTier === "pro" &&
    selectedCycleMatchesCurrent
  ) {
    return <DisabledPlanButton className={baseClass}>{supportUpgradeLabel}</DisabledPlanButton>;
  }

  if (hasPaidPlan) {
    return <DisabledPlanButton className={baseClass}>{unavailableLabel}</DisabledPlanButton>;
  }

  if (plan.id === "free") {
    return (
      <FreePlanButton
        signedIn={signedIn}
        dashboardPath={dashboardNewPath}
        className={baseClass}
      >
        {chooseLabel}
      </FreePlanButton>
    );
  }

  const tier: Exclude<Tier, "free"> = plan.id === "starter" ? "basic" : "pro";

  return (
    <PaddleCheckoutButton
      tier={tier}
      cycle={cycle}
      signedIn={signedIn}
      checkoutSuccessPath={checkoutSuccessPath}
      className={baseClass}
    >
      {chooseLabel}
    </PaddleCheckoutButton>
  );
}

function DisabledPlanButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <button
      type="button"
      disabled
      className={`${className} cursor-not-allowed opacity-60`}
    >
      {children}
    </button>
  );
}

function tierForPlan(planId: PlanId): Tier {
  if (planId === "starter") return "basic";
  if (planId === "pro") return "pro";
  return "free";
}

function Spec({
  density = "default",
  label,
  value,
  primary = false,
}: {
  density?: "default" | "compact";
  label: string;
  value: string;
  primary?: boolean;
}) {
  return (
    <div
      className={`pricing-plan-spec grid grid-cols-[minmax(0,112px)_minmax(0,1fr)] gap-3 border-b border-current/10 text-[14px] ${
        density === "compact" ? "min-h-[48px] py-2.5" : "min-h-[54px] py-3"
      }`}
    >
      <dt
        className={`hyphens-auto font-mono text-[10px] uppercase leading-[1.35] tracking-[0.12em] [overflow-wrap:anywhere] ${
          primary ? "text-paper/45" : "text-muted"
        }`}
      >
        {label}
      </dt>
      <dd className={`leading-[1.45] ${primary ? "text-paper/88" : "text-ink/88"}`}>
        {value}
      </dd>
    </div>
  );
}

function planDisplay(plan: PlanCopy, cycle: BillingCycle, yearlyNote: string) {
  if (plan.id === "free" || cycle === "monthly") {
    return {
      price: plan.price,
      cadence: plan.cadence,
      note: plan.id === "free" ? undefined : "\u00a0",
    };
  }

  const annualPrice = plan.annualPrice ?? plan.price;
  const annualCadence = plan.annualCadence ?? plan.cadence;
  const savings = annualSavings(plan.price, annualPrice);

  return {
    price: monthlyEquivalentPrice(annualPrice) ?? annualPrice,
    cadence: plan.cadence,
    note: savings
      ? applyPriceTemplate(yearlyNote, annualPrice, savings)
      : `${annualPrice} ${annualCadence}`,
  };
}

function monthlyEquivalentPrice(annualPrice: string) {
  const match = annualPrice.trim().match(/^([^0-9-]*)([0-9]+(?:\.[0-9]+)?)(.*)$/);
  if (!match) return null;

  const [, prefix, amount, suffix] = match;
  const monthly = Number(amount) / 12;
  if (!Number.isFinite(monthly)) return null;

  return `${prefix}${formatMoney(monthly)}${suffix}`;
}

function annualSavings(monthlyPrice: string, annualPrice: string) {
  const monthly = parseMoney(monthlyPrice);
  const annual = parseMoney(annualPrice);
  if (!monthly || !annual) return null;

  const savings = monthly.amount * 12 - annual.amount;
  if (savings <= 0) return null;

  return `${annual.prefix || monthly.prefix}${formatMoney(savings)}${
    annual.suffix || monthly.suffix
  }`;
}

function parseMoney(value: string) {
  const match = value.trim().match(/^([^0-9-]*)([0-9]+(?:\.[0-9]+)?)(.*)$/);
  if (!match) return null;

  const [, prefix, amount, suffix] = match;
  const parsedAmount = Number(amount);
  if (!Number.isFinite(parsedAmount)) return null;

  return { amount: parsedAmount, prefix, suffix };
}

function applyPriceTemplate(template: string, price: string, savings: string) {
  return template.replaceAll("{price}", price).replaceAll("{savings}", savings);
}

function formatMoney(amount: number) {
  if (Number.isInteger(amount)) return String(amount);
  return amount.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}
