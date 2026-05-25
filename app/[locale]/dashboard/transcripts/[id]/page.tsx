import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { Link } from "@/i18n/navigation";
import { redirect } from "@/i18n/navigation";
import { cf } from "@/lib/cf";
import type { AaiTranscript } from "@/lib/aai";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { presignGet } from "@/lib/r2";
import { TranscriptViewer } from "@/app/components/TranscriptViewer";
import { ExportPanel } from "@/app/components/ExportPanel";

type Params = { params: Promise<{ locale: string; id: string }> };

export default async function TranscriptViewerPage({ params }: Params) {
  const { locale, id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/", locale });
    return null;
  }
  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) notFound();
  const userId = user.id;
  const t = await getTranslations("Dashboard.viewer");

  const row = await env.DB.prepare(
    `SELECT id, user_id, title, status, error, duration_sec, language,
            created_at, completed_at, transcript_r2_key, audio_r2_key
       FROM transcripts
      WHERE id = ?1 AND deleted_at IS NULL`
  )
    .bind(id)
    .first<{
      id: string;
      user_id: string;
      title: string;
      status: string;
      error: string | null;
      duration_sec: number | null;
      language: string | null;
      created_at: string;
      completed_at: string | null;
      transcript_r2_key: string | null;
      audio_r2_key: string | null;
    }>();
  if (!row) notFound();
  if (row.user_id !== userId) notFound();

  let aai: AaiTranscript | null = null;
  if (row.status === "completed" && row.transcript_r2_key) {
    const obj = await env.SCRIBIX_MEDIA.get(row.transcript_r2_key);
    if (obj) aai = (await obj.json()) as AaiTranscript;
  }

  const expired = audioExpired(row.created_at);
  const audioUrl =
    row.status === "completed" && row.audio_r2_key && !expired
      ? await presignGet(row.audio_r2_key, 60 * 60)
      : null;

  const audioAvailable = Boolean(row.audio_r2_key) && !expired;

  return (
    <main className="mx-auto max-w-[1400px] px-4 py-10 sm:px-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            href="/dashboard"
            className="text-[13px] text-ink/60 hover:text-ink"
          >
            {t("back")}
          </Link>
          <h1 className="mt-3 truncate font-display text-3xl font-semibold tracking-tight">
            {row.title}
          </h1>
          <p className="mt-1 text-sm text-ink/60">{metaLine(row, t)}</p>
        </div>
      </div>

      {row.status === "completed" && expired ? (
        <div className="mt-6 rounded-2xl border border-line bg-card/60 px-4 py-3 text-[13px] text-ink/70">
          <span className="font-medium text-ink">{t("audioExpiredLabel")}</span>{" "}
          {t("audioExpiredBody")}
        </div>
      ) : null}

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
        <section className="min-w-0">
          {row.status !== "completed" ? (
            <StatusPanel status={row.status} error={row.error} t={t} />
          ) : aai ? (
            <TranscriptViewer
              audioUrl={audioUrl}
              paragraphs={aai.paragraphs ?? []}
              sentences={aai.sentences ?? []}
              fallbackText={aai.text ?? ""}
            />
          ) : (
            <p className="text-sm text-ink/60">{t("missing")}</p>
          )}
        </section>

        {row.status === "completed" && aai ? (
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <ExportPanel id={row.id} audioAvailable={audioAvailable} />
          </aside>
        ) : null}
      </div>
    </main>
  );
}

const AUDIO_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function audioExpired(createdAt: string): boolean {
  const t = new Date(createdAt.includes("T") ? createdAt : createdAt.replace(" ", "T") + "Z").getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t > AUDIO_TTL_MS;
}

function statusMetaLabel(t: (key: string) => string, status: string): string {
  switch (status) {
    case "completed":
      return t("metaCompleted");
    case "pending":
      return t("metaPending");
    case "uploading":
      return t("metaUploading");
    case "queued":
      return t("metaQueued");
    case "processing":
      return t("metaProcessing");
    case "error":
      return t("metaError");
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

function metaLine(
  row: { duration_sec: number | null; language: string | null; status: string },
  t: (key: string) => string
) {
  const parts: string[] = [];
  if (row.duration_sec) parts.push(formatDuration(row.duration_sec));
  if (row.language) parts.push(row.language.toUpperCase());
  parts.push(statusMetaLabel(t, row.status));
  return parts.join(" · ");
}

function StatusPanel({
  status,
  error,
  t,
}: {
  status: string;
  error: string | null;
  t: (key: string) => string;
}) {
  if (status === "error") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        <p className="font-medium">{t("failedTitle")}</p>
        {error && <p className="mt-1 text-red-700/80">{error}</p>}
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-dashed border-line p-12 text-center">
      <p className="text-sm text-ink/60">
        {status === "queued" || status === "processing"
          ? t("transcribingHint")
          : t("workingHint")}
      </p>
    </div>
  );
}

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
