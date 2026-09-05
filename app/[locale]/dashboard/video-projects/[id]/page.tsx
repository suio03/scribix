import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { VideoCandidateWorkspace } from "@/app/components/VideoCandidateWorkspace";
import { TranscriptRowMenu } from "@/app/components/TranscriptRowMenu";
import { Link, redirect } from "@/i18n/navigation";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { videoWorkspaceAccessFor } from "@/lib/video-workspace/access";
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

  return (
    <main className="product-surface-refresh mx-auto max-w-[1180px] px-4 py-10 sm:px-8 sm:py-14">
      <Link
        href="/dashboard"
        className="text-[13px] text-ink/55 transition hover:text-ink"
      >
        {t("back")}
      </Link>
      <div className="mt-5 flex items-start justify-between gap-5">
        <div className="max-w-3xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">
            {t("workspaceLabel")}
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            {project.title}
          </h1>
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
