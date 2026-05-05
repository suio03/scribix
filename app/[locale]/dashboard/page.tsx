import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { AlertCircle, AudioLines, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { cf } from "@/lib/cf";
import { TranscriptRowMenu } from "@/app/components/TranscriptRowMenu";

type Row = {
  id: string;
  title: string;
  status: "pending" | "uploading" | "queued" | "processing" | "completed" | "error";
  created_at: string;
  duration_sec: number | null;
  audio_r2_key: string | null;
};

const AUDIO_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function audioStillAvailable(createdAt: string, audioKey: string | null): boolean {
  if (!audioKey) return false;
  const t = new Date(
    createdAt.includes("T") ? createdAt : createdAt.replace(" ", "T") + "Z"
  ).getTime();
  if (Number.isNaN(t)) return true;
  return Date.now() - t <= AUDIO_TTL_MS;
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ checkout?: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect({ href: "/", locale });
  }
  const env = cf();
  const sp = await searchParams;
  const showCheckoutOk = sp.checkout === "ok";

  const { results } = await env.DB.prepare(
    `SELECT id, title, status, created_at, duration_sec, audio_r2_key
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
        <Link
          href="/dashboard/new"
          className="rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-medium text-paper hover:bg-accent"
        >
          New transcript
        </Link>
      </div>

      {showCheckoutOk ? (
        <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
          <p className="font-medium">Subscription active — welcome aboard.</p>
          <p className="mt-0.5 text-emerald-800/80">
            Your new plan is live. Visit{" "}
            <Link href="/dashboard/account" className="underline underline-offset-2">
              account
            </Link>{" "}
            to see your usage.
          </p>
        </div>
      ) : null}

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
        <div className="mt-8 overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-ink/[0.03] text-left text-[12px] uppercase tracking-wide text-ink/60">
              <tr>
                <th className="px-4 py-3 font-medium sm:px-6">Name</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Uploaded</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Duration</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium sm:px-6">Operation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {results.map((r) => (
                <tr key={r.id} className="hover:bg-ink/[0.02]">
                  <td className="min-w-0 max-w-[420px] px-4 py-3 sm:px-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                        <AudioLines size={18} />
                      </div>
                      <Link
                        href={`/dashboard/transcripts/${r.id}`}
                        className="block truncate text-[14px] font-medium text-ink hover:text-accent"
                      >
                        {r.title}
                      </Link>
                    </div>
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-[13px] text-ink/70 sm:table-cell">
                    {formatDateTime(r.created_at)}
                  </td>
                  <td className="hidden whitespace-nowrap px-4 py-3 text-[13px] tabular-nums text-ink/70 sm:table-cell">
                    {r.duration_sec ? formatDuration(r.duration_sec) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusIcon status={r.status} />
                  </td>
                  <td className="px-4 py-3 sm:px-6">
                    <TranscriptRowMenu
                      id={r.id}
                      status={r.status}
                      audioAvailable={audioStillAvailable(r.created_at, r.audio_r2_key)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function StatusIcon({ status }: { status: Row["status"] }) {
  switch (status) {
    case "completed":
      return (
        <span title="Ready" className="inline-flex text-emerald-600">
          <CheckCircle2 size={20} />
        </span>
      );
    case "error":
      return (
        <span title="Error" className="inline-flex text-red-600">
          <AlertCircle size={20} />
        </span>
      );
    case "queued":
    case "processing":
      return (
        <span title="Transcribing" className="inline-flex text-amber-600">
          <Loader2 size={20} className="animate-spin" />
        </span>
      );
    case "pending":
    case "uploading":
    default:
      return (
        <span title={status === "uploading" ? "Uploading" : "Pending"} className="inline-flex text-ink/40">
          <Clock size={20} />
        </span>
      );
  }
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDateTime(s: string): string {
  const d = new Date(s.includes("T") ? s : s.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return s;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}
