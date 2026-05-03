"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { signIn } from "next-auth/react";
import { PRICING_DISPLAY } from "@/lib/plans";

type Cycle = "monthly" | "yearly";
type PlanId = "free" | "basic" | "pro";

type PlanCard = {
  id: PlanId;
  name: string;
  blurb: string;
  features: { monthly: string[]; yearly: string[] };
  primary: boolean;
};

const PLANS: PlanCard[] = [
  {
    id: "free",
    name: "Free",
    blurb: "For occasional transcripts and tire-kickers.",
    features: {
      monthly: [
        "30 minutes / month",
        "Up to 30 min per file · 500 MB",
        "Speaker labels + word-level timestamps",
        "TXT, SRT & VTT export",
      ],
      yearly: [
        "30 minutes / month",
        "Up to 30 min per file · 500 MB",
        "Speaker labels + word-level timestamps",
        "TXT, SRT & VTT export",
      ],
    },
    primary: false,
  },
  {
    id: "basic",
    name: "Basic",
    blurb: "For podcasters and creators with steady output.",
    features: {
      monthly: [
        "10 hours / month",
        "Up to 2 hr per file · 2 GB",
        "Universal-3 Pro speech model",
        "Speaker labels + synced playback",
        "TXT, SRT & VTT export",
      ],
      yearly: [
        "120 hours / year, available immediately, refreshed at renewal",
        "Up to 2 hr per file · 2 GB",
        "Universal-3 Pro speech model",
        "Speaker labels + synced playback",
        "TXT, SRT & VTT export",
      ],
    },
    primary: true,
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "For teams turning long-form video into stories.",
    features: {
      monthly: [
        "30 hours / month",
        "Up to 10 hr per file · 5 GB",
        "Universal-3 Pro speech model",
        "Priority queue",
        "All export formats",
      ],
      yearly: [
        "360 hours / year, available immediately, refreshed at renewal",
        "Up to 10 hr per file · 5 GB",
        "Universal-3 Pro speech model",
        "Priority queue",
        "All export formats",
      ],
    },
    primary: false,
  },
];

export function PricingClient({
  signedIn,
  postSignInPath,
  dashboardPath,
  mostLoved,
}: {
  signedIn: boolean;
  postSignInPath: string;
  dashboardPath: string;
  mostLoved: string;
}) {
  const [cycle, setCycle] = useState<Cycle>("monthly");
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onPaidClick(tier: "basic" | "pro") {
    setErr(null);
    if (!signedIn) {
      await signIn("google", { redirectTo: postSignInPath });
      return;
    }
    setBusy(tier);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, cycle, successPath: `${dashboardPath}?checkout=ok` }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        throw new Error(j.message ?? j.error ?? `Checkout failed (${res.status}).`);
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch (e) {
      setBusy(null);
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    }
  }

  async function onFreeClick() {
    setErr(null);
    if (!signedIn) {
      await signIn("google", { redirectTo: dashboardPath });
      return;
    }
    window.location.href = dashboardPath;
  }

  return (
    <>
      <div className="mt-10 flex justify-center">
        <div className="inline-flex gap-1 rounded-full border border-line p-1">
          <CycleBtn active={cycle === "monthly"} onClick={() => setCycle("monthly")}>
            Monthly
          </CycleBtn>
          <CycleBtn active={cycle === "yearly"} onClick={() => setCycle("yearly")}>
            Yearly
            <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">
              −40%
            </span>
          </CycleBtn>
        </div>
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const { display, cadence } = priceLine(plan.id, cycle);
          const features = plan.features[cycle];
          const cta = plan.id === "free" ? "Start free" : `Try ${plan.name}`;
          const isBusy = busy === plan.id;
          return (
            <article
              key={plan.id}
              className={`relative flex flex-col gap-7 rounded-2xl border p-8 transition ${
                plan.primary
                  ? "border-accent bg-card shadow-[0_30px_80px_-30px_rgba(220,74,31,0.35)]"
                  : "border-line bg-card hover:border-ink/30"
              }`}
            >
              {plan.primary && (
                <span className="absolute -top-3 left-8 rounded-full bg-accent px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-paper">
                  {mostLoved}
                </span>
              )}

              <div>
                <h3 className="font-display text-[26px] font-medium tracking-tight">{plan.name}</h3>
                <p className="mt-1.5 text-[13.5px] text-muted">{plan.blurb}</p>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="font-display text-[48px] font-medium leading-none tracking-tight tabular">
                  {display}
                </span>
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">
                  {cadence}
                </span>
              </div>

              <ul className="space-y-3 border-t border-line pt-6">
                {features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-[14px] text-ink/90">
                    <Check
                      size={15}
                      strokeWidth={2}
                      className={`mt-0.5 shrink-0 ${plan.primary ? "text-accent" : "text-sage"}`}
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => (plan.id === "free" ? onFreeClick() : onPaidClick(plan.id))}
                disabled={busy !== null}
                className={`mt-auto inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-[14px] font-medium transition ${
                  plan.primary
                    ? "bg-accent text-paper hover:opacity-90"
                    : "border border-ink bg-ink text-paper hover:bg-accent hover:border-accent"
                } disabled:opacity-50`}
              >
                {isBusy ? "Redirecting…" : cta}
              </button>
            </article>
          );
        })}
      </div>

      {err && <p className="mt-6 text-center text-sm text-red-600">{err}</p>}
    </>
  );
}

function CycleBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-full px-4 py-1.5 text-[13px] font-medium transition ${
        active ? "bg-ink text-paper" : "text-ink/70 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function priceLine(id: PlanId, cycle: Cycle): { display: string; cadence: string } {
  if (id === "free") return { display: "$0", cadence: "forever" };
  const p = PRICING_DISPLAY[id][cycle];
  if (cycle === "monthly") return { display: `$${p.amount}`, cadence: "per month" };
  const monthlyEquiv = (p.amount / 12).toFixed(2).replace(/\.00$/, "");
  return { display: `$${monthlyEquiv}`, cadence: `per month, billed yearly ($${p.amount})` };
}
