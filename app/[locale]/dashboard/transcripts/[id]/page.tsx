import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { getPathname, Link } from "@/i18n/navigation";
import { redirect } from "@/i18n/navigation";
import { cf } from "@/lib/cf";
import type { AaiTranscript } from "@/lib/aai";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { parseSpeakerNames } from "@/lib/speaker-names";
import { TranscriptWorkspace } from "@/app/components/TranscriptWorkspace";
import { partialTranscriptInfo } from "@/lib/partial-transcript";

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
            created_at, completed_at, transcript_r2_key, audio_r2_key,
            speaker_names_json, source, youtube_url, youtube_video_id, mime_type,
            source_duration_sec, processing_limit_sec, partial_requested
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
      speaker_names_json: string | null;
      source: string | null;
      youtube_url: string | null;
      youtube_video_id: string | null;
      mime_type: string | null;
      processing_limit_sec: number | null;
      source_duration_sec: number | null;
      partial_requested: number;
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
      ? `/api/transcripts/${row.id}/audio`
      : null;

  const audioAvailable = Boolean(row.audio_r2_key) && !expired;
  const partial = partialTranscriptInfo({
    processedDurationSec: row.duration_sec,
    sourceDurationSec: row.source_duration_sec,
    processingLimitSec: row.processing_limit_sec,
    partialRequested: row.partial_requested === 1,
  });
  const checkoutSuccessPath = getPathname({
    href: { pathname: "/dashboard", query: { checkout: "ok" } },
    locale,
  });

  return (
    <main className="product-surface-refresh transcript-detail-refresh mx-auto max-w-[1400px] px-4 py-10 sm:px-8">
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
          {partial ? (
            <p className="mt-3 inline-flex rounded-full border border-accent/25 bg-accent-soft/55 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-accent">
              {partial.sourceMinutes === null
                ? t("partialUnknownLabel", {
                    processedMin: partial.processedMinutes,
                  })
                : t("partialLabel", {
                    processedMin: partial.processedMinutes,
                    sourceMin: partial.sourceMinutes,
                  })}
            </p>
          ) : null}
        </div>
      </div>

      {row.status === "completed" && expired ? (
        <div className="mt-6 rounded-2xl border border-line bg-card/60 px-4 py-3 text-[13px] text-ink/70">
          <span className="font-medium text-ink">{t("audioExpiredLabel")}</span>{" "}
          {t("audioExpiredBody")}
        </div>
      ) : null}

      {row.status !== "completed" ? (
        <section className="mt-8 min-w-0">
          <StatusPanel status={row.status} error={row.error} t={t} />
        </section>
      ) : aai ? (
        <TranscriptWorkspace
          id={row.id}
          audioUrl={audioUrl}
          mediaMime={row.mime_type}
          audioAvailable={audioAvailable}
          utterances={aai.utterances ?? []}
          paragraphs={aai.paragraphs ?? []}
          sentences={aai.sentences ?? []}
          fallbackText={aai.text ?? ""}
          sourceLanguage={row.language ?? aai.language_code ?? null}
          youtubeUrl={row.source === "youtube" ? row.youtube_url : null}
          youtubeVideoId={row.source === "youtube" ? row.youtube_video_id : null}
          initialSpeakerNames={parseSpeakerNames(row.speaker_names_json)}
          isPaid={user.tier !== "free"}
          checkoutSuccessPath={checkoutSuccessPath}
          partialTranscript={partial}
        />
      ) : (
        <p className="mt-8 text-sm text-ink/60">{t("missing")}</p>
      )}
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
  row: {
    duration_sec: number | null;
    source_duration_sec: number | null;
    language: string | null;
    status: string;
  },
  t: (key: string) => string
) {
  const parts: string[] = [];
  const displayDuration = row.source_duration_sec ?? row.duration_sec;
  if (displayDuration) parts.push(formatDuration(displayDuration));
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
