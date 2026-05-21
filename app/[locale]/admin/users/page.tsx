import { Link } from "@/i18n/navigation";
import { cf } from "@/lib/cf";
import { quotaMinutesFor, type BillingCycle, type Tier } from "@/lib/plans";

type UserRow = {
  id: string;
  email: string;
  full_name: string | null;
  tier: Tier;
  billing_cycle: BillingCycle | null;
  subscription_status: string | null;
  customer_id: string | null;
  minutes_used_this_period: number;
  period_ends_at: string;
  created_at: string;
  deleted_at: string | null;
};

const PAGE_SIZE = 50;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; show?: string }>;
}) {
  const { q = "", page = "1", show = "active" } = await searchParams;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;
  const includeDeleted = show === "all";

  const env = await cf();
  const where: string[] = [];
  const binds: (string | number)[] = [];
  if (!includeDeleted) where.push("deleted_at IS NULL");
  if (q) {
    where.push(`(email LIKE ?${binds.length + 1} OR full_name LIKE ?${binds.length + 1})`);
    binds.push(`%${q}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { results } = await env.DB.prepare(
    `SELECT id, email, full_name, tier, billing_cycle, subscription_status,
            customer_id, minutes_used_this_period, period_ends_at,
            created_at, deleted_at
       FROM users
       ${whereSql}
      ORDER BY created_at DESC
      LIMIT ${PAGE_SIZE} OFFSET ${offset}`
  )
    .bind(...binds)
    .all<UserRow>();

  return (
    <main className="mx-auto max-w-[1180px] px-4 py-10 sm:px-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Users</h1>
        <form className="flex items-center gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="email or name…"
            className="rounded-full border border-line px-3 py-1.5 text-[13px]"
          />
          <select
            name="show"
            defaultValue={show}
            className="rounded-full border border-line px-3 py-1.5 text-[13px]"
          >
            <option value="active">Active</option>
            <option value="all">Include deleted</option>
          </select>
          <button
            type="submit"
            className="rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-medium text-paper hover:bg-accent"
          >
            Search
          </button>
        </form>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line">
        <table className="w-full text-[13px]">
          <thead className="bg-ink/5 text-left text-xs uppercase tracking-wide text-ink/60">
            <tr>
              <Th>Email</Th>
              <Th>Plan</Th>
              <Th>Usage</Th>
              <Th>Period ends</Th>
              <Th>Customer</Th>
              <Th>Joined</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {results.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-ink/50">
                  No users.
                </td>
              </tr>
            ) : (
              results.map((u) => (
                <tr
                  key={u.id}
                  className={u.deleted_at ? "opacity-50" : undefined}
                >
                  <Td>
                    <div className="font-medium">{u.email}</div>
                    {u.full_name ? <div className="text-ink/50">{u.full_name}</div> : null}
                    {u.deleted_at ? (
                      <div className="mt-0.5 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                        deleted
                      </div>
                    ) : null}
                  </Td>
                  <Td>{planLabel(u.tier, u.billing_cycle, u.subscription_status)}</Td>
                  <Td>
                    {u.minutes_used_this_period} / {quotaMinutesFor(u.tier, u.billing_cycle)} min
                  </Td>
                  <Td>{formatDate(u.period_ends_at)}</Td>
                  <Td>
                    <span className="font-mono text-[11px]">{u.customer_id ?? "—"}</span>
                  </Td>
                  <Td>{formatDate(u.created_at)}</Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pager page={pageNum} count={results.length} q={q} show={show} />
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 font-medium">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}

function Pager({
  page,
  count,
  q,
  show,
}: {
  page: number;
  count: number;
  q: string;
  show: string;
}) {
  const params = (n: number) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (show && show !== "active") sp.set("show", show);
    sp.set("page", String(n));
    return `?${sp.toString()}`;
  };
  const hasNext = count === PAGE_SIZE;
  return (
    <div className="mt-4 flex items-center justify-between text-[13px]">
      <span className="text-ink/50">Page {page}</span>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link
            href={`/admin/users${params(page - 1)}`}
            className="rounded-full border border-line px-3 py-1 hover:bg-ink/5"
          >
            Prev
          </Link>
        ) : null}
        {hasNext ? (
          <Link
            href={`/admin/users${params(page + 1)}`}
            className="rounded-full border border-line px-3 py-1 hover:bg-ink/5"
          >
            Next
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function planLabel(tier: Tier, cycle: BillingCycle | null, status: string | null): string {
  const name = tier.charAt(0).toUpperCase() + tier.slice(1);
  if (tier === "free") return name;
  const parts: string[] = [name];
  if (cycle) parts.push(cycle);
  if (status && status !== "active") parts.push(`(${status})`);
  return parts.join(" · ");
}

function formatDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime())
    ? s
    : d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}
