import { auth } from "@/auth";
import { redirect } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import {
  AlertCircle,
  ArrowUpRight,
  CheckCircle2,
  Clapperboard,
  Clock3,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cf } from "@/lib/cf";
import { getOrCreateCurrentUser } from "@/lib/current-user";
import { VideoProjectThumbnail } from "@/app/components/VideoProjectThumbnail";
import { TranscriptRowMenu } from "@/app/components/TranscriptRowMenu";

type Row = {
  id: string;
  title: string;
  status: "pending" | "uploading" | "queued" | "processing" | "completed" | "error";
  created_at: string;
  activity_at: string;
  duration_sec: number | null;
  audio_r2_key: string | null;
  video_project_id: string;
  video_project_status: string;
  source_available: number;
  source_expires_at: string | null;
  clip_count: number;
  exported_clip_count: number;
};

type ProjectStage =
  | "uploading"
  | "transcribing"
  | "findingClips"
  | "readyToEdit"
  | "exporting"
  | "exported"
  | "sourceExpired"
  | "failed";

const AUDIO_TTL_MS = 14 * 24 * 60 * 60 * 1000;

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
  const userId = user.id;
  const sp = await searchParams;
  const showCheckoutOk = sp.checkout === "ok";
  const t = await getTranslations("Dashboard.list");

  const { results } = await env.DB.prepare(
    `SELECT t.id, t.title, t.status, t.created_at, t.duration_sec, t.audio_r2_key,
            p.id AS video_project_id, p.status AS video_project_status,
            source.expires_at AS source_expires_at,
            CASE
              WHEN source.id IS NOT NULL
               AND source.status = 'ready'
               AND source.deleted_at IS NULL
               AND (source.expires_at IS NULL OR source.expires_at > CURRENT_TIMESTAMP)
              THEN 1 ELSE 0
            END AS source_available,
            COALESCE(p.updated_at, t.created_at) AS activity_at,
            (
              SELECT COUNT(*)
                FROM clip_candidates c
               WHERE c.project_id = p.id AND c.status <> 'deleted'
            ) AS clip_count,
            (
              SELECT COUNT(DISTINCT version.candidate_id)
                FROM project_versions version
                JOIN render_jobs job
                  ON job.project_version_id = version.id
                 AND job.user_id = version.user_id
                JOIN media_assets video
                  ON video.id = job.output_asset_id AND video.user_id = job.user_id
                JOIN media_assets cover
                  ON cover.id = job.cover_asset_id AND cover.user_id = job.user_id
               WHERE version.project_id = p.id
                 AND version.user_id = p.user_id
                 AND version.candidate_id IS NOT NULL
                 AND job.kind = 'final'
                 AND job.status = 'completed'
                 AND job.superseded_at IS NULL
                 AND video.status = 'ready' AND video.deleted_at IS NULL
                 AND (video.expires_at IS NULL OR video.expires_at > CURRENT_TIMESTAMP)
                 AND cover.status = 'ready' AND cover.deleted_at IS NULL
                 AND (cover.expires_at IS NULL OR cover.expires_at > CURRENT_TIMESTAMP)
            ) AS exported_clip_count
       FROM video_projects p
       INNER JOIN transcripts t
         ON t.id = p.transcript_id
        AND t.user_id = p.user_id
        AND t.deleted_at IS NULL
       LEFT JOIN media_assets source
         ON source.id = p.source_asset_id AND source.user_id = p.user_id
      WHERE p.user_id = ?1 AND p.deleted_at IS NULL
      ORDER BY activity_at DESC
      LIMIT 100`
  )
    .bind(userId)
    .all<Row>();

  return (
    <main className="product-surface-refresh mx-auto max-w-[1120px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      {showCheckoutOk ? (
        <div className="mb-8 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm text-emerald-900">
          <p className="font-medium">{t("checkoutOkTitle")}</p>
          <p className="mt-0.5 text-emerald-800/80">
            {t.rich("checkoutOkBody", {
              link: (chunks) => (
                <Link href="/dashboard/billing" className="underline underline-offset-2">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </div>
      ) : null}

      <div className="flex items-end justify-between gap-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-accent">
            {t("eyebrow")}
          </p>
          <h1 className="font-display text-[30px] font-semibold tracking-[-0.035em] text-ink sm:text-[36px]">
            {t("title")}
          </h1>
          <p className="mt-1.5 text-[13px] leading-6 text-muted">{t("description")}</p>
        </div>
        <Link
          href="/dashboard/new"
          className="hidden shrink-0 items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-[12px] font-semibold text-ink transition hover:border-ink/25 sm:inline-flex"
        >
          <Plus size={14} />
          {t("newTranscript")}
        </Link>
      </div>

      {results.length === 0 ? (
        <div className="mt-8 rounded-[24px] border border-dashed border-line bg-card px-6 py-16 text-center">
          <span className="mx-auto inline-grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent">
            <Sparkles size={20} strokeWidth={1.8} />
          </span>
          <h2 className="mt-5 font-display text-2xl font-semibold tracking-tight text-ink">
            {t("emptyTitle")}
          </h2>
          <p className="mx-auto mt-2 max-w-[46ch] text-[14px] leading-6 text-muted">
            {t("emptyBody")}
          </p>
          <Link
            href="/dashboard/new"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-paper transition hover:bg-accent"
          >
            <Plus size={15} />
            {t("emptyCta")}
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid gap-2.5">
          {results.map((row) => {
            const href = `/dashboard/video-projects/${row.video_project_id}`;
            const stage = projectStage(row);
            const visibleClipCount = row.source_available === 1
              ? row.clip_count
              : row.exported_clip_count;
            return (
              <article
                key={row.id}
                className="group overflow-hidden rounded-2xl border border-line bg-card transition duration-200 hover:border-ink/18 hover:shadow-[0_16px_42px_-38px_rgba(17,16,13,0.5)]"
              >
                <div className="flex min-h-[112px]">
                  <Link
                    href={href}
                    aria-label={row.title}
                    className="relative hidden w-[124px] shrink-0 overflow-hidden border-r border-line bg-[#17102f] sm:block"
                  >
                    <VideoProjectThumbnail
                      projectId={row.video_project_id}
                      available={row.source_available === 1}
                    >
                      <VideoProjectVisual />
                    </VideoProjectThumbnail>
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col justify-center p-4 sm:px-5">
                    <div className="flex min-w-0 items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
                          <Clapperboard size={12} />
                          {t("videoProject")}
                        </p>
                        <Link
                          href={href}
                          className="mt-1.5 block truncate text-[15px] font-semibold tracking-[-0.01em] text-ink transition group-hover:text-accent sm:text-[16px]"
                        >
                          {row.title}
                        </Link>
                      </div>
                      <ProjectStatus stage={stage} label={t(`projectStatus.${stage}`)} />
                      <TranscriptRowMenu
                        id={row.id}
                        projectId={row.video_project_id}
                        title={row.title}
                        status={row.status}
                        audioAvailable={audioStillAvailable(row.created_at, row.audio_r2_key)}
                        sourceAvailable={row.source_available === 1}
                        context="project"
                      />
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-4">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
                        <span>{formatDateTime(row.activity_at)}</span>
                        <span aria-hidden>·</span>
                        <span className="tabular-nums">
                          {row.duration_sec ? formatDuration(row.duration_sec) : t("durationPending")}
                        </span>
                        {visibleClipCount > 0 ? (
                          <>
                            <span aria-hidden>·</span>
                            <span>{t("clipCount", { count: visibleClipCount })}</span>
                          </>
                        ) : null}
                        {row.source_available === 1 && row.source_expires_at ? (
                          <>
                            <span aria-hidden>·</span>
                            <span>{t("sourceExpires", { date: formatDateTime(row.source_expires_at) })}</span>
                          </>
                        ) : null}
                      </div>
                      <Link
                        href={href}
                        aria-label={t("openProject", { title: row.title })}
                        className="inline-grid size-8 shrink-0 place-items-center rounded-full border border-line text-muted transition group-hover:border-accent/30 group-hover:bg-accent-soft group-hover:text-accent"
                      >
                        <ArrowUpRight size={15} />
                      </Link>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}

function projectStage(row: Row): ProjectStage {
  if (row.status === "error" || row.video_project_status === "failed") return "failed";
  if (row.status === "pending" || row.status === "uploading") return "uploading";
  if (row.status === "queued" || row.status === "processing") return "transcribing";
  if (row.source_available !== 1) return "sourceExpired";

  switch (row.video_project_status) {
    case "analyzing":
      return "findingClips";
    case "rendering":
      return "exporting";
    case "completed":
      return "exported";
    case "candidates_ready":
    case "editing":
    case "draft":
    default:
      return "readyToEdit";
  }
}

function ProjectStatus({ stage, label }: { stage: ProjectStage; label: string }) {
  const active = stage === "transcribing" || stage === "findingClips" || stage === "exporting";
  const failed = stage === "failed";
  const complete = stage === "exported";
  const Icon = failed
    ? AlertCircle
    : active
      ? Loader2
      : complete
        ? CheckCircle2
        : Clock3;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${
        failed
          ? "border-red-200 bg-red-50 text-red-700"
          : complete
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : active
              ? "border-accent/20 bg-accent-soft text-accent"
              : "border-line bg-paper text-muted"
      }`}
    >
      <Icon size={12} className={active ? "animate-spin" : undefined} />
      {label}
    </span>
  );
}

function VideoProjectVisual() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute -left-10 top-2 size-32 rounded-full bg-accent/25 blur-3xl" />
      <div className="absolute -right-12 bottom-0 size-28 rounded-full bg-generated/25 blur-3xl" />
      <div className="absolute left-1/2 top-1/2 h-[88px] w-[50px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[9px] border border-white/15 bg-[#201641] shadow-2xl">
        <div className="absolute inset-x-1.5 top-2 h-10 rounded-md bg-gradient-to-br from-[#5943a3] to-[#201641]" />
        <div className="absolute inset-x-1.5 bottom-5 space-y-0.5">
          <span className="block h-1 rounded-full bg-white/85" />
          <span className="mx-auto block h-1 w-4/5 rounded-full bg-white/85" />
          <span className="mx-auto block h-1 w-3/5 rounded-full bg-accent" />
        </div>
        <div className="absolute inset-x-1.5 bottom-2 h-px bg-white/15" />
      </div>
    </div>
  );
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
