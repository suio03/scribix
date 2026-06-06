"use client";

import { useState } from "react";
import { FreePlanButton, PaddleCheckoutButton } from "@/app/components/PaddleCheckoutButton";
import type { BillingCycle, Tier } from "@/lib/plans";

export type PlanId = "free" | "starter" | "pro";

export type PlanCopy = {
  id: PlanId;
  name: string;
  price: string;
  cadence: string;
  minutes: string;
  unitValue: string;
  summary: string;
  fileLimit: string;
  queue: string;
  aiOutputs: string;
  annual?: string;
  annualPrice?: string;
  annualCadence?: string;
  annualMinutes?: string;
  annualUnitValue?: string;
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
  dashboardNewPath: string;
  noCreditCard: string;
  plans: PlanCopy[];
  signedIn: boolean;
  specLabels: Record<"minutes" | "unitValue" | "fileLimit" | "queue" | "aiOutputs", string>;
};

export function PricingPlans({
  billingLabels,
  bestValue,
  checkoutSuccessPath,
  chooseLabels,
  dashboardNewPath,
  noCreditCard,
  plans,
  signedIn,
  specLabels,
}: PricingPlansProps) {
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

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

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard
            key={plan.id}
            bestValue={bestValue}
            checkoutSuccessPath={checkoutSuccessPath}
            chooseLabel={chooseLabels[plan.id]}
            cycle={cycle}
            dashboardNewPath={dashboardNewPath}
            noCreditCard={noCreditCard}
            plan={plan}
            signedIn={signedIn}
            specLabels={specLabels}
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
  dashboardNewPath,
  noCreditCard,
  plan,
  signedIn,
  specLabels,
}: {
  bestValue: string;
  checkoutSuccessPath: string;
  chooseLabel: string;
  cycle: BillingCycle;
  dashboardNewPath: string;
  noCreditCard: string;
  plan: PlanCopy;
  signedIn: boolean;
  specLabels: Record<"minutes" | "unitValue" | "fileLimit" | "queue" | "aiOutputs", string>;
}) {
  const primary = plan.id === "pro";
  const display = planDisplay(plan, cycle);

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
          className={`mt-2 min-h-4 font-mono text-[11px] uppercase tracking-[0.16em] ${
            primary ? "text-paper/45" : "text-muted"
          }`}
        >
          {plan.id === "free" ? noCreditCard : "\u00a0"}
        </p>
      </div>

      <dl className="mt-8 grid gap-3 border-t border-current/15 pt-6">
        <Spec label={specLabels.minutes} value={display.minutes} primary={primary} />
        <Spec label={specLabels.unitValue} value={display.unitValue} primary={primary} />
        <Spec label={specLabels.fileLimit} value={plan.fileLimit} primary={primary} />
        <Spec label={specLabels.queue} value={plan.queue} primary={primary} />
        <Spec label={specLabels.aiOutputs} value={plan.aiOutputs} primary={primary} />
      </dl>

      <PlanAction
        checkoutSuccessPath={checkoutSuccessPath}
        chooseLabel={chooseLabel}
        cycle={cycle}
        dashboardNewPath={dashboardNewPath}
        plan={plan}
        primary={primary}
        signedIn={signedIn}
      />
    </article>
  );
}

function PlanAction({
  checkoutSuccessPath,
  chooseLabel,
  cycle,
  dashboardNewPath,
  plan,
  primary,
  signedIn,
}: {
  checkoutSuccessPath: string;
  chooseLabel: string;
  cycle: BillingCycle;
  dashboardNewPath: string;
  plan: PlanCopy;
  primary: boolean;
  signedIn: boolean;
}) {
  const baseClass = `mt-auto inline-flex h-12 items-center justify-center gap-2 border px-4 text-[14px] font-medium transition ${
    primary ? "border-paper bg-paper text-ink" : "border-ink bg-ink text-paper"
  }`;

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
      successPath={checkoutSuccessPath}
      className={baseClass}
    >
      {chooseLabel}
    </PaddleCheckoutButton>
  );
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
    <div className="grid grid-cols-[94px_minmax(0,1fr)] gap-3 text-[14px]">
      <dt
        className={`font-mono text-[10px] uppercase tracking-[0.16em] ${
          primary ? "text-paper/45" : "text-muted"
        }`}
      >
        {label}
      </dt>
      <dd className={primary ? "text-paper/88" : "text-ink/88"}>{value}</dd>
    </div>
  );
}

function planDisplay(plan: PlanCopy, cycle: BillingCycle) {
  if (plan.id === "free" || cycle === "monthly") {
    return {
      price: plan.price,
      cadence: plan.cadence,
      minutes: plan.minutes,
      unitValue: plan.unitValue,
    };
  }

  const fallback = splitAnnual(plan.annual);

  return {
    price: plan.annualPrice ?? fallback.price ?? plan.price,
    cadence: plan.annualCadence ?? fallback.cadence ?? plan.cadence,
    minutes: plan.annualMinutes ?? plan.minutes,
    unitValue: plan.annualUnitValue ?? plan.unitValue,
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
