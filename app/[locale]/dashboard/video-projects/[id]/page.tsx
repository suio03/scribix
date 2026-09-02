import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { VideoCandidateWorkspace } from "@/app/components/VideoCandidateWorkspace";
import { Link, redirect } from "@/i18n/navigation";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { listClipCandidates } from "@/lib/video-workspace/candidates";
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
            p.transcript_id, t.title, a.duration_ms AS source_duration_ms
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
      title: string;
      source_duration_ms: number | null;
    }>();
  if (!project) notFound();

  const [candidates, previews, t] = await Promise.all([
    listClipCandidates(env.DB, user.id, project.id),
    listCandidatePreviews(env.DB, user.id, project.id),
    getTranslations("Dashboard.videoCandidates"),
  ]);

  return (
    <main className="product-surface-refresh mx-auto max-w-[1180px] px-4 py-10 sm:px-8 sm:py-14">
      <Link
        href={`/dashboard/transcripts/${project.transcript_id}`}
        className="text-[13px] text-ink/55 transition hover:text-ink"
      >
        {t("back")}
      </Link>
      <div className="mt-5 max-w-3xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/40">
          {t("workspaceLabel")}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {project.title}
        </h1>
      </div>
      <nav aria-label={t("workflow.label")} className="mt-7 overflow-x-auto border-y border-line py-3">
        <ol className="flex min-w-max items-center gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">
          <li>
            <Link href={`/dashboard/transcripts/${project.transcript_id}`} className="transition hover:text-ink">
              <span className="mr-1 text-ink/25">01</span>{t("workflow.transcript")}
            </Link>
          </li>
          <li aria-hidden="true" className="h-px w-7 bg-line" />
          <li><a href="#clips" className="text-accent"><span className="mr-1 text-accent/45">02</span>{t("workflow.clips")}</a></li>
          <li aria-hidden="true" className="h-px w-7 bg-line" />
          <li><a href="#editor" className="transition hover:text-ink"><span className="mr-1 text-ink/25">03</span>{t("workflow.editor")}</a></li>
          <li aria-hidden="true" className="h-px w-7 bg-line" />
          <li><a href="#exports" className="transition hover:text-ink"><span className="mr-1 text-ink/25">04</span>{t("workflow.exports")}</a></li>
        </ol>
      </nav>
      <VideoCandidateWorkspace
        projectId={project.id}
        initialStatus={project.status}
        sourceDurationMs={project.source_duration_ms}
        initialCandidates={candidates}
        initialPreviews={previews}
      />
    </main>
  );
}
