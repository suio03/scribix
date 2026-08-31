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
            p.transcript_id, t.title
       FROM video_projects p
       JOIN transcripts t
         ON t.id = p.transcript_id AND t.user_id = p.user_id
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
      <VideoCandidateWorkspace
        projectId={project.id}
        initialStatus={project.status}
        initialCandidates={candidates}
        initialPreviews={previews}
      />
    </main>
  );
}
