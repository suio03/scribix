"use client";

import { useEffect, useState } from "react";
import { Check, Minus } from "lucide-react";
import {
  FreePlanButton,
  PaddleCheckoutButton,
} from "@/app/components/PaddleCheckoutButton";
import { trackEvent } from "@/lib/analytics";
import type { PlanFeatureCopy } from "@/lib/pricing-feature-rows";
import type { PlanCopy, PlanId } from "@/lib/pricing-plans";
import type { BillingCycle, Tier } from "@/lib/plans";

export type { PlanCopy, PlanId } from "@/lib/pricing-plans";

const FREE_CHECKLIST_KEYS = new Set([
  "accuracyModel",
  "aiSummaries",
  "exports",
]);

const CREATOR_CHECKLIST_KEYS = new Set([
  "accuracyModel",
  "aiSummaries",
  "exports",
]);

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
  featureStyle?: "specs" | "checklist";
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
  featureStyle = "specs",
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
      <div
        className={`pricing-billing-control flex justify-center ${
          featureStyle === "checklist" ? "mb-6 sm:mb-8" : "mb-8 sm:mb-10"
        }`}
      >
        <div className="flex w-full max-w-[420px] flex-col items-center gap-2.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            {billingLabels.label}
          </p>
          <div
            aria-label={billingLabels.label}
            className="pricing-billing-switch grid w-full grid-cols-2 rounded-xl border border-ink bg-card p-1 shadow-[4px_4px_0_0_var(--accent)]"
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
            featureStyle={featureStyle}
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
      className={`pricing-billing-tab flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-3 text-center text-[14px] font-medium transition sm:min-h-11 sm:flex-row sm:gap-2 sm:px-4 ${
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
  featureStyle,
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
  featureStyle: "specs" | "checklist";
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
  const softPrimary = primary && featureStyle === "checklist";
  const inverted = primary && !softPrimary;
  const display = planDisplay(plan, cycle, yearlyNote);
  const secondaryBilling = plan.id !== "free" && display.note?.trim();
  const action = (
    <PlanAction
      checkoutSuccessPath={checkoutSuccessPath}
      chooseLabel={chooseLabel}
      cycle={cycle}
      currentCycle={currentCycle}
      currentPlanLabel={currentPlanLabel}
      currentTier={currentTier}
      dashboardNewPath={dashboardNewPath}
      early={featureStyle === "checklist"}
      plan={plan}
      primary={primary}
      softPrimary={softPrimary}
      signedIn={signedIn}
      supportUpgradeLabel={supportUpgradeLabel}
      unavailableLabel={unavailableLabel}
    />
  );
  const purchaseNote = plan.purchaseNote ? (
    <p
      className={`pricing-plan-purchase-note mt-2 text-center font-mono text-[10px] uppercase tracking-[0.14em] ${
        inverted ? "text-paper/45" : "text-muted"
      }`}
    >
      {plan.purchaseNote}
    </p>
  ) : null;

  return (
    <article
      className={`pricing-plan-card relative flex flex-col border p-6 transition ${
        inverted
          ? "pricing-plan-card-primary border-ink bg-ink text-paper shadow-[8px_8px_0_0_var(--accent)]"
          : softPrimary
            ? "pricing-plan-card-featured border-accent/45 bg-card text-ink shadow-[7px_7px_0_0_var(--accent-soft)]"
          : "pricing-plan-card-secondary border-line bg-card hover:border-ink/35"
      } ${singlePlanLayout ? "pricing-plan-card-single" : ""} ${
        density === "compact" ? "min-h-[520px]" : "min-h-[590px]"
      } ${featuredLayout
          ? featureStyle === "checklist"
            ? ""
            : primary
            ? "lg:-mt-2 lg:min-h-[570px]"
            : "lg:mt-6"
          : ""
      }`}
    >
      {primary && !singlePlanLayout ? (
        <div
          className={`absolute right-5 top-5 inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] ${
            softPrimary
              ? "pricing-best-value-soft border border-accent/25 bg-accent-soft text-accent"
              : "pricing-best-value bg-accent text-paper"
          }`}
        >
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
            inverted ? "text-paper/68" : "text-muted"
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
              inverted ? "text-paper/55" : "text-muted"
            }`}
          >
            {display.cadence}
          </span>
        </div>
        <p
          className={`pricing-plan-billing-note mt-2 min-h-4 ${
            secondaryBilling ? "text-[14px]" : "font-mono text-[11px] uppercase tracking-[0.16em]"
          } ${
            inverted ? "text-paper/45" : "text-muted"
          }`}
        >
          {secondaryBilling || (plan.id === "free" ? noCreditCard : "\u00a0")}
        </p>
      </div>

      {featureStyle === "checklist" ? (
        <PlanFeatureChecklist
          action={action}
          cycle={cycle}
          planId={plan.id}
          primary={inverted}
          purchaseNote={purchaseNote}
          rows={featureRows}
        />
      ) : (
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
              value={featureValue(row, plan.id, cycle)}
              primary={primary}
            />
          ))}
        </dl>
      )}

      {featureStyle === "specs" ? (
        <>
          {action}
          {purchaseNote}
        </>
      ) : null}
    </article>
  );
}

function PlanFeatureChecklist({
  action,
  cycle,
  planId,
  primary,
  purchaseNote,
  rows,
}: {
  action: React.ReactNode;
  cycle: BillingCycle;
  planId: PlanId;
  primary: boolean;
  purchaseNote: React.ReactNode;
  rows: PlanFeatureCopy[];
}) {
  const allowance = rows.find((row) => row.key === "monthlyMinutes");
  const checklistKeys = planId === "free"
    ? FREE_CHECKLIST_KEYS
    : planId === "pro"
      ? CREATOR_CHECKLIST_KEYS
      : null;
  const benefits = rows.filter((row) => checklistKeys?.has(row.key) ?? true);

  return (
    <div className="pricing-plan-features mt-7">
      {allowance ? (
        <div
          className={`border px-4 py-4 ${
            primary
              ? "border-paper/15 bg-paper/[0.06]"
              : "border-accent/20 bg-accent-soft/55"
          }`}
        >
          <p
            className={`font-mono text-[9px] uppercase tracking-[0.16em] ${
              primary ? "text-paper/45" : "text-muted"
            }`}
          >
            {allowance.label}
          </p>
          <p className="mt-1 font-display text-[22px] font-semibold tracking-tight">
            {featureValue(allowance, planId, cycle)}
          </p>
        </div>
      ) : null}

      {action}
      {purchaseNote}

      <ul className="mt-3 divide-y divide-current/10 border-y border-current/15">
        {benefits.map((row) => {
          const value = featureValue(row, planId, cycle);
          const unavailable = isUnavailableValue(value);
          const Icon = unavailable ? Minus : Check;

          return (
            <li key={row.key} className="flex gap-3 py-3">
              <span
                className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${
                  unavailable
                    ? primary
                      ? "bg-paper/[0.06] text-paper/30"
                      : "bg-ink/[0.04] text-muted"
                    : primary
                      ? "bg-accent text-paper"
                      : "bg-accent-soft text-accent"
                }`}
              >
                <Icon size={12} strokeWidth={2.2} />
              </span>
              <div className="min-w-0">
                <p className="text-[13.5px] font-semibold leading-5">{row.label}</p>
                <p
                  className={`mt-0.5 text-[12px] leading-5 ${
                    primary ? "text-paper/55" : "text-muted"
                  }`}
                >
                  {value}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function featureValue(
  row: PlanFeatureCopy,
  planId: PlanId,
  cycle: BillingCycle
) {
  return cycle === "yearly"
    ? row.annualValues?.[planId] ?? row.values[planId]
    : row.values[planId];
}

function isUnavailableValue(value: string) {
  const normalized = value.trim().toLowerCase();
  return normalized === "no" || normalized.startsWith("not available");
}

function PlanAction({
  checkoutSuccessPath,
  chooseLabel,
  cycle,
  currentCycle,
  currentPlanLabel,
  currentTier,
  dashboardNewPath,
  early = false,
  plan,
  primary,
  softPrimary = false,
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
  early?: boolean;
  plan: PlanCopy;
  primary: boolean;
  softPrimary?: boolean;
  signedIn: boolean;
  supportUpgradeLabel: string;
  unavailableLabel: string;
}) {
  const baseClass = `pricing-plan-action inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg border px-4 text-[14px] font-medium transition ${
    early ? "mt-6" : "mt-auto"
  } ${
    softPrimary
      ? "border-accent bg-accent text-paper hover:bg-accent/90"
      : early
        ? "border-ink bg-card text-ink hover:bg-paper"
      : primary
        ? "border-paper bg-paper text-ink"
        : "border-ink bg-ink text-paper"
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
