import Link from "next/link";
import { auth } from "@/auth";
import { cf } from "@/lib/cf";

type Row = {
  id: string;
  title: string;
  status: "pending" | "uploading" | "queued" | "processing" | "completed" | "error";
  created_at: string;
  duration_sec: number | null;
};

export default async function DashboardPage() {
  const session = await auth();
  const userId = session!.user.id;
  const env = cf();

  const { results } = await env.DB.prepare(
    `SELECT id, title, status, created_at, duration_sec
       FROM transcripts
      WHERE user_id = ?1 AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 100`
  )
    .bind(userId)
    .all<Row>();

  return (
    <main className="mx-auto max-w-[1180px] px-4 py-12 sm:px-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Your transcripts</h1>
          <p className="mt-1 text-sm text-ink/60">
            {results.length === 0 ? "Nothing yet." : `${results.length} item${results.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/account"
            className="rounded-full border border-line px-3.5 py-1.5 text-[13px] font-medium hover:bg-ink/5"
          >
            Account
          </Link>
          <Link
            href="/dashboard/new"
            className="rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-medium text-paper hover:bg-accent"
          >
            New transcript
          </Link>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-line p-12 text-center">
          <p className="text-sm text-ink/60">No transcripts yet.</p>
          <Link
            href="/dashboard/new"
            className="mt-4 inline-block text-sm font-medium text-accent underline-offset-4 hover:underline"
          >
            Upload your first file →
          </Link>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-line rounded-2xl border border-line">
          {results.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <div className="min-w-0">
                <Link
                  href={`/dashboard/transcripts/${r.id}`}
                  className="block truncate text-sm font-medium hover:text-accent"
                >
                  {r.title}
                </Link>
                <p className="mt-0.5 text-xs text-ink/50">
                  {formatRelative(r.created_at)}
                  {r.duration_sec ? ` · ${formatDuration(r.duration_sec)}` : ""}
                </p>
              </div>
              <StatusBadge status={r.status} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function StatusBadge({ status }: { status: Row["status"] }) {
  const map: Record<Row["status"], { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-ink/10 text-ink/70" },
    uploading: { label: "Uploading", cls: "bg-ink/10 text-ink/70" },
    queued: { label: "Queued", cls: "bg-amber-100 text-amber-800" },
    processing: { label: "Transcribing", cls: "bg-amber-100 text-amber-800" },
    completed: { label: "Ready", cls: "bg-emerald-100 text-emerald-800" },
    error: { label: "Error", cls: "bg-red-100 text-red-800" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {label}
    </span>
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatRelative(s: string): string {
  const d = new Date(s.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return s;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
