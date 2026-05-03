import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getLocale } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { redirect } from "@/i18n/navigation";
import { auth, signOut } from "@/auth";
import { quotaMinutesFor, type BillingCycle, type Tier } from "@/lib/plans";
import { BillingPortalButton } from "@/app/components/BillingPortalButton";
import { DeleteAccountButton } from "@/app/components/DeleteAccountButton";

type UserRow = {
  email: string;
  full_name: string | null;
  tier: Tier;
  billing_cycle: BillingCycle | null;
  subscription_status: string | null;
  customer_id: string | null;
  minutes_used_this_period: number;
  period_ends_at: string;
};

export default async function AccountPage() {
  const locale = await getLocale();
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect({ href: "/", locale });
  }

  const { env } = getCloudflareContext();
  const row = await env.DB.prepare(
    `SELECT email, full_name, tier, billing_cycle, subscription_status,
            customer_id, minutes_used_this_period, period_ends_at
       FROM users
      WHERE id = ?1`
  )
    .bind(userId)
    .first<UserRow>();

  const tier: Tier = row?.tier ?? "free";
  const cycle = row?.billing_cycle ?? null;
  const usedMin = row?.minutes_used_this_period ?? 0;
  const quotaMin = quotaMinutesFor(tier, cycle);
  const hasBilling = Boolean(row?.customer_id);

  return (
    <main className="mx-auto max-w-[720px] px-4 py-12 sm:px-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Account</h1>
        <Link
          href="/dashboard"
          className="rounded-full border border-line px-3.5 py-1.5 text-[13px] font-medium hover:bg-ink/5"
        >
          Back
        </Link>
      </div>

      <dl className="mt-10 space-y-6 rounded-2xl border border-line p-6">
        <Field label="Email" value={row?.email ?? session?.user?.email ?? "—"} />
        <Field label="Name" value={row?.full_name ?? session?.user?.name ?? "—"} />
        <Field label="Plan" value={planLabel(tier, cycle, row?.subscription_status ?? null)} />
        <Field label="Usage this period" value={`${usedMin} / ${quotaMin} min`} />
        <Field label="Period resets" value={row ? formatDate(row.period_ends_at) : "—"} />
      </dl>

      <div className="mt-6 flex flex-wrap gap-3">
        {tier === "free" ? (
          <Link
            href="/#pricing"
            className="rounded-full bg-ink px-4 py-2 text-[13px] font-medium text-paper hover:bg-accent"
          >
            Upgrade plan
          </Link>
        ) : null}
        {hasBilling ? <BillingPortalButton /> : null}
      </div>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
        className="mt-8"
      >
        <button
          type="submit"
          className="rounded-full border border-line px-4 py-2 text-[13px] font-medium hover:bg-ink/5"
        >
          Sign out
        </button>
      </form>

      <div className="mt-12 rounded-2xl border border-red-200 p-6">
        <h2 className="text-sm font-semibold text-red-700">Danger zone</h2>
        <p className="mt-1 text-sm text-ink/60">
          Permanently delete your account, transcripts, and audio. This cannot be undone.
        </p>
        <div className="mt-4">
          <DeleteAccountButton />
        </div>
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm text-ink/60">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

function planLabel(tier: Tier, cycle: BillingCycle | null, status: string | null): string {
  const name = tier.charAt(0).toUpperCase() + tier.slice(1);
  if (tier === "free") return name;
  const parts: string[] = [name];
  if (cycle) parts.push(cycle);
  if (status === "canceled") parts.push("(canceled — access until period end)");
  if (status === "expired") parts.push("(expired)");
  return parts.join(" · ");
}

function formatDate(s: string) {
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime())
    ? s
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
