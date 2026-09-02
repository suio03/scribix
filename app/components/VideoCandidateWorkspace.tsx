"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Check,
  Clock3,
  Film,
  Loader2,
  RefreshCw,
  Scissors,
  Sparkles,
  ThumbsDown,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { VideoClipEditor } from "@/app/components/VideoClipEditor";
import type { StoredClipCandidate } from "@/lib/video-workspace/candidates";
import { VIDEO_WORKSPACE_LIMITS } from "@/lib/video-workspace/contracts";
import type { CandidatePreview } from "@/lib/video-workspace/preview-jobs";

type ProjectStatus = "draft" | "analyzing" | "candidates_ready" | "failed" | string;

export function VideoCandidateWorkspace({
  projectId,
  initialStatus,
  sourceDurationMs,
  initialCandidates,
  initialPreviews,
}: {
  projectId: string;
  initialStatus: ProjectStatus;
  sourceDurationMs: number | null;
  initialCandidates: StoredClipCandidate[];
  initialPreviews: CandidatePreview[];
}) {
  const t = useTranslations("Dashboard.videoCandidates");
  const [status, setStatus] = useState<ProjectStatus>(initialStatus);
  const [candidates, setCandidates] = useState(initialCandidates);
  const [previews, setPreviews] = useState(initialPreviews);
  const [error, setError] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState<string | null>(null);
  const [manualBusy, setManualBusy] = useState(false);
  const autoStartedRef = useRef(false);
  const generating = status === "analyzing";
  const shortSource = Boolean(
    sourceDurationMs &&
    sourceDurationMs <= VIDEO_WORKSPACE_LIMITS.directEditMaxSourceDurationMs
  );
  const manualCandidate = candidates.find((candidate) => candidate.origin === "manual") ?? null;
  const aiCandidates = candidates.filter((candidate) => candidate.origin === "ai");
  const previewsActive = previews.some((preview) => (
    preview.status === "queued" || preview.status === "processing"
  ));

  useEffect(() => {
    if (!generating) return;
    const poll = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/video-projects/${projectId}/candidates`);
        if (!response.ok) return;
        const payload = (await response.json()) as {
          status?: string;
          candidates?: StoredClipCandidate[];
          previews?: CandidatePreview[];
        };
        if (payload.status && payload.status !== "analyzing") {
          setStatus(payload.status);
          if (payload.candidates) setCandidates(payload.candidates);
          if (payload.previews) setPreviews(payload.previews);
        }
      } catch {
        // Polling is best effort; the active POST owns user-visible errors.
      }
    }, 3_000);
    return () => window.clearInterval(poll);
  }, [generating, projectId]);

  useEffect(() => {
    if (!previewsActive) return;
    const poll = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/video-projects/${projectId}/candidates`);
        if (!response.ok) return;
        const payload = (await response.json()) as { previews?: CandidatePreview[] };
        if (payload.previews) setPreviews(payload.previews);
      } catch {
        // Reconciliation continues server-side if this browser is closed.
      }
    }, 4_000);
    return () => window.clearInterval(poll);
  }, [previewsActive, projectId]);

  const generate = async () => {
    if (generating) return;
    if (candidates.length > 0 && !window.confirm(t("replaceConfirm"))) return;
    setStatus("analyzing");
    setError(false);
    try {
      const response = await fetch(`/api/video-projects/${projectId}/candidates`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        status?: string;
        candidates?: StoredClipCandidate[];
        previews?: CandidatePreview[];
      };
      if (!response.ok || !payload.candidates) throw new Error("candidate_generation_failed");
      setCandidates(payload.candidates);
      setPreviews(payload.previews ?? []);
      setStatus(payload.status ?? "candidates_ready");
    } catch {
      setStatus(candidates.length > 0 ? "candidates_ready" : "failed");
      setError(true);
    }
  };

  const startManualEdit = async () => {
    if (manualBusy || generating) return;
    if (candidates.length > 0 && !window.confirm(t("replaceConfirm"))) return;
    setManualBusy(true);
    setError(false);
    try {
      const response = await fetch(`/api/video-projects/${projectId}/candidates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "manual" }),
      });
      const payload = (await response.json()) as {
        status?: string;
        candidates?: StoredClipCandidate[];
        previews?: CandidatePreview[];
      };
      if (!response.ok || !payload.candidates?.some((candidate) => (
        candidate.origin === "manual"
      ))) {
        throw new Error("manual_editor_failed");
      }
      setCandidates(payload.candidates);
      setPreviews(payload.previews ?? []);
      setStatus(payload.status ?? "editing");
    } catch {
      setError(true);
    } finally {
      setManualBusy(false);
    }
  };

  const requestPreview = async (candidateId: string) => {
    if (previewBusy) return;
    setPreviewBusy(candidateId);
    setError(false);
    try {
      const response = await fetch(
        `/api/video-projects/${projectId}/candidates/${candidateId}/previews`,
        { method: "POST" }
      );
      const payload = (await response.json()) as { preview?: CandidatePreview | null };
      if (!response.ok || !payload.preview) throw new Error("preview_queue_failed");
      setPreviews((current) => [
        ...current.filter((preview) => preview.candidateId !== candidateId),
        payload.preview as CandidatePreview,
      ]);
    } catch {
      setError(true);
    } finally {
      setPreviewBusy(null);
    }
  };

  const sendFeedback = async (
    candidateId: string,
    feedback: "accepted" | "rejected"
  ) => {
    if (feedbackBusy) return;
    setFeedbackBusy(candidateId);
    setError(false);
    try {
      const response = await fetch(
        `/api/video-projects/${projectId}/candidates/${candidateId}/feedback`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ feedback }),
        }
      );
      if (!response.ok) throw new Error("feedback_failed");
      setCandidates((current) => current.map((candidate) => {
        if (candidate.id === candidateId) return { ...candidate, status: feedback };
        if (feedback === "accepted" && candidate.status === "accepted") {
          return { ...candidate, status: "suggested" };
        }
        return candidate;
      }));
    } catch {
      setError(true);
    } finally {
      setFeedbackBusy(null);
    }
  };

  useEffect(() => {
    if (
      autoStartedRef.current || status !== "draft" || candidates.length > 0 ||
      generating || manualBusy
    ) return;
    autoStartedRef.current = true;
    void (shortSource ? startManualEdit() : generate());
  }, [candidates.length, generating, manualBusy, shortSource, status]);

  return (
    <section id="clips" className="mt-10 scroll-mt-6">
      <div className="flex flex-col justify-between gap-5 border-b border-line pb-6 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
            {t("eyebrow")}
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
            {t("shortlistTitle")}
          </h2>
          <p className="mt-2 text-[14px] leading-6 text-ink/60">
            {t("description")}
          </p>
        </div>
        {!manualCandidate || !shortSource ? (
          <button
            type="button"
            onClick={() => void (shortSource ? startManualEdit() : generate())}
            disabled={generating || manualBusy}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-ink bg-ink px-4 py-2 text-[13px] font-medium text-paper transition hover:bg-accent disabled:cursor-wait disabled:border-ink/30 disabled:bg-ink/30"
          >
            {generating || manualBusy ? (
              <Loader2 size={15} className="animate-spin" />
            ) : candidates.length > 0 ? (
              <RefreshCw size={15} />
            ) : shortSource ? (
              <Scissors size={15} />
            ) : (
              <Sparkles size={15} />
            )}
            {generating
              ? t("generating")
              : manualBusy
                ? t("directEditing")
                : shortSource
                  ? t("directEdit")
                  : candidates.length > 0
                    ? t("regenerate")
                    : t("generate")}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          {t("requestFailed")}
        </p>
      ) : null}

      {generating ? <CandidateSkeleton label={t("analyzingBody")} /> : null}

      {!generating && !manualCandidate && aiCandidates.length === 0 ? (
        <div className="mt-8 grid min-h-64 place-items-center rounded-2xl border border-dashed border-line bg-card/35 px-6 text-center">
          <div className="max-w-md py-12">
            <span className="mx-auto inline-grid size-11 place-items-center rounded-full border border-line bg-paper text-accent">
              <Sparkles size={18} />
            </span>
            <h3 className="mt-4 font-display text-xl font-semibold">
              {status === "candidates_ready" ? t("noQualityTitle") : t("emptyTitle")}
            </h3>
            <p className="mt-2 text-[13px] leading-6 text-ink/55">
              {status === "candidates_ready"
                ? t("noQualityBody")
                : shortSource
                  ? t("shortSourceBody")
                  : t("emptyBody")}
            </p>
            {status === "candidates_ready" && !shortSource ? (
              <button
                type="button"
                onClick={() => void startManualEdit()}
                disabled={manualBusy}
                className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-paper transition hover:bg-accent disabled:opacity-40"
              >
                {manualBusy ? <Loader2 size={14} className="animate-spin" /> : <Scissors size={14} />}
                {manualBusy ? t("directEditing") : t("directEdit")}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!generating && manualCandidate ? (
        <div className="mt-8 overflow-hidden rounded-2xl border border-line bg-card">
          <div className="px-5 py-5 sm:px-7">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
              {t("manualEyebrow")}
            </p>
            <h3 className="mt-2 font-display text-xl font-semibold">{t("manualTitle")}</h3>
            <p className="mt-2 text-[13px] leading-6 text-ink/55">{t("manualBody")}</p>
          </div>
          <VideoClipEditor projectId={projectId} candidateId={manualCandidate.id} />
        </div>
      ) : null}

      {!generating && aiCandidates.length > 0 ? (
        <div className="mt-8 space-y-4">
          {aiCandidates.map((candidate, index) => (
            <CandidateCard
              key={candidate.id}
              projectId={projectId}
              candidate={candidate}
              displayRank={index + 1}
              busy={feedbackBusy === candidate.id}
              previewBusy={previewBusy === candidate.id}
              preview={previews.find((preview) => preview.candidateId === candidate.id) ?? null}
              onFeedback={sendFeedback}
              onRequestPreview={requestPreview}
            />
          ))}
          <p className="px-1 pt-2 text-[12px] leading-5 text-ink/45">
            {t("previewPending")}
          </p>
        </div>
      ) : null}
    </section>
  );
}

function CandidateCard({
  projectId,
  candidate,
  displayRank,
  busy,
  previewBusy,
  preview,
  onFeedback,
  onRequestPreview,
}: {
  projectId: string;
  candidate: StoredClipCandidate;
  displayRank: number;
  busy: boolean;
  previewBusy: boolean;
  preview: CandidatePreview | null;
  onFeedback: (candidateId: string, feedback: "accepted" | "rejected") => Promise<void>;
  onRequestPreview: (candidateId: string) => Promise<void>;
}) {
  const t = useTranslations("Dashboard.videoCandidates");
  const durationMs = candidate.segments.reduce(
    (total, segment) => total + segment.endMs - segment.startMs,
    0
  );
  const accepted = candidate.status === "accepted";
  const rejected = candidate.status === "rejected";

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-line bg-card transition hover:border-ink/25 hover:shadow-[0_18px_60px_-42px_rgba(14,13,11,0.65)]">
      <div className="grid md:grid-cols-[104px_minmax(0,1fr)_190px]">
        <div className="flex items-center justify-between border-b border-line bg-ink/[0.025] px-5 py-4 md:block md:border-b-0 md:border-r md:px-6 md:py-6">
          <span className="font-display text-4xl font-semibold tabular-nums text-ink/15 transition group-hover:text-accent/40">
            {String(displayRank).padStart(2, "0")}
          </span>
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/45 md:mt-8">
            <Clock3 size={12} />
            {formatDuration(durationMs)}
          </div>
        </div>

        <div className="min-w-0 px-5 py-5 sm:px-7 sm:py-6">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-xl font-semibold tracking-tight text-ink">
              {candidate.theme}
            </h3>
            <span className="rounded-full border border-line px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink/45">
              {t("score", { score: Math.round(candidate.score * 100) })}
            </span>
          </div>
          <p className="mt-3 border-l-2 border-accent/45 pl-3 text-[14px] font-medium leading-6 text-ink/80">
            “{candidate.hook}”
          </p>
          <p className="mt-4 text-[13px] leading-6 text-ink/55">{candidate.reason}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {candidate.segments.map((segment, index) => (
              <span
                key={`${segment.startMs}-${segment.endMs}-${index}`}
                className="rounded-md bg-ink/[0.045] px-2 py-1 font-mono text-[10px] tabular-nums text-ink/55"
              >
                {formatTimestamp(segment.startMs)}–{formatTimestamp(segment.endMs)}
              </span>
            ))}
          </div>
          <PreviewPanel
            projectId={projectId}
            candidateId={candidate.id}
            preview={preview}
            busy={previewBusy}
            onRequest={onRequestPreview}
          />
        </div>

        <div className="flex items-center gap-2 border-t border-line px-5 py-4 md:flex-col md:items-stretch md:justify-center md:border-l md:border-t-0 md:px-5">
          <button
            type="button"
            onClick={() => void onFeedback(candidate.id, "accepted")}
            disabled={busy}
            aria-pressed={accepted}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium transition disabled:opacity-50 ${
              accepted
                ? "bg-emerald-700 text-white"
                : "bg-ink text-paper hover:bg-accent"
            }`}
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            {accepted ? t("accepted") : t("accept")}
          </button>
          <button
            type="button"
            onClick={() => void onFeedback(candidate.id, "rejected")}
            disabled={busy}
            aria-pressed={rejected}
            className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[12px] font-medium transition disabled:opacity-50 ${
              rejected
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-line text-ink/55 hover:border-red-200 hover:bg-red-50 hover:text-red-700"
            }`}
          >
            <ThumbsDown size={13} />
            {rejected ? t("rejected") : t("reject")}
          </button>
        </div>
      </div>
      {accepted ? (
        <VideoClipEditor projectId={projectId} candidateId={candidate.id} />
      ) : null}
    </article>
  );
}

function PreviewPanel({
  projectId,
  candidateId,
  preview,
  busy,
  onRequest,
}: {
  projectId: string;
  candidateId: string;
  preview: CandidatePreview | null;
  busy: boolean;
  onRequest: (candidateId: string) => Promise<void>;
}) {
  const t = useTranslations("Dashboard.videoCandidates");
  if (preview?.status === "ready") {
    return <ReadyPreview projectId={projectId} candidateId={candidateId} />;
  }
  const processing = preview?.status === "queued" || preview?.status === "processing";
  const failed = preview?.status === "failed";
  return (
    <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-line bg-paper/70 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2.5 text-[12px] text-ink/55">
        {processing ? (
          <Loader2 size={14} className="shrink-0 animate-spin text-accent" />
        ) : failed ? (
          <AlertCircle size={14} className="shrink-0 text-red-600" />
        ) : (
          <Film size={14} className="shrink-0 text-accent" />
        )}
        <span>{processing ? t("previewProcessing") : failed ? t("previewFailed") : t("previewNotReady")}</span>
      </div>
      {!processing ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void onRequest(candidateId)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ink/15 bg-card px-3 py-1.5 text-[11px] font-medium text-ink transition hover:border-ink/35 disabled:opacity-50"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Film size={12} />}
          {failed ? t("previewRetry") : t("previewPrepare")}
        </button>
      ) : null}
    </div>
  );
}

function ReadyPreview({
  projectId,
  candidateId,
}: {
  projectId: string;
  candidateId: string;
}) {
  const t = useTranslations("Dashboard.videoCandidates");
  const [segments, setSegments] = useState<Array<{
    segmentIndex: number;
    url: string | null;
  }> | null>(null);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    fetchCandidatePreview(projectId, candidateId)
      .then((next) => {
        if (active) setSegments(next);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [candidateId, projectId, reload]);

  if (failed) {
    return (
      <div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] text-red-700">
        <span>{t("previewUnavailable")}</span>
        <button
          type="button"
          onClick={() => {
            setFailed(false);
            setSegments(null);
            setReload((value) => value + 1);
          }}
          className="shrink-0 font-medium underline decoration-red-300 underline-offset-4"
        >
          {t("previewRetry")}
        </button>
      </div>
    );
  }
  if (!segments) {
    return (
      <div className="mt-5 flex items-center gap-2 text-[12px] text-ink/45">
        <Loader2 size={13} className="animate-spin" />
        {t("previewLoading")}
      </div>
    );
  }
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2">
      {segments.map((segment) => segment.url ? (
        <figure key={segment.segmentIndex} className="overflow-hidden rounded-xl border border-line bg-ink">
          <video
            controls
            preload="metadata"
            playsInline
            src={segment.url}
            className="aspect-video w-full bg-black object-contain"
          />
          <figcaption className="bg-ink px-3 py-2 font-mono text-[9px] uppercase tracking-[0.12em] text-paper/55">
            {t("previewSegment", { number: segment.segmentIndex + 1 })}
          </figcaption>
        </figure>
      ) : null)}
    </div>
  );
}

async function fetchCandidatePreview(projectId: string, candidateId: string): Promise<Array<{
  segmentIndex: number;
  url: string | null;
}>> {
  const response = await fetch(
    `/api/video-projects/${projectId}/candidates/${candidateId}/previews`
  );
  if (!response.ok) throw new Error("preview_fetch_failed");
  const payload = await response.json() as {
    segments?: Array<{ segmentIndex: number; url: string | null }>;
  };
  const segments = payload.segments ?? [];
  if (segments.length === 0 || segments.some((segment) => !segment.url)) {
    throw new Error("preview_url_missing");
  }
  return segments;
}

function CandidateSkeleton({ label }: { label: string }) {
  return (
    <div className="mt-8 overflow-hidden rounded-2xl border border-line bg-card">
      <div className="grid min-h-56 place-items-center bg-[linear-gradient(90deg,transparent,rgba(14,13,11,0.025),transparent)] px-6 text-center">
        <div>
          <Loader2 className="mx-auto animate-spin text-accent" size={22} />
          <p className="mt-4 text-[13px] text-ink/55">{label}</p>
        </div>
      </div>
    </div>
  );
}

function formatDuration(durationMs: number): string {
  return `${Math.round(durationMs / 1000)}s`;
}

function formatTimestamp(valueMs: number): string {
  const seconds = Math.floor(valueMs / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${minutes.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`
    : `${minutes}:${remainder.toString().padStart(2, "0")}`;
}
