"use client";

import { useEffect, useRef, useState, type ComponentProps, type KeyboardEvent, type ReactNode } from "react";
import {
  LayoutGrid, List, ArrowLeft, Heart,
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
import { createCandidateResultObserver, trackVideoAction, trackVideoFailure } from "./video-event-client";
import { VideoExportProvider } from "@/app/components/VideoExportProvider";
import { FinalRenderPanel } from "@/app/components/FinalRenderPanel";
import {
  VideoClipEditor,
  type VideoEditorSaveState,
} from "@/app/components/VideoClipEditor";
import { Link } from "@/i18n/navigation";
import type { AnalysisTaskView } from "@/lib/video-workspace/analysis-tasks";
import { AI_CLIP_MIN_DURATION_MS } from "@/lib/video-workspace/candidate-generation";
import { AI_ANALYSIS } from "@/lib/video-workspace/analysis-config";
import type { StoredClipCandidate } from "@/lib/video-workspace/candidates";
import { SourceClipWorkspace } from "./SourceClipWorkspace";
import { AnalysisRangePicker } from "./AnalysisRangePicker";
import { GenerationSettingsPanel } from "./GenerationSettingsPanel";
import { ClipPreviewDialog } from "./ClipPreviewDialog";
import { ClipStyledPoster } from "./ClipStyledPoster";
import { ClipReviewPreview, clipTime } from "./ClipReviewPreview";
import { SelectionRequestForm } from "./SelectionRequestForm";
import { DEFAULT_SELECTION, type SelectionRequirements, type SelectionState } from "@/lib/video-workspace/selection";
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
  const tw = useTranslations("ClipWorkflow");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [layout, setLayout] = useState<"list" | "grid">("list");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("recommended");
  const sourceT = useTranslations("SourceClips");
  const [workspaceTab, setWorkspaceTab] = useState<"source" | "clips">("clips");
  const ts = useTranslations("Dashboard.videoCandidates.selection");
  const [requirements, setRequirements] = useState<SelectionRequirements>(DEFAULT_SELECTION);
  const [batchEnabled, setBatchEnabled] = useState(false);
  const [task, setTask] = useState<AnalysisTaskView | null>(null);
  const [rangeStart, setRangeStart] = useState(0);
  const [rangeEnd, setRangeEnd] = useState(Math.min(sourceDurationMs ?? 0, AI_ANALYSIS.maxRangeMs) / 1000);
  const [rangeError, setRangeError] = useState<false | "invalid" | "dense">(false);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [transcriptId, setTranscriptId] = useState<string | null>(null);
  const [transcriptReady, setTranscriptReady] = useState(false);
  const [selectionLoaded, setSelectionLoaded] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [status, setStatus] = useState<ProjectStatus>(initialStatus);
  const [candidates, setCandidates] = useState(initialCandidates);
  const [previews, setPreviews] = useState(initialPreviews);
  const [selectedCandidateId, setSelectedCandidateId] = useState(() => (
    initialCandidates.some((candidate) => candidate.id === initialSelectedCandidateId)
      ? initialSelectedCandidateId
      : initialCandidates[0]?.id ?? null
  ));
  useEffect(() => {
    const candidate = new URLSearchParams(window.location.search).get("candidateId");
    if (candidate && initialCandidates.some(item => item.id === candidate)) {setSelectedCandidateId(candidate); setWorkspaceTab("clips");}
  }, [initialCandidates]);
  const [pendingCandidateId, setPendingCandidateId] = useState<string | null>(null);
  const [editorSaveState, setEditorSaveState] = useState<VideoEditorSaveState>("saved");
  const [error, setError] = useState(false);
  const promotedPreviews = useRef(new Set<string>());
  const candidateObserver = useRef<ReturnType<typeof createCandidateResultObserver> | null>(null);
  const candidateRequestEpoch = useRef(0);
  if (!candidateObserver.current) candidateObserver.current = createCandidateResultObserver();
  const [previewBusy, setPreviewBusy] = useState<string | null>(null);
  const [candidateToDelete, setCandidateToDelete] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const generating = sourceAvailable && (status === "analyzing" || status === "waiting");
  const shortSource = Boolean(
    canEdit && sourceDurationMs &&
    sourceDurationMs <= VIDEO_WORKSPACE_LIMITS.directEditMaxSourceDurationMs
  );
  const selectedCandidate = candidates.find((candidate) => (
    candidate.id === selectedCandidateId
  )) ?? null;
  const previewsActive = previews.some((preview) => (
    preview.status === "queued" || preview.status === "processing"
  ));

  useEffect(() => {
    let cancelled = false;
    const epoch = candidateRequestEpoch.current;
    fetch(`/api/video-projects/${projectId}/candidates`).then(async response => {
      if (!response.ok) return;
      const data = await response.json() as { task?: AnalysisTaskView; batchAnalysisEnabled?: boolean; selection?: SelectionState; status?: string; transcriptReady?: boolean; transcriptId?: string };
      if (cancelled || epoch !== candidateRequestEpoch.current) return;
      candidateObserver.current?.observe(data);
      setBatchEnabled(Boolean(data.batchAnalysisEnabled));
      if (data.task) {setTask(data.task);setRangeStart(data.task.range.startMs / 1000);setRangeEnd(data.task.range.endMs / 1000);}
      if (data.selection) { setSelection(data.selection); if (data.selection.outcome !== "idle") setRequirements(data.selection.requirements); }
      if (data.status) setStatus(data.status);
      setTranscriptReady(Boolean(data.transcriptReady));
      setTranscriptId(data.transcriptId ?? null);
      setSelectionLoaded(true);
    }).catch(() => setError(true));
    return () => { cancelled = true; };
  }, [projectId]);

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
    if (!generating && (transcriptReady || !transcriptId)) return;
    const poll = window.setInterval(async () => {
      const epoch = candidateRequestEpoch.current;
      try {
        if (!transcriptReady && transcriptId) await fetch(`/api/transcripts/${transcriptId}/status`, { cache: "no-store" });
        const response = await fetch(`/api/video-projects/${projectId}/candidates`);
        if (!response.ok) return;
        const payload = (await response.json()) as {
          task?: AnalysisTaskView;
          transcriptReady?: boolean;
          selection?: SelectionState;
          status?: string;
          candidates?: StoredClipCandidate[];
          previews?: CandidatePreview[];
        };
        if (epoch !== candidateRequestEpoch.current) return;
        candidateObserver.current?.observe(payload);
        if (payload.task) setTask(payload.task);
        if (payload.selection) setSelection(payload.selection);
        setTranscriptReady(Boolean(payload.transcriptReady));
        if (payload.status) {
          setStatus(payload.status);
          if (payload.candidates) setCandidates(payload.candidates);
          if (payload.previews) setPreviews(payload.previews);
        }
      } catch {
        // Polling is best effort; the active POST owns user-visible errors.
      }
    }, 3_000);
    return () => window.clearInterval(poll);
  }, [generating, projectId, transcriptReady, transcriptId]);

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
    if (status === "analyzing") return;
    if (batchEnabled && !shortSource && !task?.canRetry && (!Number.isFinite(rangeStart) || !Number.isFinite(rangeEnd) || rangeStart < 0 || rangeEnd <= rangeStart || rangeEnd * 1000 > (sourceDurationMs ?? 0) || (rangeEnd-rangeStart)*1000 > AI_ANALYSIS.maxRangeMs)) {setRangeError("invalid");return;}
    setRangeError(false);
    setUnsupported(false);
    setStatus("analyzing");
    setError(false);
    const startedAt = Date.now();
    const requestId = task?.canRetry ? task.requestId : crypto.randomUUID();
    candidateRequestEpoch.current++;
    candidateObserver.current?.begin(requestId, startedAt);
    if (status !== "waiting") trackVideoAction("video_candidates_started");
    let requestStatus = 0;
    try {
      const response = await fetch(`/api/video-projects/${projectId}/candidates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requirements, requestId, retry: Boolean(task?.canRetry), adjust: selection?.outcome === "empty", ...(batchEnabled && !shortSource ? {analysisRange: {startMs: Math.round(rangeStart*1000), endMs: Math.round(rangeEnd*1000)}} : {}) }),
      });
      const payload = (await response.json()) as {
        task?: AnalysisTaskView;
        selection?: SelectionState;
        error?: string;
        status?: string;
        candidates?: StoredClipCandidate[];
        previews?: CandidatePreview[];
      };
      requestStatus = response.status;
      // Fence GETs started before this response, including pre-retry failures.
      candidateRequestEpoch.current++;
      if (payload.task) setTask(payload.task);
      if (payload.selection) setSelection(payload.selection);
      if (payload.error === "analysis_input_too_large" || payload.error === "invalid_analysis_range") {setRangeError(payload.error === "analysis_input_too_large" ? "dense" : "invalid");setStatus("draft");return;}
      if (payload.error === "unsupported_selection") { setUnsupported(true); setStatus("draft"); return; }
      if (payload.error === "candidate_generation_active") {
        candidateObserver.current?.abandon(requestId);
        return;
      }
      if (!response.ok || !payload.candidates) throw new Error("candidate_generation_failed");
      candidateObserver.current?.accept(requestId);
      candidateObserver.current?.observe({
        ...payload,
        status: payload.status ?? "candidates_ready",
        selection: payload.selection ?? { requestId },
      });
      replaceWorkspace(
        payload.candidates,
        payload.previews ?? [],
        payload.status ?? "candidates_ready"
      );
    } catch {
      try {
        const current = await fetch(`/api/video-projects/${projectId}/candidates`).then(response => response.json()) as { selection?: SelectionState; status?: string; candidates?: StoredClipCandidate[]; previews?: CandidatePreview[] };
        candidateRequestEpoch.current++;
        if (current.selection?.requestId === requestId) {
          candidateObserver.current?.accept(requestId);
          candidateObserver.current?.observe(current);
        }
        if (current.status === "analyzing" || (current.candidates?.length ?? 0) > 0) {
          replaceWorkspace(current.candidates ?? [], current.previews ?? [], current.status ?? "candidates_ready"); return;
        }
        if (current.selection) { setSelection(current.selection); setRequirements(current.selection.requirements); }
      } catch { /* The original error remains visible. */ }
      trackVideoFailure("generation", requestStatus);
      setStatus(candidates.length > 0 ? "candidates_ready" : "failed");
      setError(true);
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

  const visibleCandidates = candidates.filter(c=>filter==="all" || c.reviewMark===filter).slice().sort((a,b)=>sort==="chronological"?a.segments[0].startMs-b.segments[0].startMs:sort==="shortest"?clipDuration(a)-clipDuration(b):sort==="longest"?clipDuration(b)-clipDuration(a):a.rank-b.rank);
  const reviewIndex = visibleCandidates.findIndex(c => c.id === selectedCandidateId);

  const selectCandidate = (candidateId: string) => {
    trackVideoAction("video_candidate_selected");
    if (layout === "grid") setPreviewOpen(true);
    if (candidateId === selectedCandidateId) {

      return;
    }
    if (editorSaveState === "dirty" || editorSaveState === "saving") {
      setPendingCandidateId(candidateId);
      return;
    }
    setSelectedCandidateId(candidateId);
    setEditing(false);
    setPendingCandidateId(null);
    if (layout === "list" && window.innerWidth < 1024) window.requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  useEffect(() => {
    if (!selectedCandidateId || !sourceAvailable || previewBusy || !candidates.length) return;
    const preview = previews.find(item=>item.candidateId===selectedCandidateId);
    const key = `${selectedCandidateId}:${preview?.segments[0]?.jobId ?? "new"}`;
    if ((!preview || ["not_requested", "queued"].includes(preview.status)) && !promotedPreviews.current.has(key)) {
      promotedPreviews.current.add(key);
      void requestPreview(selectedCandidateId);
    }
  }, [selectedCandidateId, sourceAvailable, previews, previewBusy, candidates.length]);

  const listRef = useRef<HTMLDivElement>(null);
  // Arrow keys (and j/k) step through clips; list view also selects, grid view only moves focus.
  const onListKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = layout === "list"
      ? { ArrowDown: 1, j: 1, ArrowUp: -1, k: -1 }
      : { ArrowRight: 1, ArrowDown: 1, j: 1, ArrowLeft: -1, ArrowUp: -1, k: -1 };
    const delta = keys[event.key as keyof typeof keys];
    if (!delta || event.metaKey || event.ctrlKey || event.altKey) return;
    const options = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>("[role=option]") ?? []);
    const current = options.findIndex(option => option === document.activeElement);
    const from = current >= 0 ? current : Math.max(0, reviewIndex);
    const next = options[Math.min(options.length - 1, Math.max(0, from + delta))];
    if (!next) return;
    event.preventDefault();
    next.focus();
    next.scrollIntoView({ block: "nearest" });
    if (layout === "list" && next.dataset.candidateId) selectCandidate(next.dataset.candidateId);
  };

  useEffect(() => {
    if (!task && !batchEnabled && status === "waiting" && transcriptReady) void generate();
  }, [status, transcriptReady, task, batchEnabled]);

  return (
    <section id="clips" className="mt-3 scroll-mt-6">
      <div className="flex gap-1 border-b border-line" role="tablist" aria-label={sourceT("navigation")}>
        <WorkspaceTab selected={workspaceTab === "clips"} icon={<Film size={15} />} onClick={()=>setWorkspaceTab("clips")}>{sourceT("clips",{count:candidates.length})}</WorkspaceTab>
        {sourceAvailable && <WorkspaceTab selected={workspaceTab === "source"} icon={<Scissors size={15} />} onClick={()=>setWorkspaceTab("source")}>{sourceT("manualSelection")}</WorkspaceTab>}
      </div>
      {sourceAvailable && <div hidden={workspaceTab !== "source"}><SourceClipWorkspace active={workspaceTab === "source"} projectId={projectId} canEdit={canEdit} onCreated={(items,id)=>{setCandidates(items);setSelectedCandidateId(id);setWorkspaceTab("clips");setEditing(true);setPreviewOpen(false);setEditorSaveState("saved");}} /></div>}
      <div hidden={workspaceTab !== "clips"}>
      <div className={candidates.length ? "hidden" : "flex flex-col justify-between gap-3 pb-3 sm:flex-row sm:items-end"}>
        <div className="max-w-2xl">
          <p className="sr-only">
            {t("eyebrow")}
          </p>
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
            {t("shortlistTitle")}
          </h2>
          <p className="mt-1 text-xs leading-5 text-ink/60">
            {t(!sourceAvailable
              ? "archivedDescription"
              : canEdit
                ? "description"
                : "descriptionFree")}
          </p>
        </div>
        {sourceAvailable && candidates.length > 0 ? (
          canEdit ? (
            <button
              type="button"
              onClick={() => setWorkspaceTab("source")}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-meta font-medium text-ink transition hover:border-ink/35 hover:bg-ink hover:text-paper disabled:cursor-wait disabled:opacity-40"
            >
              <Scissors size={14} />
              {t("createCustomClip")}
            </button>
          ) : null
        ) : null}
      </div>

      {status === "transcript_failed" ? <Notice tone="danger">{ts("transcriptFailed")} {transcriptId ? <Link className="font-semibold underline underline-offset-2" href={`/dashboard/transcripts/${transcriptId}`}>{ts("reviewTranscript")}</Link> : null}</Notice> : null}
      {selectionLoaded && status !== "transcript_failed" && sourceAvailable && !shortSource && !generating && !candidates.some(candidate => candidate.origin === "ai") && selection?.outcome !== "matched" ? (
        <div>
          {batchEnabled ? <fieldset disabled={Boolean(task && ["waiting","running","failed"].includes(task.status))} className="disabled:opacity-60">
            <AnalysisRangePicker
              durationMs={sourceDurationMs ?? 0}
              maxRangeMs={AI_ANALYSIS.maxRangeMs}
              start={rangeStart}
              end={rangeEnd}
              invalid={Boolean(rangeError)}
              hint={ts("rangeHint",{minutes:AI_ANALYSIS.maxRangeMs/60_000,minSeconds:AI_CLIP_MIN_DURATION_MS/1000,maxSeconds:VIDEO_WORKSPACE_LIMITS.maxAiCandidateDurationMs/1000})}
              onChange={(start,end)=>{setRangeStart(start);setRangeEnd(end);setRangeError(false);}}
            />
          </fieldset> : null}
          {rangeError ? <Notice tone="danger">{rangeError === "dense" ? ts("rangeDense") : ts("rangeInvalid",{minutes:AI_ANALYSIS.maxRangeMs/60_000})}</Notice> : null}
          {task?.status !== "failed" || task.canRetry ? <SelectionRequestForm requirements={requirements} selection={selection} unsupported={unsupported} onChange={setRequirements} onStart={() => void generate()}><GenerationSettingsPanel projectId={projectId} value={requirements} onChange={setRequirements} disabled={Boolean(task && ["waiting","running","failed"].includes(task.status))} durationMs={sourceDurationMs ?? 0}/></SelectionRequestForm> : null}
        </div>
      ) : null}
      {candidates.length > 0 && selection ? <p className="sr-only">{ts("summary")}: {selection.requirements.mode === "auto" ? ts("auto") : `${selection.requirements.topic} · ${ts(`kinds.${selection.requirements.kind}`)}`}</p> : null}

      {!sourceAvailable ? (
        <Notice tone="info" icon={<Archive size={15} />}>{t("sourceUnavailableBody")}</Notice>
      ) : null}

      {error ? (
        <Notice tone="danger">{t("requestFailed")}</Notice>
      ) : null}

      {task && (task.status !== "completed" || task.limitedReason || task.errorCode) ? <AnalysisProgress task={task} active={generating} /> : null}
      {generating ? <CandidateSkeleton label={status === "waiting" ? ts("waiting") : t("analyzingBody")} /> : null}

      {!sourceAvailable && candidates.length === 0 ? (
        <div className="mt-8 grid min-h-64 place-items-center rounded-card border border-dashed border-line bg-card/35 px-6 text-center">
          <div className="max-w-md py-12">
            <span className="mx-auto inline-grid size-11 place-items-center rounded-full border border-line bg-paper text-muted">
              <Archive size={18} />
            </span>
            <h3 className="mt-4 font-display text-xl font-semibold">{t("sourceUnavailableTitle")}</h3>
            <p className="mt-2 text-body-sm leading-6 text-ink/55">{t("sourceUnavailableEmpty")}</p>
          </div>
        </div>
      ) : null}

      {sourceAvailable && shortSource && !generating && candidates.length === 0 ? (
        <div className="mt-8 grid min-h-64 place-items-center rounded-card border border-dashed border-line bg-card/35 px-6 text-center">
          <div className="max-w-md py-12">
            <span className="mx-auto inline-grid size-11 place-items-center rounded-full border border-line bg-paper text-accent">
              <Sparkles size={18} />
            </span>
            <h3 className="mt-4 font-display text-xl font-semibold">
              {status === "candidates_ready" ? t("noQualityTitle") : t("emptyTitle")}
            </h3>
            <p className="mt-2 text-body-sm leading-6 text-ink/55">
              {status === "candidates_ready"
                ? t(canEdit ? "noQualityBody" : "noQualityBodyFree")
                : shortSource
                  ? t("shortSourceBody")
                  : t("emptyBody")}
            </p>
            {canEdit && status === "candidates_ready" ? (
              <button
                type="button"
                onClick={() => setWorkspaceTab("source")}
                  className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-meta font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-40"
              >
                <Scissors size={14} />
                {t("directEdit")}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {!generating && candidates.length > 0 ? <>
        {editing ? <div className="mb-4 mt-4 flex items-center justify-between gap-3 border-b border-line pb-4">
          <button type="button" disabled={editorSaveState !== "saved"} onClick={()=>{setEditing(false);if(layout==="grid")setPreviewOpen(true);}} className="inline-flex min-h-10 items-center gap-2 rounded-control border border-line bg-card px-4 text-body-sm font-semibold text-ink transition hover:border-ink/30 disabled:opacity-40"><ArrowLeft size={16}/>{tw("back")}</button>
          <span className="inline-flex items-center gap-2 text-meta text-muted"><span aria-hidden className="size-1.5 rounded-full bg-accent" />{tw("editing")}</span>
        </div> : <div className={`mt-4 flex flex-wrap items-center justify-between gap-3 border border-line bg-card px-3 py-2 ${layout==="list" ? "rounded-t-card" : "rounded-card"}`}>
          <div className="flex items-center gap-3">
            <div className="flex rounded-control bg-paper p-0.5" role="group">{(["list","grid"] as const).map(view=><button key={view} type="button" aria-label={tw(view)} title={tw(view)} aria-pressed={layout===view} onClick={()=>{setLayout(view);setPreviewOpen(false);}} className="grid size-9 place-items-center rounded-[10px] text-muted transition hover:text-ink aria-pressed:bg-card aria-pressed:text-ink aria-pressed:shadow-sm">{view==="list"?<List size={17}/>:<LayoutGrid size={17}/>}</button>)}</div>
            <span className="text-body-sm font-semibold text-ink">{sourceT("clips",{count:candidates.length})}</span>
          </div>
          <div className="flex gap-2">
            <select aria-label={tw("filter")} value={filter} onChange={e=>setFilter(e.target.value)} className="min-h-10 rounded-control border border-line bg-card px-3 text-body-sm">{["all","keep","discard"].map(v=><option key={v} value={v}>{tw(v)}</option>)}</select>
            <select aria-label={tw("sort")} value={sort} onChange={e=>setSort(e.target.value)} className="min-h-10 rounded-control border border-line bg-card px-3 text-body-sm">{["recommended","chronological","shortest","longest"].map(v=><option key={v} value={v}>{tw(v)}</option>)}</select>
          </div>
        </div>}
        <div className={!editing && layout==="list" ? "grid items-start overflow-hidden rounded-b-card border-x border-b border-line bg-card lg:h-[calc(100dvh-250px)] lg:min-h-[500px] lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]" : "mt-4"}>
          {!editing ? <div ref={listRef} onKeyDown={onListKeyDown} className={layout==="list" ? "max-h-[340px] overflow-y-auto border-b border-line lg:h-full lg:max-h-none lg:border-b-0 lg:border-r" : "grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4"} role="listbox" aria-label={t("shortlistTitle")}>
            {visibleCandidates.map(candidate=><CandidateTile key={candidate.id} layout={layout} projectId={projectId} candidate={candidate} number={candidate.rank+1} selected={candidate.id===selectedCandidateId} pending={candidate.id===pendingCandidateId} preview={previews.find(p=>p.candidateId===candidate.id)??null} previewBusy={candidate.id===previewBusy} sourceAvailable={sourceAvailable} coverUrl={initialRenders.find(r=>r.candidateId===candidate.id && r.videoUrl)?.coverUrl??null} onSelect={selectCandidate} onRequestPreview={requestPreview} onDelete={candidate.origin==="manual"?()=>setCandidateToDelete(candidate.id):undefined}/>)}
            {!candidates.some(c=>filter==="all" || c.reviewMark===filter) ? <p className="p-6 text-body-sm text-muted">{tw("noResults")}</p> : null}
          </div> : null}
          {selectedCandidate && (layout === "list" || editing || previewOpen) ? <ClipPreviewDialog modal={layout === "grid" && !editing} onClose={()=>setPreviewOpen(false)} onPrevious={reviewIndex>0?()=>selectCandidate(visibleCandidates[reviewIndex-1].id):undefined} onNext={reviewIndex>=0 && reviewIndex<visibleCandidates.length-1?()=>selectCandidate(visibleCandidates[reviewIndex+1].id):undefined}><div ref={editorRef} className={editing ? "mt-5 scroll-mt-6 rounded-card border border-line bg-card" : "min-w-0 scroll-mt-6 lg:h-full lg:overflow-y-auto"}>
            {!sourceAvailable ? <ArchivedClipExport projectId={projectId} candidate={selectedCandidate} onExportDeleted={()=>setCandidates(current=>current.filter(c=>c.id!==selectedCandidate.id))}/> : editing && canEdit ? <VideoClipEditor key={selectedCandidate.id} projectId={projectId} candidateId={selectedCandidate.id} onSaveStateChange={setEditorSaveState} onTitleChange={title=>setCandidates(current=>current.map(c=>c.id===selectedCandidate.id?{...c,theme:title}:c))}/> : <ClipReviewPreview key={selectedCandidate.id} projectId={projectId} candidate={selectedCandidate} canEdit={canEdit} previewStatus={previews.find(p=>p.candidateId===selectedCandidate.id)?.status} onEdit={()=>{setPreviewOpen(false);setEditing(true);editorRef.current?.scrollIntoView({behavior:"smooth",block:"start"});}} onMark={async reviewMark=>{const r=await fetch(`/api/video-projects/${projectId}/candidates/${selectedCandidate.id}`,{method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({reviewMark})});if(!r.ok){setError(true);return;}setCandidates(current=>current.map(c=>c.id===selectedCandidate.id?{...c,reviewMark}:c));}}/>}
          </div></ClipPreviewDialog> : null}
        </div>
      </> : null}
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
            className="surface-modal w-full max-w-[420px] overflow-hidden rounded-card border border-line bg-card shadow-2xl shadow-ink/20"
          >
            <div className="flex items-start gap-3 border-b border-line bg-paper/70 px-5 py-4">
              <span className="mt-0.5 inline-grid size-9 shrink-0 place-items-center rounded-full bg-rec/10 text-rec">
                <AlertTriangle size={18} strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 id="delete-custom-clip-title" className="text-title-sm font-semibold text-ink">
                  {t("deleteCustomTitle")}
                </h2>
                <p className="mt-1 text-body-sm text-muted">{t("deleteCustomBody")}</p>
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
                className="rounded-full border border-line px-4 py-2 text-body-sm font-medium text-ink transition hover:bg-ink/5 disabled:opacity-50"
              >
                {t("deleteCustomCancel")}
              </button>
              <button
                type="button"
                onClick={() => void deleteCustomClip()}
                disabled={deleteBusy}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-rec px-4 py-2 text-body-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {deleteBusy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {deleteBusy ? t("deletingCustom") : t("deleteCustomConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </div>
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
        <p className="font-mono text-caption uppercase tracking-[0.16em] text-accent">
          {t("sourceUnavailableEyebrow")}
        </p>
        <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
          {candidate.theme === "manual_source" ? t("manualTitle") : candidate.theme}
        </h3>
        <p className="mt-2 text-body-sm leading-6 text-ink/60">{t("archivedClipBody")}</p>
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
        <p className="font-mono text-caption uppercase tracking-[0.16em] text-accent">
          {t("eyebrow")}
        </p>
        <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">
          {t("title")}
        </h3>
        <p className="mt-2 text-body-sm leading-6 text-ink/60">{t("body")}</p>

        <div className="mt-5 rounded-control border border-line bg-paper/60 p-4">
          <p className="text-meta font-semibold text-ink">{candidate.theme}</p>
          <p className="mt-2 text-caption leading-5 text-ink/50">{t("included")}</p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-control border border-accent/25 bg-accent/[0.055] p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">
              <LockKeyhole size={14} />
            </span>
            <div>
              <p className="text-meta font-semibold text-ink">{t("lockedTitle")}</p>
              <p className="mt-1 text-caption leading-5 text-ink/55">{t("lockedBody")}</p>
              <Link
                href="/pricing"
                className="mt-3 inline-flex rounded-full bg-accent px-4 py-2 text-caption font-semibold text-white transition hover:bg-ink"
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
  layout,
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
  layout: "list" | "grid";
}) {
  const t = useTranslations("Dashboard.videoCandidates");
  const tw = useTranslations("ClipWorkflow");
  const durationMs = candidate.segments.reduce(
    (total, segment) => total + segment.endMs - segment.startMs,
    0
  );
  const queued = preview?.status === "queued";
  const processing = preview?.status === "processing";
  const failed = preview?.status === "failed";

  const listLayout = layout === "list";
  const scorePct = candidate.origin === "ai" ? Math.round(candidate.score * 100) : null;
  const statusLine = pending ? (
    <><Loader2 size={11} className="animate-spin" />{t("editor.saveState.saving")}</>
  ) : queued ? (
    <><Clock3 size={11} />{t("editor.finalRender.status.queued")}</>
  ) : processing || previewBusy ? (
    <><Loader2 size={11} className="animate-spin" />{t("previewProcessing")}</>
  ) : failed ? (
    <span className="inline-flex items-center gap-1.5 text-rec"><AlertCircle size={11} />{t("previewFailed")}</span>
  ) : null;

  return (
    <div className="group relative min-w-0">
      <button
        type="button"
        role="option"
        aria-selected={selected}
        data-candidate-id={candidate.id}
        onClick={() => onSelect(candidate.id)}
        className={`relative w-full overflow-hidden text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/60 ${listLayout ? "flex items-start gap-3 border-b border-line px-3 py-3" : "rounded-card border bg-card"} ${
          selected
            ? listLayout ? "bg-accent/[0.07]" : "border-accent ring-2 ring-accent/20"
            : listLayout ? "hover:bg-ink/[0.03]" : "border-line hover:-translate-y-0.5 hover:border-ink/30"
        }`}
      >
        {listLayout && selected ? <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-accent" /> : null}
        <div className={`fixed-media-surface relative shrink-0 overflow-hidden bg-black ${listLayout ? "aspect-video w-28 rounded-lg" : "aspect-[9/16]"}`}>
          {coverUrl ? (
            <div
              aria-hidden
              className="absolute inset-0 bg-cover bg-center opacity-85 transition duration-300 group-hover:scale-[1.02] group-hover:opacity-100"
              style={{ backgroundImage: `url(${JSON.stringify(coverUrl).slice(1, -1)})` }}
            />
          ) : preview?.status === "ready" ? (
            listLayout ? <CandidatePreviewFrame projectId={projectId} candidateId={candidate.id} /> : <ClipStyledPoster projectId={projectId} candidateId={candidate.id}/>
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_50%_35%,rgba(108,53,255,0.32),transparent_38%),linear-gradient(145deg,#201641,#09031b)] text-white/45">
              {queued ? (
                <Clock3 size={18} />
              ) : processing || previewBusy ? (
                <Loader2 size={18} className="animate-spin" />
              ) : failed ? (
                <AlertCircle size={18} />
              ) : (
                <Film size={18} />
              )}
            </div>
          )}
          <span className="absolute left-1.5 top-1.5 rounded-full bg-black/65 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.08em] text-white/85 backdrop-blur">
            {candidate.origin === "manual" ? t("manualEyebrow") : `#${number}`}
          </span>
          <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white tabular-nums">
            {formatDuration(durationMs)}
          </span>
          {!selected ? (
            <span className="absolute inset-0 m-auto grid size-9 place-items-center rounded-full border border-white/25 bg-black/45 text-white opacity-0 backdrop-blur transition group-hover:opacity-100">
              <Play size={14} fill="currentColor" className="translate-x-px" />
            </span>
          ) : !listLayout ? (
            <span className={`absolute top-1.5 inline-flex size-6 items-center justify-center rounded-full bg-accent text-white shadow ${onDelete ? "right-9" : "right-1.5"}`}>
              <Check size={13} strokeWidth={2.5} />
            </span>
          ) : null}
        </div>
        <div className={`min-w-0 flex-1 ${listLayout ? "pr-6" : "p-3"}`}>
          <p className={`line-clamp-2 text-body-sm font-semibold ${selected ? "text-ink" : "text-ink/90"}`}>
            {candidate.origin === "manual" ? t("manualTitle") : candidate.theme}
          </p>
          <p className="mt-1 truncate font-mono text-caption text-muted tabular-nums">{candidate.segments.map(s=>`${clipTime(s.startMs)}–${clipTime(s.endMs)}`).join(" · ")}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 font-mono text-caption text-muted">
            {scorePct !== null ? <span className="rounded-full bg-generated/25 px-1.5 py-px font-semibold text-generated-ink dark:bg-generated/15 dark:text-generated">{t("score", { score: scorePct })}</span> : null}
            {candidate.reviewMark === "keep" ? <Heart size={12} className="text-accent" fill="currentColor" aria-label={tw("keep")} /> : null}
            {statusLine ? <span className="inline-flex items-center gap-1.5">{statusLine}</span> : null}
          </div>
        </div>
      </button>
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          aria-label={t("deleteCustom")}
          title={t("deleteCustom")}
          className={`absolute inline-grid size-6 place-items-center rounded-full transition ${listLayout ? "right-2 top-3 text-muted opacity-0 hover:bg-rec/10 hover:text-rec focus-visible:opacity-100 group-hover:opacity-100" : "right-1.5 top-1.5 bg-black/65 text-white/70 backdrop-blur hover:bg-rec hover:text-white"}`}
        >
          <Trash2 size={12} />
        </button>
      ) : null}
      {sourceAvailable && (failed || !preview) && !processing ? (
        <button
          type="button"
          disabled={previewBusy}
          onClick={() => void onRequestPreview(candidate.id)}
          className="absolute bottom-2 right-2 rounded-full border border-line bg-card px-2 py-1 text-caption font-semibold text-ink shadow-sm transition hover:border-ink/30 disabled:opacity-50"
        >
          {failed ? t("previewRetry") : t("previewPrepare")}
        </button>
      ) : null}
    </div>
  );
}

const thumbnailCache = new Map<string, string>();
function CandidatePreviewFrame({ projectId, candidateId }: { projectId: string; candidateId: string }) {
  const key = projectId + ":" + candidateId;
  const host = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<string | null>(()=>thumbnailCache.get(key) ?? null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(()=>{
    if (image || !host.current) return;
    let active=true;
    const observer=new IntersectionObserver(entries=>{
      if(!entries.some(e=>e.isIntersecting))return;
      observer.disconnect();
      fetchCandidatePreview(projectId,candidateId).then(url=>{if(active)setUrl(url);}).catch(()=>{if(active)setFailed(true);});
    },{rootMargin:"80px"});
    observer.observe(host.current);
    return ()=>{active=false;observer.disconnect();};
  },[projectId,candidateId,image]);
  return <div ref={host} className="absolute inset-0">
    {image ? <img src={image} alt="" className="size-full object-cover"/> : url && !failed ? <video muted playsInline crossOrigin="anonymous" preload="metadata" src={url} onLoadedMetadata={e=>{e.currentTarget.currentTime=Math.min(5,e.currentTarget.duration/2);}} onError={()=>setFailed(true)} onSeeked={e=>{try{const video=e.currentTarget;const canvas=document.createElement("canvas");canvas.width=320;canvas.height=Math.round(320*video.videoHeight/video.videoWidth);canvas.getContext("2d")!.drawImage(video,0,0,canvas.width,canvas.height);const data=canvas.toDataURL("image/jpeg",0.75);if(thumbnailCache.size>=120)thumbnailCache.delete(thumbnailCache.keys().next().value!);thumbnailCache.set(key,data);setImage(data);}catch{setFailed(true);}}} className="size-full object-cover"/> : <div className="grid size-full place-items-center bg-black text-white/50">{failed?<Film size={20}/>:<Loader2 size={18} className="animate-spin"/>}</div>}
  </div>;
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
    <div role="status" aria-live="polite" className="mt-4 overflow-hidden rounded-card border border-line bg-card">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Sparkles size={16} className="shrink-0 text-accent" />
        <p className="text-body-sm text-ink/70">{label}</p>
        <Loader2 size={14} className="ml-auto shrink-0 animate-spin text-muted" />
      </div>
      <div aria-hidden className="divide-y divide-line">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex items-start gap-3 px-3 py-3" style={{ opacity: 1 - row * 0.2 }}>
            <div className="skeleton aspect-video w-28 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="skeleton h-3 w-3/4 rounded" />
              <div className="skeleton h-3 w-1/2 rounded" />
              <div className="skeleton h-2.5 w-20 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkspaceTab({ selected, icon, onClick, children }: { selected: boolean; icon: ReactNode; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      onClick={onClick}
      className={`relative -mb-px inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-body-sm font-semibold transition ${selected ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"}`}
    >
      <span className={selected ? "text-accent" : ""}>{icon}</span>
      {children}
    </button>
  );
}

function Notice({ tone, icon, children }: { tone: "danger" | "info"; icon?: ReactNode; children: ReactNode }) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`mt-4 flex items-start gap-2.5 rounded-control border px-4 py-3 text-body-sm ${tone === "danger" ? "border-rec/30 bg-rec/[0.07] text-ink" : "border-line bg-card text-ink/75"}`}
    >
      <span className={`mt-0.5 shrink-0 ${tone === "danger" ? "text-rec" : "text-muted"}`}>{icon ?? <AlertCircle size={15} />}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function AnalysisProgress({ task, active }: { task: AnalysisTaskView; active: boolean }) {
  const ts = useTranslations("Dashboard.videoCandidates.selection");
  const failedSteps = task.steps.filter((step) => ["failed", "limited"].includes(step.status));
  const done = task.status === "completed";
  const ratio = task.totalBatches ? task.completedBatches / task.totalBatches : done ? 1 : 0;
  const clock = (ms: number) => clipTime(ms);
  return (
    <div role="status" className="mt-4 rounded-card border border-line bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-2 text-body-sm font-semibold text-ink">
          {active ? <Loader2 size={14} className="animate-spin text-accent" /> : task.errorCode ? <AlertCircle size={14} className="text-rec" /> : <Check size={14} className="text-sage" />}
          {ts(`phases.${task.phase}`)}
        </p>
        <span className="font-mono text-caption text-muted tabular-nums">
          {clock(task.range.startMs)}–{clock(task.range.endMs)}
        </span>
      </div>
      {task.totalBatches ? (
        <>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/[0.07]">
            <div className={`h-full rounded-full transition-[width] duration-500 ${task.errorCode ? "bg-rec/70" : "bg-accent"}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
          </div>
          <p className="mt-2 text-meta text-muted">{ts("batchProgress", { completed: task.completedBatches, total: task.totalBatches })}</p>
        </>
      ) : null}
      {task.limitedReason ? <p className="mt-2 text-meta text-muted">{ts("limited")}</p> : null}
      {task.errorCode ? <p className="mt-2 text-meta text-rec">{ts(task.errorCode === "unsupported_selection" ? "unsupported" : task.errorCode === "analysis_input_too_large" ? "rangeDense" : "partialFailed")}</p> : null}
      {failedSteps.length ? (
        <details className="mt-2 text-meta text-muted">
          <summary className="cursor-pointer">{task.errorCode ?? ts("limited")}</summary>
          <ul className="mt-1 space-y-0.5 font-mono text-caption">
            {failedSteps.map((step) => <li key={step.id}>{step.ranges.map((range) => `${clock(range.startMs)}–${clock(range.endMs)}`).join(" · ")} — {step.error_code ?? step.status}</li>)}
          </ul>
        </details>
      ) : null}
      {active ? <p className="mt-2 text-meta text-muted">{ts("canLeave")}</p> : null}
    </div>
  );
}

function formatDuration(durationMs: number): string {
  if (durationMs < 60_000) return `${Math.round(durationMs / 1000)}s`;
  const seconds = Math.round(durationMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function clipDuration(candidate: StoredClipCandidate) { return candidate.segments.reduce((n,s)=>n+s.endMs-s.startMs,0); }
