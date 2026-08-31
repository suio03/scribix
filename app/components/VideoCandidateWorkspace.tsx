"use client";

import { useEffect, useState } from "react";
import { Check, Clock3, Loader2, RefreshCw, Sparkles, ThumbsDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type { StoredClipCandidate } from "@/lib/video-workspace/candidates";

type ProjectStatus = "draft" | "analyzing" | "candidates_ready" | "failed" | string;

export function VideoCandidateWorkspace({
  projectId,
  initialStatus,
  initialCandidates,
}: {
  projectId: string;
  initialStatus: ProjectStatus;
  initialCandidates: StoredClipCandidate[];
}) {
  const t = useTranslations("Dashboard.videoCandidates");
  const [status, setStatus] = useState<ProjectStatus>(initialStatus);
  const [candidates, setCandidates] = useState(initialCandidates);
  const [error, setError] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState<string | null>(null);
  const generating = status === "analyzing";

  useEffect(() => {
    if (!generating) return;
    const poll = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/video-projects/${projectId}/candidates`);
        if (!response.ok) return;
        const payload = (await response.json()) as {
          status?: string;
          candidates?: StoredClipCandidate[];
        };
        if (payload.status && payload.status !== "analyzing") {
          setStatus(payload.status);
          if (payload.candidates) setCandidates(payload.candidates);
        }
      } catch {
        // Polling is best effort; the active POST owns user-visible errors.
      }
    }, 3_000);
    return () => window.clearInterval(poll);
  }, [generating, projectId]);

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
      };
      if (!response.ok || !payload.candidates) throw new Error("candidate_generation_failed");
      setCandidates(payload.candidates);
      setStatus(payload.status ?? "candidates_ready");
    } catch {
      setStatus(candidates.length > 0 ? "candidates_ready" : "failed");
      setError(true);
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
      setCandidates((current) => current.map((candidate) =>
        candidate.id === candidateId ? { ...candidate, status: feedback } : candidate
      ));
    } catch {
      setError(true);
    } finally {
      setFeedbackBusy(null);
    }
  };

  return (
    <section className="mt-10">
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
        <button
          type="button"
          onClick={() => void generate()}
          disabled={generating}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-ink bg-ink px-4 py-2 text-[13px] font-medium text-paper transition hover:bg-accent disabled:cursor-wait disabled:border-ink/30 disabled:bg-ink/30"
        >
          {generating ? (
            <Loader2 size={15} className="animate-spin" />
          ) : candidates.length > 0 ? (
            <RefreshCw size={15} />
          ) : (
            <Sparkles size={15} />
          )}
          {generating
            ? t("generating")
            : candidates.length > 0
              ? t("regenerate")
              : t("generate")}
        </button>
      </div>

      {error ? (
        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          {t("requestFailed")}
        </p>
      ) : null}

      {generating ? <CandidateSkeleton label={t("analyzingBody")} /> : null}

      {!generating && candidates.length === 0 ? (
        <div className="mt-8 grid min-h-64 place-items-center rounded-2xl border border-dashed border-line bg-card/35 px-6 text-center">
          <div className="max-w-md py-12">
            <span className="mx-auto inline-grid size-11 place-items-center rounded-full border border-line bg-paper text-accent">
              <Sparkles size={18} />
            </span>
            <h3 className="mt-4 font-display text-xl font-semibold">{t("emptyTitle")}</h3>
            <p className="mt-2 text-[13px] leading-6 text-ink/55">{t("emptyBody")}</p>
          </div>
        </div>
      ) : null}

      {!generating && candidates.length > 0 ? (
        <div className="mt-8 space-y-4">
          {candidates.map((candidate, index) => (
            <CandidateCard
              key={candidate.id}
              candidate={candidate}
              displayRank={index + 1}
              busy={feedbackBusy === candidate.id}
              onFeedback={sendFeedback}
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
  candidate,
  displayRank,
  busy,
  onFeedback,
}: {
  candidate: StoredClipCandidate;
  displayRank: number;
  busy: boolean;
  onFeedback: (candidateId: string, feedback: "accepted" | "rejected") => Promise<void>;
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
    </article>
  );
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
