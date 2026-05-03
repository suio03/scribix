import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { Link } from "@/i18n/navigation";
import { redirect } from "@/i18n/navigation";
import { cf } from "@/lib/cf";
import type { AaiTranscript } from "@/lib/aai";

type Params = { params: Promise<{ locale: string; id: string }> };

export default async function TranscriptViewerPage({ params }: Params) {
  const { locale, id } = await params;
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    redirect({ href: "/", locale });
  }
  const env = cf();

  const row = await env.DB.prepare(
    `SELECT id, user_id, title, status, error, duration_sec, language,
            created_at, completed_at, transcript_r2_key
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
    }>();
  if (!row) notFound();
  if (row.user_id !== userId) notFound();

  let aai: AaiTranscript | null = null;
  if (row.status === "completed" && row.transcript_r2_key) {
    const obj = await env.SCRIBIX_MEDIA.get(row.transcript_r2_key);
    if (obj) aai = (await obj.json()) as AaiTranscript;
  }

  return (
    <main className="mx-auto max-w-[820px] px-4 py-12 sm:px-8">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/dashboard"
          className="text-[13px] text-ink/60 hover:text-ink"
        >
          ← All transcripts
        </Link>
        {row.status === "completed" && (
          <div className="flex items-center gap-2">
            <a
              href={`/api/transcripts/${row.id}/export?format=txt`}
              className="rounded-full border border-line px-3.5 py-1.5 text-[13px] font-medium hover:bg-ink/5"
            >
              TXT
            </a>
            <a
              href={`/api/transcripts/${row.id}/export?format=srt`}
              className="rounded-full border border-line px-3.5 py-1.5 text-[13px] font-medium hover:bg-ink/5"
            >
              SRT
            </a>
            <a
              href={`/api/transcripts/${row.id}/export?format=vtt`}
              className="rounded-full border border-line px-3.5 py-1.5 text-[13px] font-medium hover:bg-ink/5"
            >
              VTT
            </a>
          </div>
        )}
      </div>

      <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">{row.title}</h1>
      <p className="mt-1 text-sm text-ink/60">
        {metaLine(row)}
      </p>

      {row.status === "completed" && audioExpired(row.created_at) ? (
        <div className="mt-6 rounded-2xl border border-line bg-card/60 px-4 py-3 text-[13px] text-ink/70">
          <span className="font-medium text-ink">Audio expired.</span> Source files are kept
          for 7 days; the transcript stays as long as you want.
        </div>
      ) : null}

      <div className="mt-10">
        {row.status !== "completed" ? (
          <StatusPanel status={row.status} error={row.error} />
        ) : aai ? (
          <TranscriptBody aai={aai} />
        ) : (
          <p className="text-sm text-ink/60">Transcript file is missing from storage.</p>
        )}
      </div>
    </main>
  );
}

const AUDIO_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function audioExpired(createdAt: string): boolean {
  const t = new Date(createdAt.includes("T") ? createdAt : createdAt.replace(" ", "T") + "Z").getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t > AUDIO_TTL_MS;
}

function metaLine(row: { duration_sec: number | null; language: string | null; status: string }) {
  const parts: string[] = [];
  if (row.duration_sec) parts.push(formatDuration(row.duration_sec));
  if (row.language) parts.push(row.language.toUpperCase());
  parts.push(row.status === "completed" ? "Completed" : capitalize(row.status));
  return parts.join(" · ");
}

function StatusPanel({ status, error }: { status: string; error: string | null }) {
  if (status === "error") {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        <p className="font-medium">Transcription failed.</p>
        {error && <p className="mt-1 text-red-700/80">{error}</p>}
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-dashed border-line p-12 text-center">
      <p className="text-sm text-ink/60">
        {status === "queued" || status === "processing"
          ? "Transcribing your audio. This usually takes about a minute per hour of input."
          : "Working on your transcript…"}
      </p>
    </div>
  );
}

function TranscriptBody({ aai }: { aai: AaiTranscript }) {
  if (aai.utterances && aai.utterances.length > 0) {
    return (
      <div className="space-y-6">
        {aai.utterances.map((u, i) => (
          <div key={i}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-ink/50">
              Speaker {u.speaker}
            </p>
            <p className="mt-1 text-base leading-relaxed">{u.text}</p>
          </div>
        ))}
      </div>
    );
  }
  return (
    <p className="whitespace-pre-wrap text-base leading-relaxed">
      {aai.text ?? ""}
    </p>
  );
}

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
