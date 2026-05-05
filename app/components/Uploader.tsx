"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";

const ACCEPT = "audio/*,video/*";
const MAX_BROWSER_VIDEO_BYTES = 1024 * 1024 * 1024;

export type UploadPhase =
  | "idle"
  | "preparing"
  | "extracting"
  | "uploading"
  | "submitting"
  | "polling"
  | "error";

export type UseUploadOpts = {
  signedIn: boolean;
  /** Where to send the user back to after Google sign-in (locale-prefixed path). */
  postSignInPath?: string;
};

export function useUpload({ signedIn, postSignInPath = "/dashboard/new" }: UseUploadOpts) {
  const router = useRouter();
  const [phase, setPhase] = useState<UploadPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filename, setFilename] = useState<string | null>(null);

  const onPick = useCallback(
    async (
      file: File,
      source: "upload" | "record" = "upload",
      durationSecOverride?: number
    ) => {
      if (!signedIn) {
        await signIn("google", { redirectTo: postSignInPath });
        return;
      }
      setErrorMsg(null);
      setFilename(file.name);
      setPhase("preparing");
      setProgress(0);

      try {
        const isVideo = file.type.startsWith("video/");
        if (isVideo && file.size > MAX_BROWSER_VIDEO_BYTES) {
          throw new Error(
            "Video uploads are currently limited to 1 GB in the browser. For larger files, please convert to audio first."
          );
        }

        const durationSec =
          durationSecOverride && durationSecOverride > 0
            ? durationSecOverride
            : await readMediaDuration(file);

        // Pre-flight: server validates duration cap + quota BEFORE we spend
        // time on extraction or upload bandwidth.
        const initRes = await fetch("/api/transcripts/init", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            filename: file.name,
            bytes: file.size,
            mime: file.type || "application/octet-stream",
            durationSec,
            isVideo,
            source,
          }),
        });
        if (!initRes.ok) throw new Error(await readError(initRes));
        const { transcriptId, uploadUrl } = (await initRes.json()) as {
          transcriptId: string;
          uploadUrl: string;
        };

        let uploadBody: Blob = file;
        if (isVideo) {
          setPhase("extracting");
          setProgress(0);
          const { extractAudioFromVideo } = await import("@/lib/audio-extractor");
          const { blob } = await extractAudioFromVideo(file, (p) => setProgress(p));
          uploadBody = blob;
        }

        setPhase("uploading");
        await uploadWithProgress(uploadUrl, uploadBody, (p) => setProgress(p));

        setPhase("submitting");
        const startRes = await fetch(`/api/transcripts/${transcriptId}/start`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ durationSecEstimate: durationSec }),
        });
        if (!startRes.ok) throw new Error(await readError(startRes));

        setPhase("polling");
        const finalStatus = await pollStatus(transcriptId);
        if (finalStatus === "completed") {
          router.push(`/dashboard/transcripts/${transcriptId}`);
        } else {
          throw new Error(`Transcription ${finalStatus}.`);
        }
      } catch (err) {
        setPhase("error");
        setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
      }
    },
    [router, signedIn, postSignInPath]
  );

  return { phase, progress, errorMsg, filename, onPick };
}

/** Plain, dashboard-styled drag/drop uploader. */
export function Uploader(props: UseUploadOpts) {
  const { phase, progress, errorMsg, filename, onPick } = useUpload(props);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const file = e.dataTransfer.files?.[0];
        if (file) onPick(file);
      }}
      className={`rounded-2xl border border-dashed p-10 text-center transition ${
        dragOver ? "border-accent bg-accent/5" : "border-line"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
        }}
      />

      {phase === "idle" || phase === "error" ? (
        <>
          <p className="text-base font-medium">Drop a video or audio file</p>
          <p className="mt-1 text-sm text-ink/60">
            Video uploads up to 1&nbsp;GB · Free trial: 45&nbsp;min lifetime · max 500&nbsp;MB after audio extraction
          </p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-6 rounded-full bg-ink px-5 py-2 text-[13px] font-medium text-paper hover:bg-accent"
          >
            Choose file
          </button>
          {errorMsg && <p className="mt-4 text-sm text-red-600">{errorMsg}</p>}
        </>
      ) : (
        <ProgressView phase={phase} progress={progress} filename={filename} />
      )}
    </div>
  );
}

export function ProgressView({
  phase,
  progress,
  filename,
}: {
  phase: UploadPhase;
  progress: number;
  filename: string | null;
}) {
  const label =
    phase === "preparing"
      ? "Preparing…"
      : phase === "extracting"
      ? `Extracting audio ${Math.round(progress * 100)}%`
      : phase === "uploading"
      ? `Uploading ${Math.round(progress * 100)}%`
      : phase === "submitting"
      ? "Submitting For processing…"
      : phase === "polling"
      ? "Transcribing…"
      : "";
  const bar =
    phase === "uploading" || phase === "extracting"
      ? progress
      : phase === "polling"
      ? null
      : 1;
  return (
    <div className="space-y-3">
      {filename && <p className="text-sm text-ink/70">{filename}</p>}
      <p className="text-base font-medium">{label}</p>
      <div className="mx-auto h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-ink/10">
        {bar === null ? (
          <div className="h-full animate-pulse bg-accent" style={{ width: "30%" }} />
        ) : (
          <div className="h-full bg-accent transition-[width]" style={{ width: `${bar * 100}%` }} />
        )}
      </div>
    </div>
  );
}

export const UPLOAD_ACCEPT = ACCEPT;

async function readMediaDuration(file: File): Promise<number> {
  const url = URL.createObjectURL(file);
  const tag = file.type.startsWith("video/") ? "video" : "audio";
  const el = document.createElement(tag);
  el.preload = "metadata";
  el.src = url;
  try {
    await new Promise<void>((resolve, reject) => {
      el.addEventListener("loadedmetadata", () => resolve(), { once: true });
      el.addEventListener("error", () => reject(new Error("Cannot read media metadata.")), {
        once: true,
      });
    });
    return Number.isFinite(el.duration) ? el.duration : 0;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function uploadWithProgress(
  url: string,
  file: Blob,
  onProgress: (frac: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    });
    xhr.addEventListener("load", () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText.slice(0, 200)}`))
    );
    xhr.addEventListener("error", () => reject(new Error("Upload network error.")));
    xhr.send(file);
  });
}

async function pollStatus(id: string): Promise<"completed" | "error"> {
  while (true) {
    await new Promise((r) => setTimeout(r, 3000));
    const res = await fetch(`/api/transcripts/${id}/status`);
    if (!res.ok) throw new Error(await readError(res));
    const { status, error } = (await res.json()) as { status: string; error: string | null };
    if (status === "completed") return "completed";
    if (status === "error") throw new Error(error ?? "Transcription error.");
  }
}

async function readError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as {
      error?: string;
      maxBytes?: number;
      maxSec?: number;
      remainingMin?: number;
      capMin?: number;
      neededMin?: number;
    };
    switch (j.error) {
      case "file_too_large": {
        const mb = j.maxBytes ? Math.floor(j.maxBytes / (1024 * 1024)) : null;
        return mb
          ? `That file is larger than your tier allows (max ${mb} MB). Upgrade for higher limits.`
          : "That file is larger than your tier allows. Upgrade for higher limits.";
      }
      case "duration_exceeds_tier": {
        const min = j.maxSec ? Math.floor(j.maxSec / 60) : null;
        return min
          ? `That file is longer than your tier allows (max ${min} min per file). Upgrade for longer files.`
          : "That file is longer than your tier allows. Upgrade for longer files.";
      }
      case "no_quota":
        return j.capMin
          ? `You've used all ${j.capMin} minutes for this period. Upgrade or wait for the next cycle.`
          : "You're out of minutes for this period. Upgrade or wait for the next cycle.";
      case "insufficient_quota":
        return `This file needs ~${j.neededMin ?? "?"} min but you only have ${j.remainingMin ?? 0} min left this period. Upgrade or wait for the next cycle.`;
      case "aai_submit_failed":
        return "Transcription service is unavailable. Please try again in a moment.";
      default:
        return j.error ?? `Request failed (${res.status}).`;
    }
  } catch {
    return `Request failed (${res.status}).`;
  }
}
