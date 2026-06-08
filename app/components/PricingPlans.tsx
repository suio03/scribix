"use client";

import { useState } from "react";
import {
  FreePlanButton,
  PaddleCheckoutButton,
} from "@/app/components/PaddleCheckoutButton";
import type { BillingCycle, Tier } from "@/lib/plans";

export type PlanId = "free" | "starter" | "pro";

export type PlanCopy = {
  id: PlanId;
  name: string;
  price: string;
  cadence: string;
  summary: string;
  annual?: string;
  annualPrice?: string;
  annualCadence?: string;
};

export type PlanFeatureCopy = {
  label: string;
  values: Record<PlanId, string>;
};

type PricingPlansProps = {
  billingLabels: {
    label: string;
    monthly: string;
    yearly: string;
    yearlyBadge: string;
  };
  bestValue: string;
  checkoutSuccessPath: string;
  chooseLabels: Record<PlanId, string>;
  currentPlanLabel: string;
  currentCycle?: BillingCycle | null;
  currentTier?: Tier;
  dashboardNewPath: string;
  featureRows: PlanFeatureCopy[];
  noCreditCard: string;
  plans: PlanCopy[];
  signedIn: boolean;
  supportUpgradeLabel: string;
  unavailableLabel: string;
};

export function PricingPlans({
  billingLabels,
  bestValue,
  checkoutSuccessPath,
  chooseLabels,
  currentPlanLabel,
  currentCycle = null,
  currentTier = "free",
  dashboardNewPath,
  featureRows,
  noCreditCard,
  plans,
  signedIn,
  supportUpgradeLabel,
  unavailableLabel,
}: PricingPlansProps) {
  const [cycle, setCycle] = useState<BillingCycle>(currentCycle ?? "monthly");
  const planGridClass = plans.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-3";

  return (
    <div>
      <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:mb-8 sm:flex-row sm:items-center">
        <div
          aria-label={billingLabels.label}
          className="inline-grid grid-cols-2 border border-line bg-card p-1"
          role="tablist"
        >
          <BillingTab
            active={cycle === "monthly"}
            label={billingLabels.monthly}
            onClick={() => setCycle("monthly")}
          />
          <BillingTab
            active={cycle === "yearly"}
            label={billingLabels.yearly}
            onClick={() => setCycle("yearly")}
          />
        </div>
        <p className="border border-accent/25 bg-accent-soft px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
          {billingLabels.yearlyBadge}
        </p>
      </div>

      <div className={`grid gap-4 ${planGridClass}`}>
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
            featureRows={featureRows}
            noCreditCard={noCreditCard}
            plan={plan}
            signedIn={signedIn}
            supportUpgradeLabel={supportUpgradeLabel}
            unavailableLabel={unavailableLabel}
          />
        ))}
      </div>
    </div>
  );
}

function BillingTab({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      aria-selected={active}
      className={`h-10 min-w-28 px-5 text-center text-[14px] font-medium transition ${
        active ? "bg-ink text-paper" : "text-muted hover:bg-paper hover:text-ink"
      }`}
      onClick={onClick}
      role="tab"
      type="button"
    >
      {label}
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
  featureRows,
  noCreditCard,
  plan,
  signedIn,
  supportUpgradeLabel,
  unavailableLabel,
}: {
  bestValue: string;
  checkoutSuccessPath: string;
  chooseLabel: string;
  cycle: BillingCycle;
  currentCycle: BillingCycle | null;
  currentPlanLabel: string;
  currentTier: Tier;
  dashboardNewPath: string;
  featureRows: PlanFeatureCopy[];
  noCreditCard: string;
  plan: PlanCopy;
  signedIn: boolean;
  supportUpgradeLabel: string;
  unavailableLabel: string;
}) {
  const primary = plan.id === "pro";
  const display = planDisplay(plan, cycle);
  const secondaryBilling = plan.id !== "free" && display.note?.trim();

  return (
    <article
      className={`relative flex min-h-[590px] flex-col border p-6 transition ${
        primary
          ? "border-ink bg-ink text-paper shadow-[8px_8px_0_0_var(--accent)]"
          : "border-line bg-card hover:border-ink/35"
      }`}
    >
      {primary ? (
        <div className="absolute right-5 top-5 inline-flex items-center gap-1.5 bg-accent px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-paper">
          {bestValue}
        </div>
      ) : null}

      <div className="mt-7">
        <h2 className="font-display text-[31px] font-medium tracking-tight">
          {plan.name}
        </h2>
        <p
          className={`mt-2 min-h-[54px] text-[14.5px] leading-[1.65] ${
            primary ? "text-paper/68" : "text-muted"
          }`}
        >
          {plan.summary}
        </p>
      </div>

      <div className="mt-8">
        <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
          <span className="whitespace-nowrap font-display text-[56px] font-medium leading-none tracking-tight tabular">
            {display.price}
          </span>
          <span
            className={`pb-1.5 font-mono text-[11px] uppercase tracking-[0.16em] ${
              primary ? "text-paper/55" : "text-muted"
            }`}
          >
            {display.cadence}
          </span>
        </div>
        <p
          className={`mt-2 min-h-4 ${
            secondaryBilling ? "text-[14px]" : "font-mono text-[11px] uppercase tracking-[0.16em]"
          } ${
            primary ? "text-paper/45" : "text-muted"
          }`}
        >
          {secondaryBilling || (plan.id === "free" ? noCreditCard : "\u00a0")}
        </p>
      </div>

      <dl className="mt-8 grid gap-0 border-t border-current/15">
        {featureRows.map((row) => (
          <Spec
            key={row.label}
            label={row.label}
            value={row.values[plan.id]}
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
  const baseClass = `mt-auto inline-flex h-12 items-center justify-center gap-2 border px-4 text-[14px] font-medium transition ${
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
  label,
  value,
  primary = false,
}: {
  label: string;
  value: string;
  primary?: boolean;
}) {
  return (
    <div className="grid min-h-[54px] grid-cols-[minmax(0,112px)_minmax(0,1fr)] gap-3 border-b border-current/10 py-3 text-[14px]">
      <dt
        className={`font-mono text-[10px] uppercase leading-[1.35] tracking-[0.12em] ${
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

function planDisplay(plan: PlanCopy, cycle: BillingCycle) {
  if (plan.id === "free" || cycle === "monthly") {
    return {
      price: plan.price,
      cadence: plan.cadence,
      note: plan.id === "free" ? undefined : "\u00a0",
    };
  }

  const fallback = splitAnnual(plan.annual);
  const annualPrice = plan.annualPrice ?? fallback.price ?? plan.price;
  const annualCadence = plan.annualCadence ?? fallback.cadence ?? plan.cadence;

  return {
    price: monthlyEquivalentPrice(annualPrice) ?? annualPrice,
    cadence: plan.cadence,
    note: `${annualPrice} ${annualCadence}`,
  };
}

function splitAnnual(value: string | undefined) {
  if (!value) return {};
  const [price, ...cadenceParts] = value.split("/");
  return {
    price,
    cadence: cadenceParts.length > 0 ? cadenceParts.join("/") : undefined,
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

function formatMoney(amount: number) {
  return String(Math.ceil(amount));
}
