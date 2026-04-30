import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { auth, signOut } from "@/auth";

type UserRow = {
  email: string;
  full_name: string | null;
  tier: "free" | "basic" | "pro";
  billing_cycle: "monthly" | "yearly" | null;
  period_ends_at: string;
};

const TIER_QUOTA_MIN: Record<UserRow["tier"], number> = {
  free: 30,
  basic: 600,
  pro: 1800,
};

export default async function AccountPage() {
  const session = await auth();
  const userId = session!.user.id;

  const { env } = getCloudflareContext();
  const row = await env.DB.prepare(
    `SELECT email, full_name, tier, billing_cycle, period_ends_at
       FROM users
      WHERE id = ?1`
  )
    .bind(userId)
    .first<UserRow>();

  // Phase 1: usage hardcoded to 0. Real counter wires up in Phase 5.
  const usedMin = 0;
  const quotaMin = row ? TIER_QUOTA_MIN[row.tier] : TIER_QUOTA_MIN.free;

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
        <Field label="Email" value={row?.email ?? session!.user.email ?? "—"} />
        <Field label="Name" value={row?.full_name ?? session!.user.name ?? "—"} />
        <Field
          label="Plan"
          value={
            row
              ? `${capitalize(row.tier)}${row.billing_cycle ? ` · ${row.billing_cycle}` : ""}`
              : "Free"
          }
        />
        <Field
          label="Usage this period"
          value={`${usedMin} / ${quotaMin} min`}
        />
        <Field
          label="Period resets"
          value={row ? formatDate(row.period_ends_at) : "—"}
        />
      </dl>

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

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(s: string) {
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime())
    ? s
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
