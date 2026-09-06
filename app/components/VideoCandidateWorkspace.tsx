"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  Check,
  Clock3,
  Film,
  LockKeyhole,
  Loader2,
  Play,
  Scissors,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { VideoExportProvider } from "@/app/components/VideoExportProvider";
import { FinalRenderPanel } from "@/app/components/FinalRenderPanel";
import {
  VideoClipEditor,
  type VideoEditorSaveState,
} from "@/app/components/VideoClipEditor";
import { Link } from "@/i18n/navigation";
import type { StoredClipCandidate } from "@/lib/video-workspace/candidates";
import { VIDEO_WORKSPACE_LIMITS } from "@/lib/video-workspace/contracts";
import type { CandidatePreview } from "@/lib/video-workspace/preview-jobs";
import type { FinalRenderSummary } from "@/lib/video-workspace/final-jobs";

type ProjectStatus = "draft" | "analyzing" | "candidates_ready" | "failed" | string;

export function VideoCandidateWorkspace(props: ComponentProps<typeof VideoCandidateWorkspaceContent>) {
  return (
    <VideoExportProvider key={props.projectId} projectId={props.projectId} initialRenders={props.initialRenders}>
      <VideoCandidateWorkspaceContent {...props} />
    </VideoExportProvider>
  );
}

function VideoCandidateWorkspaceContent({
  projectId,
  initialStatus,
  sourceDurationMs,
  initialCandidates,
  initialPreviews,
  initialSelectedCandidateId,
  initialRenders,
  sourceAvailable,
  canEdit,
}: {
  projectId: string;
  initialStatus: ProjectStatus;
  sourceDurationMs: number | null;
  initialCandidates: StoredClipCandidate[];
  initialPreviews: CandidatePreview[];
  initialSelectedCandidateId: string | null;
  initialRenders: FinalRenderSummary[];
  sourceAvailable: boolean;
  sourceExpiresAt: string | null;
  canEdit: boolean;
}) {
  const t = useTranslations("Dashboard.videoCandidates");
  const [status, setStatus] = useState<ProjectStatus>(initialStatus);
  const [candidates, setCandidates] = useState(initialCandidates);
  const [previews, setPreviews] = useState(initialPreviews);
  const [selectedCandidateId, setSelectedCandidateId] = useState(() => (
    initialCandidates.some((candidate) => candidate.id === initialSelectedCandidateId)
      ? initialSelectedCandidateId
      : initialCandidates[0]?.id ?? null
  ));
  const [pendingCandidateId, setPendingCandidateId] = useState<string | null>(null);
  const [editorSaveState, setEditorSaveState] = useState<VideoEditorSaveState>("saved");
  const [error, setError] = useState(false);
  const [previewBusy, setPreviewBusy] = useState<string | null>(null);
  const [manualBusy, setManualBusy] = useState(false);
  const [candidateToDelete, setCandidateToDelete] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const autoStartedRef = useRef(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const generating = sourceAvailable && status === "analyzing";
  const shortSource = Boolean(
    canEdit && sourceDurationMs &&
    sourceDurationMs <= VIDEO_WORKSPACE_LIMITS.directEditMaxSourceDurationMs
  );
  const selectedCandidate = candidates.find((candidate) => (
    candidate.id === selectedCandidateId
  )) ?? null;
  const hasManualCandidate = candidates.some((candidate) => candidate.origin === "manual");
  const previewsActive = previews.some((preview) => (
    preview.status === "queued" || preview.status === "processing"
  ));

  const deleteCustomClip = async () => {
    if (!candidateToDelete || deleteBusy) return;
    setDeleteBusy(true);
    setError(false);
    try {
      const response = await fetch(
        `/api/video-projects/${projectId}/candidates/${candidateToDelete}`,
        { method: "DELETE" }
      );
      const payload = await response.json() as { candidates?: StoredClipCandidate[] };
      if (!response.ok || !payload.candidates) throw new Error("candidate_delete_failed");
      const nextCandidates = payload.candidates;
      setCandidates(nextCandidates);
      setPreviews((current) => current.filter((preview) => (
        preview.candidateId !== candidateToDelete
      )));
      setSelectedCandidateId(nextCandidates[0]?.id ?? null);
      setPendingCandidateId(null);
      setEditorSaveState("saved");
      setCandidateToDelete(null);
    } catch {
      setError(true);
    } finally {
      setDeleteBusy(false);
    }
  };

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

  useEffect(() => {
    if (candidates.length === 0) {
      setSelectedCandidateId(null);
      return;
    }
    if (!candidates.some((candidate) => candidate.id === selectedCandidateId)) {
      setSelectedCandidateId(candidates[0].id);
    }
  }, [candidates, selectedCandidateId]);

  useEffect(() => {
    if (sourceAvailable) return;
    const exportedCandidateIds = new Set(initialRenders.flatMap((render) => (
      render.status === "completed" && render.videoUrl && render.candidateId
        ? [render.candidateId]
        : []
    )));
    setCandidates((current) => current.filter((candidate) => (
      exportedCandidateIds.has(candidate.id)
    )));
    setPreviews([]);
  }, [initialRenders, sourceAvailable]);

  useEffect(() => {
    if (!pendingCandidateId || editorSaveState !== "saved") return;
    setSelectedCandidateId(pendingCandidateId);
    setPendingCandidateId(null);
  }, [editorSaveState, pendingCandidateId]);

  const replaceWorkspace = (
    nextCandidates: StoredClipCandidate[],
    nextPreviews: CandidatePreview[],
    nextStatus: string
  ) => {
    setCandidates(nextCandidates);
    setPreviews(nextPreviews);
    setStatus(nextStatus);
    setSelectedCandidateId(nextCandidates[0]?.id ?? null);
    setPendingCandidateId(null);
    setEditorSaveState("saved");
  };

  const generate = async () => {
    if (generating) return;
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
      replaceWorkspace(
        payload.candidates,
        payload.previews ?? [],
        payload.status ?? "candidates_ready"
      );
    } catch {
      setStatus(candidates.length > 0 ? "candidates_ready" : "failed");
      setError(true);
    }
  };

  const startManualEdit = async () => {
    if (manualBusy || generating) return;
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
        candidateId?: string;
      };
      if (!response.ok || !payload.candidates?.some((candidate) => (
        candidate.origin === "manual"
      ))) {
        throw new Error("manual_editor_failed");
      }
      replaceWorkspace(
        payload.candidates,
        payload.previews ?? [],
        payload.status ?? "editing"
      );
      if (payload.candidateId) setSelectedCandidateId(payload.candidateId);
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

  const selectCandidate = (candidateId: string) => {
    if (candidateId === selectedCandidateId) {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (editorSaveState === "dirty" || editorSaveState === "saving") {
      setPendingCandidateId(candidateId);
      return;
    }
    setSelectedCandidateId(candidateId);
    setPendingCandidateId(null);
    window.requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  useEffect(() => {
    if (
      !sourceAvailable || autoStartedRef.current || status !== "draft" || candidates.length > 0 ||
      generating || manualBusy
    ) return;
    autoStartedRef.current = true;
    void (shortSource ? startManualEdit() : generate());
  }, [candidates.length, generating, manualBusy, shortSource, sourceAvailable, status]);

  return (
    <section id="clips" className="mt-9 scroll-mt-6">
      <div className="flex flex-col justify-between gap-5 border-b border-line pb-6 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-accent">
            {t("eyebrow")}
          </p>
          <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
            {t("shortlistTitle")}
          </h2>
          <p className="mt-2 text-[14px] leading-6 text-ink/60">
            {t(!sourceAvailable
              ? "archivedDescription"
              : canEdit
                ? "description"
                : "descriptionFree")}
          </p>
        </div>
        {sourceAvailable && candidates.length > 0 ? (
          canEdit && !hasManualCandidate ? (
            <button
              type="button"
              onClick={() => void startManualEdit()}
              disabled={manualBusy}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-[12px] font-medium text-ink transition hover:border-ink/35 hover:bg-ink hover:text-paper disabled:cursor-wait disabled:opacity-40"
            >
              {manualBusy ? <Loader2 size={14} className="animate-spin" /> : <Scissors size={14} />}
              {manualBusy ? t("directEditing") : t("createCustomClip")}
            </button>
          ) : null
        ) : status === "failed" ? (
          <button
            type="button"
            onClick={() => void generate()}
            disabled={generating}
            className="inline-flex w-fit items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-[12px] font-medium text-ink transition hover:border-ink/35 hover:bg-ink hover:text-paper disabled:cursor-wait disabled:opacity-40"
          >
            {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {generating ? t("generating") : t("tryAgain")}
          </button>
        ) : null}
      </div>

      {!sourceAvailable ? (
        <div className="mt-5 flex items-center gap-2 rounded-xl border border-amber-300/35 bg-amber-100/35 px-4 py-3 text-xs text-amber-900 dark:bg-amber-400/10 dark:text-amber-100">
          <Archive size={14} />
          <span>{t("sourceUnavailableBody")}</span>
        </div>
      ) : null}

      {error ? (
        <p className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          {t("requestFailed")}
        </p>
      ) : null}

      {generating ? <CandidateSkeleton label={t("analyzingBody")} /> : null}

      {!sourceAvailable && candidates.length === 0 ? (
        <div className="mt-8 grid min-h-64 place-items-center rounded-2xl border border-dashed border-line bg-card/35 px-6 text-center">
          <div className="max-w-md py-12">
            <span className="mx-auto inline-grid size-11 place-items-center rounded-full border border-line bg-paper text-muted">
              <Archive size={18} />
            </span>
            <h3 className="mt-4 font-display text-xl font-semibold">{t("sourceUnavailableTitle")}</h3>
            <p className="mt-2 text-[13px] leading-6 text-ink/55">{t("sourceUnavailableEmpty")}</p>
          </div>
        </div>
      ) : null}

      {sourceAvailable && !generating && candidates.length === 0 ? (
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
                ? t(canEdit ? "noQualityBody" : "noQualityBodyFree")
                : shortSource
                  ? t("shortSourceBody")
                  : t("emptyBody")}
            </p>
            {canEdit && status === "candidates_ready" ? (
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

      {!generating && candidates.length > 0 ? (
        <>
          <div
            role="listbox"
            aria-label={t("shortlistTitle")}
            className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5"
          >
            {candidates.map((candidate, index) => {
              const preview = previews.find((item) => item.candidateId === candidate.id) ?? null;
              return (
                <CandidateTile
                  key={candidate.id}
                  projectId={projectId}
                  candidate={candidate}
                  number={index + 1}
                  selected={candidate.id === selectedCandidateId}
                  pending={candidate.id === pendingCandidateId}
                  preview={preview}
                  previewBusy={candidate.id === previewBusy}
                  sourceAvailable={sourceAvailable}
                  coverUrl={initialRenders.find((render) => (
                    render.candidateId === candidate.id && render.videoUrl
                  ))?.coverUrl ?? null}
                  onSelect={selectCandidate}
                  onRequestPreview={requestPreview}
                  onDelete={candidate.origin === "manual"
                    ? () => setCandidateToDelete(candidate.id)
                    : undefined}
                />
              );
            })}
          </div>
          {sourceAvailable ? (
            <p className="mt-3 text-[11px] leading-5 text-ink/45">
              {t("previewPending")}
            </p>
          ) : null}
        </>
      ) : null}

      {selectedCandidate ? (
        <div ref={editorRef} className="mt-8 scroll-mt-6 overflow-hidden rounded-2xl border border-line bg-card shadow-[0_28px_80px_-56px_rgba(14,13,11,0.7)]">
          {!sourceAvailable ? (
            <ArchivedClipExport
              projectId={projectId}
              candidate={selectedCandidate}
              onExportDeleted={() => setCandidates((current) => (
                current.filter((candidate) => candidate.id !== selectedCandidate.id)
              ))}
            />
          ) : canEdit ? (
            <VideoClipEditor
              key={selectedCandidate.id}
              projectId={projectId}
              candidateId={selectedCandidate.id}
              onSaveStateChange={setEditorSaveState}
              onTitleChange={(title) => setCandidates((current) => current.map((candidate) => (
                candidate.id === selectedCandidate.id ? { ...candidate, theme: title } : candidate
              )))}
            />
          ) : (
            <FreeCandidateExport
              key={selectedCandidate.id}
              projectId={projectId}
              candidate={selectedCandidate}
            />
          )}
        </div>
      ) : null}
      {candidateToDelete ? (
        <div
          className="surface-modal-backdrop fixed inset-0 z-[70] flex items-center justify-center bg-ink/45 px-4 py-6 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deleteBusy) setCandidateToDelete(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-custom-clip-title"
            className="surface-modal w-full max-w-[420px] overflow-hidden rounded-xl border border-line bg-card shadow-2xl shadow-ink/20"
          >
            <div className="flex items-start gap-3 border-b border-line bg-paper/70 px-5 py-4">
              <span className="mt-0.5 inline-grid size-9 shrink-0 place-items-center rounded-full bg-red-500/10 text-red-600">
                <AlertTriangle size={18} strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="delete-custom-clip-title" className="text-[15px] font-semibold text-ink">
                  {t("deleteCustomTitle")}
                </h2>
                <p className="mt-1 text-[13px] leading-5 text-muted">{t("deleteCustomBody")}</p>
              </div>
              <button
                type="button"
                onClick={() => setCandidateToDelete(null)}
                disabled={deleteBusy}
                aria-label={t("deleteCustomCancel")}
                className="inline-grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-ink/5 hover:text-ink disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col-reverse gap-2 px-5 py-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setCandidateToDelete(null)}
                disabled={deleteBusy}
                className="rounded-full border border-line px-4 py-2 text-[13px] font-medium text-ink transition hover:bg-ink/5 disabled:opacity-50"
              >
                {t("deleteCustomCancel")}
              </button>
              <button
                type="button"
                onClick={() => void deleteCustomClip()}
                disabled={deleteBusy}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {deleteBusy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {deleteBusy ? t("deletingCustom") : t("deleteCustomConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ArchivedClipExport({
  projectId,
  candidate,
  onExportDeleted,
}: {
  projectId: string;
  candidate: StoredClipCandidate;
  onExportDeleted: () => void;
}) {
  const t = useTranslations("Dashboard.videoCandidates");
  return (
    <section className="grid gap-6 px-5 py-6 sm:px-7 sm:py-7 lg:grid-cols-[minmax(0,0.88fr)_minmax(320px,1.12fr)]">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
          {t("sourceUnavailableEyebrow")}
        </p>
        <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
          {candidate.origin === "manual" ? t("manualTitle") : candidate.theme}
        </h3>
        <p className="mt-2 text-[13px] leading-6 text-ink/60">{t("archivedClipBody")}</p>
      </div>
      <FinalRenderPanel
        projectId={projectId}
        candidateId={candidate.id}
        revision={0}
        disabled
        generatedOnly
        sourceAvailable={false}
        onConflict={() => undefined}
        onExportDeleted={onExportDeleted}
      />
    </section>
  );
}

function FreeCandidateExport({
  projectId,
  candidate,
}: {
  projectId: string;
  candidate: StoredClipCandidate;
}) {
  const t = useTranslations("Dashboard.videoCandidates.freeExport");

  return (
    <section className="grid gap-6 px-5 py-6 sm:px-7 sm:py-7 lg:grid-cols-[minmax(0,0.88fr)_minmax(320px,1.12fr)]">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-accent">
          {t("eyebrow")}
        </p>
        <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
          {t("title")}
        </h3>
        <p className="mt-2 text-[13px] leading-6 text-ink/60">{t("body")}</p>

        <div className="mt-5 rounded-xl border border-line bg-paper/60 p-4">
          <p className="text-[12px] font-semibold text-ink">{candidate.theme}</p>
          <p className="mt-2 text-[11px] leading-5 text-ink/50">{t("included")}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-accent/25 bg-accent/[0.055] p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
              <LockKeyhole size={14} />
            </span>
            <div>
              <p className="text-[12px] font-semibold text-ink">{t("lockedTitle")}</p>
              <p className="mt-1 text-[11px] leading-5 text-ink/55">{t("lockedBody")}</p>
              <Link
                href="/pricing"
                className="mt-3 inline-flex rounded-full bg-accent px-4 py-2 text-[11px] font-semibold text-white transition hover:bg-ink"
              >
                {t("upgrade")}
              </Link>
            </div>
          </div>
        </div>

        <FinalRenderPanel
          projectId={projectId}
          candidateId={candidate.id}
          revision={0}
          disabled={false}
          generatedOnly
          onConflict={() => undefined}
        />
      </div>
    </section>
  );
}

function CandidateTile({
  projectId,
  candidate,
  number,
  selected,
  pending,
  preview,
  previewBusy,
  sourceAvailable,
  coverUrl,
  onSelect,
  onRequestPreview,
  onDelete,
}: {
  projectId: string;
  candidate: StoredClipCandidate;
  number: number;
  selected: boolean;
  pending: boolean;
  preview: CandidatePreview | null;
  previewBusy: boolean;
  sourceAvailable: boolean;
  coverUrl: string | null;
  onSelect: (candidateId: string) => void;
  onRequestPreview: (candidateId: string) => Promise<void>;
  onDelete?: () => void;
}) {
  const t = useTranslations("Dashboard.videoCandidates");
  const durationMs = candidate.segments.reduce(
    (total, segment) => total + segment.endMs - segment.startMs,
    0
  );
  const queued = preview?.status === "queued";
  const processing = preview?.status === "processing";
  const failed = preview?.status === "failed";

  return (
    <div className="group relative min-w-0">
      <button
        type="button"
        role="option"
        aria-selected={selected}
        onClick={() => onSelect(candidate.id)}
        className={`w-full overflow-hidden rounded-xl border bg-card text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 ${
          selected
            ? "border-accent shadow-[0_12px_36px_-24px_rgba(108,53,255,0.9)]"
            : "border-line hover:-translate-y-0.5 hover:border-ink/30"
        }`}
      >
        <div className="fixed-media-surface relative aspect-video overflow-hidden bg-ink">
          {coverUrl ? (
            <div
              aria-hidden
              className="absolute inset-0 bg-cover bg-center opacity-85 transition duration-300 group-hover:scale-[1.02] group-hover:opacity-100"
              style={{ backgroundImage: `url(${JSON.stringify(coverUrl).slice(1, -1)})` }}
            />
          ) : preview?.status === "ready" ? (
            <CandidatePreviewFrame projectId={projectId} candidateId={candidate.id} />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_35%,rgba(108,53,255,0.32),transparent_38%),linear-gradient(145deg,#201641,#09031b)] text-paper/45">
              {queued ? (
                <Clock3 size={20} />
              ) : processing || previewBusy ? (
                <Loader2 size={20} className="animate-spin" />
              ) : failed ? (
                <AlertCircle size={20} />
              ) : (
                <Film size={20} />
              )}
            </div>
          )}
          <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.08em] text-white/80 backdrop-blur">
            {candidate.origin === "manual" ? t("manualEyebrow") : t("clipLabel", { number })}
          </span>
          {selected ? (
            <span className={`absolute top-2 inline-flex size-6 items-center justify-center rounded-full bg-accent text-white shadow ${onDelete ? "right-10" : "right-2"}`}>
              <Check size={13} strokeWidth={2.5} />
            </span>
          ) : (
            <span className="absolute inset-0 m-auto grid size-9 place-items-center rounded-full border border-white/25 bg-black/45 text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
              <Play size={14} fill="currentColor" className="translate-x-px" />
            </span>
          )}
        </div>
        <div className="min-w-0 p-3">
          <p className="line-clamp-2 min-h-10 text-[12px] font-semibold leading-5 text-ink">
            {candidate.origin === "manual" ? t("manualTitle") : candidate.theme}
          </p>
          <span className="mt-2 flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.08em] text-ink/45">
            {pending ? (
              <><Loader2 size={10} className="animate-spin" />{t("editor.saveState.saving")}</>
            ) : queued ? (
              <><Clock3 size={10} />{t("editor.finalRender.status.queued")}</>
            ) : processing || previewBusy ? (
              <><Loader2 size={10} className="animate-spin" />{t("previewProcessing")}</>
            ) : failed ? (
              <><AlertCircle size={10} />{t("previewFailed")}</>
            ) : (
              <><Clock3 size={10} />{formatDuration(durationMs)}</>
            )}
          </span>
        </div>
      </button>
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          aria-label={t("deleteCustom")}
          title={t("deleteCustom")}
          className="absolute right-2 top-2 inline-grid size-6 place-items-center rounded-full bg-black/65 text-white/70 backdrop-blur transition hover:bg-red-600 hover:text-white"
        >
          <Trash2 size={11} />
        </button>
      ) : null}
      {sourceAvailable && (failed || !preview) && !processing ? (
        <button
          type="button"
          disabled={previewBusy}
          onClick={() => void onRequestPreview(candidate.id)}
          className="absolute bottom-2 right-2 rounded-full border border-line bg-paper px-2 py-1 text-[9px] font-semibold text-ink shadow-sm transition hover:border-ink/30 disabled:opacity-50"
        >
          {failed ? t("previewRetry") : t("previewPrepare")}
        </button>
      ) : null}
    </div>
  );
}

function CandidatePreviewFrame({
  projectId,
  candidateId,
}: {
  projectId: string;
  candidateId: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    fetchCandidatePreview(projectId, candidateId)
      .then((nextUrl) => {
        if (active) setUrl(nextUrl);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [candidateId, projectId]);

  if (!url || failed) {
    return (
      <div className="absolute inset-0 grid place-items-center bg-[linear-gradient(145deg,#201641,#09031b)] text-paper/45">
        {failed ? <AlertCircle size={18} /> : <Loader2 size={18} className="animate-spin" />}
      </div>
    );
  }
  return (
    <video
      muted
      playsInline
      preload="metadata"
      src={url}
      onLoadedMetadata={(event) => {
        event.currentTarget.currentTime = Math.min(0.1, event.currentTarget.duration || 0);
      }}
      className="absolute inset-0 size-full object-cover opacity-80 transition duration-300 group-hover:scale-[1.02] group-hover:opacity-100"
    />
  );
}

async function fetchCandidatePreview(projectId: string, candidateId: string): Promise<string> {
  const response = await fetch(
    `/api/video-projects/${projectId}/candidates/${candidateId}/previews`
  );
  if (!response.ok) throw new Error("preview_fetch_failed");
  const payload = await response.json() as {
    segments?: Array<{ segmentIndex: number; url: string | null }>;
  };
  const url = payload.segments?.find((segment) => segment.url)?.url;
  if (!url) throw new Error("preview_url_missing");
  return url;
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
  if (durationMs < 60_000) return `${Math.round(durationMs / 1000)}s`;
  const seconds = Math.round(durationMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
