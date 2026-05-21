import { Link } from "@/i18n/navigation";
import { cf } from "@/lib/cf";

type Row = {
  id: string;
  user_id: string;
  email: string | null;
  title: string;
  status: string;
  source: string;
  duration_sec: number | null;
  reserved_minutes: number | null;
  speech_model: string;
  language: string | null;
  aai_transcript_id: string | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
  deleted_at: string | null;
};

const PAGE_SIZE = 50;

export default async function AdminTranscriptsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; user?: string; page?: string; show?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status ?? "";
  const user = sp.user ?? "";
  const show = sp.show ?? "active";
  const pageNum = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const env = await cf();
  const where: string[] = [];
  const binds: (string | number)[] = [];
  if (show !== "all") where.push("t.deleted_at IS NULL");
  if (status) {
    where.push(`t.status = ?${binds.length + 1}`);
    binds.push(status);
  }
  if (user) {
    where.push(`u.email LIKE ?${binds.length + 1}`);
    binds.push(`%${user}%`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const { results } = await env.DB.prepare(
    `SELECT t.id, t.user_id, u.email, t.title, t.status, t.source,
            t.duration_sec, t.reserved_minutes, t.speech_model, t.language,
            t.aai_transcript_id, t.error,
            t.created_at, t.completed_at, t.deleted_at
       FROM transcripts t
       LEFT JOIN users u ON u.id = t.user_id
       ${whereSql}
      ORDER BY t.created_at DESC
      LIMIT ${PAGE_SIZE} OFFSET ${offset}`
  )
    .bind(...binds)
    .all<Row>();

  return (
    <main className="mx-auto max-w-[1280px] px-4 py-10 sm:px-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Transcripts</h1>
        <form className="flex items-center gap-2">
          <input
            type="search"
            name="user"
            defaultValue={user}
            placeholder="user email…"
            className="rounded-full border border-line px-3 py-1.5 text-[13px]"
          />
          <select
            name="status"
            defaultValue={status}
            className="rounded-full border border-line px-3 py-1.5 text-[13px]"
          >
            <option value="">Any status</option>
            <option value="pending">pending</option>
            <option value="uploading">uploading</option>
            <option value="queued">queued</option>
            <option value="processing">processing</option>
            <option value="completed">completed</option>
            <option value="error">error</option>
          </select>
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
            Filter
          </button>
        </form>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-line">
        <table className="w-full text-[13px]">
          <thead className="bg-ink/5 text-left text-xs uppercase tracking-wide text-ink/60">
            <tr>
              <Th>Title</Th>
              <Th>User</Th>
              <Th>Status</Th>
              <Th>Duration</Th>
              <Th>Model · lang</Th>
              <Th>Created</Th>
              <Th>AAI id</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {results.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-ink/50">
                  No transcripts.
                </td>
              </tr>
            ) : (
              results.map((r) => (
                <tr key={r.id} className={r.deleted_at ? "opacity-50" : undefined}>
                  <Td>
                    <div className="font-medium">{r.title}</div>
                    <div className="font-mono text-[11px] text-ink/40">{r.id}</div>
                    {r.error ? (
                      <div className="mt-0.5 truncate text-[11px] text-red-600" title={r.error}>
                        {r.error.slice(0, 80)}
                      </div>
                    ) : null}
                  </Td>
                  <Td>{r.email ?? <span className="font-mono">{r.user_id}</span>}</Td>
                  <Td>
                    <StatusBadge status={r.status} />
                    {r.deleted_at ? (
                      <div className="mt-0.5 inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-700">
                        deleted
                      </div>
                    ) : null}
                  </Td>
                  <Td>
                    {r.duration_sec != null ? formatDuration(r.duration_sec) : "—"}
                    {r.reserved_minutes ? (
                      <div className="text-[11px] text-ink/40">res {r.reserved_minutes}m</div>
                    ) : null}
                  </Td>
                  <Td>
                    <div>{r.speech_model}</div>
                    <div className="text-[11px] text-ink/40">{r.language ?? "—"}</div>
                  </Td>
                  <Td>{formatDate(r.created_at)}</Td>
                  <Td>
                    <span className="font-mono text-[11px]">{r.aai_transcript_id ?? "—"}</span>
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pager page={pageNum} count={results.length} status={status} user={user} show={show} />
    </main>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-2.5 font-medium">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-ink/10 text-ink/70",
    uploading: "bg-ink/10 text-ink/70",
    queued: "bg-amber-100 text-amber-800",
    processing: "bg-amber-100 text-amber-800",
    completed: "bg-emerald-100 text-emerald-800",
    error: "bg-red-100 text-red-800",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
        map[status] ?? "bg-ink/10 text-ink/70"
      }`}
    >
      {status}
    </span>
  );
}

function Pager({
  page,
  count,
  status,
  user,
  show,
}: {
  page: number;
  count: number;
  status: string;
  user: string;
  show: string;
}) {
  const params = (n: number) => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (user) sp.set("user", user);
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
            href={`/admin/transcripts${params(page - 1)}`}
            className="rounded-full border border-line px-3 py-1 hover:bg-ink/5"
          >
            Prev
          </Link>
        ) : null}
        {hasNext ? (
          <Link
            href={`/admin/transcripts${params(page + 1)}`}
            className="rounded-full border border-line px-3 py-1 hover:bg-ink/5"
          >
            Next
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(s: string | null): string {
  if (!s) return "—";
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");
  return Number.isNaN(d.getTime())
    ? s
    : d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}
