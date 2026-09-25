import { Clock3 } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { VideoCandidateWorkspace } from "@/app/components/VideoCandidateWorkspace";
import { TranscriptRowMenu } from "@/app/components/TranscriptRowMenu";
import { Link, redirect } from "@/i18n/navigation";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { videoWorkspaceAccessFor } from "@/lib/video-workspace/access";
import { analyzableDurationMs } from "@/lib/video-workspace/analysis-config";
import { listClipCandidates } from "@/lib/video-workspace/candidates";
import { listFinalRenders } from "@/lib/video-workspace/final-jobs";
import { listCandidatePreviews } from "@/lib/video-workspace/preview-jobs";

type Params = { params: Promise<{ locale: string; id: string }> };

export default async function VideoProjectPage({ params }: Params) {
  const { locale, id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect({ href: "/", locale });
    return null;
  }
  const env = await cf();
  const user = await getOrCreateCurrentUser(env.DB, session);
  if (!user) notFound();

  const project = await env.DB.prepare(
    `SELECT p.id,
            CASE
              WHEN p.status = 'analyzing'
               AND p.updated_at < datetime('now', '-10 minutes')
              THEN 'failed'
              ELSE p.status
            END AS status,
            p.transcript_id, p.draft_candidate_id, t.title,
            a.duration_ms AS source_duration_ms,
            t.processing_limit_sec,
            a.expires_at AS source_expires_at,
            CASE
              WHEN a.id IS NOT NULL
               AND a.status = 'ready'
               AND a.deleted_at IS NULL
               AND (a.expires_at IS NULL OR a.expires_at > CURRENT_TIMESTAMP)
              THEN 1 ELSE 0
            END AS source_available
       FROM video_projects p
       JOIN transcripts t
         ON t.id = p.transcript_id AND t.user_id = p.user_id
       LEFT JOIN media_assets a
         ON a.id = p.source_asset_id AND a.user_id = p.user_id
      WHERE p.id = ?1
        AND p.user_id = ?2
        AND p.deleted_at IS NULL
        AND t.deleted_at IS NULL`
  )
    .bind(id, user.id)
    .first<{
      id: string;
      status: string;
      transcript_id: string;
      draft_candidate_id: string | null;
      title: string;
      source_duration_ms: number | null;
      processing_limit_sec: number | null;
      source_expires_at: string | null;
      source_available: number;
    }>();
  if (!project) notFound();

  const sourceAvailable = project.source_available === 1;
  const [allCandidates, allPreviews, allRenders, t] = await Promise.all([
    listClipCandidates(env.DB, user.id, project.id),
    sourceAvailable
      ? listCandidatePreviews(env.DB, user.id, project.id)
      : Promise.resolve([]),
    sourceAvailable
      ? Promise.resolve([])
      : listFinalRenders(env.DB, user.id, project.id),
    getTranslations("Dashboard.videoCandidates"),
  ]);
  const access = videoWorkspaceAccessFor(user.tier);
  const accessibleCandidates = access.canEditClips
    ? allCandidates
    : allCandidates.filter((candidate) => candidate.origin === "ai");
  const renders = access.canEditClips
    ? allRenders
    : allRenders.map((render) => ({ ...render, coverUrl: null }));
  const exportedCandidateIds = new Set(renders.flatMap((render) => (
    render.status === "completed" && render.videoUrl && render.candidateId
      ? [render.candidateId]
      : []
  )));
  const candidates = sourceAvailable
    ? accessibleCandidates
    : accessibleCandidates.filter((candidate) => exportedCandidateIds.has(candidate.id));
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const previews = allPreviews.filter((preview) => candidateIds.has(preview.candidateId));
  const expiresAt = parseDbTimestamp(project.source_expires_at);

  return (
    <main className="product-surface-refresh mx-auto max-w-[1440px] px-4 pb-24 pt-4 sm:px-6 sm:pt-5">
      <Link
        href="/dashboard"
        className="text-body-sm text-muted transition hover:text-ink"
      >
        {t("back")}
      </Link>
      <div className="mt-2 flex items-start justify-between gap-5">
        <div className="min-w-0 flex-1">
          <p className="sr-only">
            {t("workspaceLabel")}
          </p>
          <h1 title={project.title} className="truncate font-display text-title font-semibold tracking-tight text-ink sm:text-[1.5rem] sm:leading-8">
            {project.title}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-meta text-muted">
            {project.source_duration_ms ? (
              <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                <Clock3 size={13} aria-hidden />
                {formatSourceDuration(project.source_duration_ms)}
              </span>
            ) : null}
            {sourceAvailable ? (
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden className="size-1.5 rounded-full bg-sage" />
                {expiresAt
                  ? t("sourceAvailableUntil", {
                    date: new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(expiresAt),
                  })
                  : t("sourceAvailable")}
              </span>
            ) : null}
          </p>
        </div>
        <TranscriptRowMenu
          id={project.transcript_id}
          projectId={project.id}
          title={project.title}
          status="completed"
          audioAvailable={sourceAvailable}
          sourceAvailable={sourceAvailable}
          context="project"
        />
      </div>
      <VideoCandidateWorkspace
        projectId={project.id}
        initialStatus={project.status}
        sourceDurationMs={project.source_duration_ms}
        analyzableDurationMs={analyzableDurationMs(project.source_duration_ms, project.processing_limit_sec)}
        initialCandidates={candidates}
        initialPreviews={previews}
        initialSelectedCandidateId={project.draft_candidate_id}
        initialRenders={renders}
        sourceAvailable={sourceAvailable}
        sourceExpiresAt={project.source_expires_at}
        canEdit={access.canEditClips}
      />
    </main>
  );
}

function formatSourceDuration(ms: number) {
  const total = Math.round(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

// D1 timestamps may be SQLite "YYYY-MM-DD HH:MM:SS" (UTC) or ISO strings.
function parseDbTimestamp(value: string | null) {
  if (!value) return null;
  const date = new Date(/[TZ+]/.test(value.slice(10)) ? value : `${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}
