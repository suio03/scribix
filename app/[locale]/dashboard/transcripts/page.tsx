import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { FileText } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { UploadOrRecord } from "@/app/components/UploadOrRecord";
import { TranscriptRowMenu } from "@/app/components/TranscriptRowMenu";
import { TrackToolVisit } from "@/app/components/Track";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { Link } from "@/i18n/navigation";

type TranscriptRow = {
  id: string;
  title: string;
  status: "pending" | "uploading" | "queued" | "processing" | "completed" | "error";
  created_at: string;
  duration_sec: number | null;
  audio_r2_key: string | null;
};

const AUDIO_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export default async function TranscriptsPage() {
  const locale = await getLocale();
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/", locale });
    return null;
  }

  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) {
    redirect({ href: "/", locale });
    return null;
  }

  const [t, listT] = await Promise.all([
    getTranslations("Dashboard.new"),
    getTranslations("Dashboard.list"),
  ]);
  const { results } = await env.DB.prepare(
    `SELECT t.id, t.title, t.status, t.created_at, t.duration_sec, t.audio_r2_key
       FROM transcripts t
       LEFT JOIN video_projects p
         ON p.transcript_id = t.id
        AND p.user_id = t.user_id
        AND p.deleted_at IS NULL
      WHERE t.user_id = ?1
        AND t.deleted_at IS NULL
        AND p.id IS NULL
      ORDER BY t.created_at DESC
      LIMIT 100`
  )
    .bind(user.id)
    .all<TranscriptRow>();

  return (
    <main className="product-surface-refresh mx-auto max-w-[1040px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <TrackToolVisit slug="dashboard-transcripts" />
      <div className="max-w-[680px]">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
          {listT("eyebrow")}
        </p>
        <h1 className="mt-2 font-display text-[36px] font-semibold leading-tight tracking-[-0.04em] text-ink sm:text-[46px]">
          {listT("filterTranscripts")}
        </h1>
        <p className="mt-3 max-w-[58ch] text-[14px] leading-6 text-muted">
          {t("transcriptDescription")}
        </p>
      </div>

      <section className="mt-8 overflow-hidden rounded-[24px] border border-line bg-card shadow-[0_24px_70px_-52px_rgba(18,17,14,0.55)]">
        <div className="border-b border-line bg-paper/60 px-5 py-4 sm:px-6">
          <h2 className="text-[15px] font-semibold text-ink">{t("transcriptUploadTitle")}</h2>
          <p className="mt-1 text-[12px] leading-5 text-muted">{t("transcriptUploadDescription")}</p>
        </div>
        <div className="p-5 sm:p-6">
          <UploadOrRecord
            signedIn
            postSignInPath="/dashboard/transcripts"
            checkoutSuccessPath="/dashboard/transcripts"
            tier={user.tier}
            billingCycle={user.billing_cycle}
          />
        </div>
      </section>

      <section className="mt-12" aria-labelledby="saved-transcripts-title">
        <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
          <h2 id="saved-transcripts-title" className="font-display text-2xl font-semibold tracking-[-0.03em] text-ink">
            {listT("filterTranscripts")}
          </h2>
          <span className="font-mono text-[10px] text-muted">{results.length}</span>
        </div>

        {results.length === 0 ? (
          <div className="rounded-b-2xl border-x border-b border-dashed border-line bg-card px-6 py-12 text-center">
            <p className="text-[13px] text-muted">{listT("empty")}</p>
          </div>
        ) : (
          <div className="mt-4 grid gap-2">
            {results.map((row) => (
              <article key={row.id} className="group flex min-h-[88px] items-center gap-4 rounded-2xl border border-line bg-card px-4 py-3 transition hover:border-ink/18 sm:px-5">
                <span className="inline-grid size-10 shrink-0 place-items-center rounded-xl bg-paper text-muted">
                  <FileText size={17} strokeWidth={1.7} />
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/dashboard/transcripts/${row.id}`}
                    className="block truncate text-[14px] font-semibold text-ink transition group-hover:text-accent"
                  >
                    {row.title}
                  </Link>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted">
                    <span>{formatDateTime(row.created_at, locale)}</span>
                    <span aria-hidden>·</span>
                    <span className="tabular-nums">
                      {row.duration_sec ? formatDuration(row.duration_sec) : listT("durationPending")}
                    </span>
                  </div>
                </div>
                <TranscriptStatus
                  status={row.status}
                  label={
                    row.status === "completed"
                      ? listT("statusReady")
                      : row.status === "error"
                        ? listT("statusError")
                        : row.status === "queued" || row.status === "processing"
                          ? listT("statusTranscribing")
                          : row.status === "uploading"
                            ? listT("statusUploading")
                            : listT("statusPending")
                  }
                />
                <TranscriptRowMenu
                  id={row.id}
                  title={row.title}
                  status={row.status}
                  audioAvailable={audioStillAvailable(row.created_at, row.audio_r2_key)}
                  context="transcript"
                />
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function TranscriptStatus({
  status,
  label,
}: {
  status: TranscriptRow["status"];
  label: string;
}) {
  const ready = status === "completed";
  const failed = status === "error";
  return (
    <span className={`hidden shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium sm:inline-flex ${
      failed
        ? "border-red-200 bg-red-50 text-red-700"
        : ready
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-line bg-paper text-muted"
    }`}>
      {label}
    </span>
  );
}

function audioStillAvailable(createdAt: string, audioKey: string | null): boolean {
  if (!audioKey) return false;
  const time = new Date(createdAt.includes("T") ? createdAt : `${createdAt.replace(" ", "T")}Z`).getTime();
  return Number.isNaN(time) || Date.now() - time <= AUDIO_TTL_MS;
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0
    ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    : `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDateTime(value: string, locale: string): string {
  const date = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
