"use client";

// Browser-side audio extraction from a video file using ffmpeg.wasm.
// Single-threaded core (no SharedArrayBuffer / COOP-COEP needed).
// Output: MP3, mono, 16 kHz, 64 kbps — small and AssemblyAI-friendly.

import type { FFmpeg } from "@ffmpeg/ffmpeg";

const FFMPEG_VERSION = "0.12.15";
const FFMPEG_CORE_VERSION = "0.12.10";
const FFMPEG_BASE = `https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@${FFMPEG_VERSION}/dist/esm`;
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
      classWorkerURL: await toBlobURL(`${FFMPEG_BASE}/worker.js`, "text/javascript"),
      coreURL: `${FFMPEG_CORE_BASE}/ffmpeg-core.js`,
      wasmURL: `${FFMPEG_CORE_BASE}/ffmpeg-core.wasm`,
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
  try {
    return await withTimeout(
      extractWithWebAudio(file, onProgress),
      2 * 60 * 1000,
      () => {}
    );
  } catch (err) {
    console.warn("Web Audio extraction failed, trying ffmpeg fallback", err);
    return withTimeout(
      extractWithFfmpeg(file, onProgress),
      3 * 60 * 1000,
      () => {
        _ff?.terminate();
        _ff = null;
        _loading = null;
      }
    );
  }
}

async function extractWithFfmpeg(
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

async function extractWithWebAudio(
  file: File,
  onProgress?: ExtractProgress
): Promise<ExtractedAudio> {
  onProgress?.(0.1);
  const arrayBuffer = await file.arrayBuffer();
  onProgress?.(0.2);

  const AudioCtx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) {
    throw new Error("Browser audio decoding is not available.");
  }
  const audioCtx = new AudioCtx();
  try {
    const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    onProgress?.(0.45);

    const sampleRate = 16000;
    const frameCount = Math.ceil(decoded.duration * sampleRate);
    const offline = new OfflineAudioContext(1, frameCount, sampleRate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);

    const rendered = await offline.startRendering();
    onProgress?.(0.8);
    const wav = encodeMonoWav(rendered.getChannelData(0), sampleRate);
    onProgress?.(1);
    return {
      blob: new Blob([wav], { type: "audio/wav" }),
      durationSec: decoded.duration,
    };
  } finally {
    await audioCtx.close().catch(() => {});
  }
}

function encodeMonoWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (const sample of samples) {
    const s = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

function writeAscii(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  onTimeout: () => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout();
      reject(new Error("Audio extraction timed out. Trying browser fallback."));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}
