"use client";

// Browser-side audio extraction from a video file using ffmpeg.wasm.
// Single-threaded core (no SharedArrayBuffer / COOP-COEP needed).
// Output: MP3, mono, 16 kHz, 64 kbps — small and AssemblyAI-friendly.

import type { FFmpeg } from "@ffmpeg/ffmpeg";

const FFMPEG_CORE_VERSION = "0.12.10";
const FFMPEG_CORE_BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${FFMPEG_CORE_VERSION}/dist/esm`;

let _ff: FFmpeg | null = null;
let _loading: Promise<FFmpeg> | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (_ff) return _ff;
  if (_loading) return _loading;
  _loading = (async () => {
    const { FFmpeg } = await import("@ffmpeg/ffmpeg");
    const { toBlobURL } = await import("@ffmpeg/util");
    const ff = new FFmpeg();
    await ff.load({
      coreURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`, "application/wasm"),
    });
    _ff = ff;
    _loading = null;
    return ff;
  })();
  return _loading;
}

export type ExtractProgress = (frac: number) => void;

export type ExtractedAudio = {
  blob: Blob;
  durationSec: number;
};

export async function extractAudioFromVideo(
  file: File,
  onProgress?: ExtractProgress
): Promise<ExtractedAudio> {
  const ff = await getFFmpeg();
  const { fetchFile } = await import("@ffmpeg/util");

  const ext = (file.name.split(".").pop() || "bin").toLowerCase().slice(0, 8);
  const inputName = `input.${ext}`;
  const outputName = "output.mp3";

  let durationSec = 0;
  const onLog = ({ message }: { message: string }) => {
    const m = message.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (m) {
      durationSec = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    }
  };
  const onProg = ({ progress }: { progress: number }) => {
    if (onProgress) onProgress(Math.max(0, Math.min(1, progress)));
  };

  ff.on("log", onLog);
  ff.on("progress", onProg);

  try {
    await ff.writeFile(inputName, await fetchFile(file));
    const code = await ff.exec([
      "-i", inputName,
      "-vn",
      "-ac", "1",
      "-ar", "16000",
      "-c:a", "libmp3lame",
      "-b:a", "64k",
      outputName,
    ]);
    if (code !== 0) {
      throw new Error("Audio extraction failed. The video format may be unsupported — try converting it and uploading again.");
    }
    const data = await ff.readFile(outputName);
    if (typeof data === "string") {
      throw new Error("Unexpected text output from ffmpeg.");
    }
    const blob = new Blob([data], { type: "audio/mpeg" });
    return { blob, durationSec };
  } finally {
    ff.off("log", onLog);
    ff.off("progress", onProg);
    try { await ff.deleteFile(inputName); } catch {}
    try { await ff.deleteFile(outputName); } catch {}
  }
}
