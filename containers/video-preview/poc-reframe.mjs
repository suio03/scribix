import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildAss } from "./final-render.mjs";
import { probeMedia, renderError } from "./preview-render.mjs";

const defaultModelPath = "/opt/scribix-models/blaze_face_full_range_v1.tflite";
const defaultAnalyzerPath = "/app/poc-reframe.py";

export async function analyzeReframe({
  sourceInput,
  segments,
  workingDirectory,
  analyzerPath = process.env.SCRIBIX_REFRAME_ANALYZER ?? defaultAnalyzerPath,
  modelPath = process.env.SCRIBIX_FACE_MODEL ?? defaultModelPath,
}) {
  const segmentsPath = join(workingDirectory, "reframe-segments.json");
  const outputPath = join(workingDirectory, "reframe-plan.json");
  await writeFile(segmentsPath, `${JSON.stringify(segments)}\n`);
  await run(process.env.SCRIBIX_PYTHON ?? "python3", [
    analyzerPath,
    "--input", sourceInput,
    "--segments", segmentsPath,
    "--model", modelPath,
    "--output", outputPath,
  ], "reframe_analysis_failed", 15 * 60 * 1000);
  let plan;
  try {
    plan = JSON.parse(await readFile(outputPath, "utf8"));
  } catch (error) {
    throw renderError("reframe_analysis_failed", error);
  }
  validatePlan(plan, segments);
  return plan;
}

export async function renderReframedPoc({
  sourceInput,
  segments,
  plan,
  workingDirectory,
  presentation = null,
}) {
  const outputPath = join(workingDirectory, "smart-reframe-9x16.mp4");
  const coverPath = join(workingDirectory, "smart-reframe-cover.jpg");
  const subtitlePath = join(workingDirectory, "captions.ass");
  const source = await probeMedia(sourceInput);
  const sortedSegments = [...segments].sort((left, right) => left.order - right.order);
  const planBySegment = new Map(plan.segments.map((segment) => [segment.segmentId, segment]));
  if (presentation) {
    await writeFile(
      subtitlePath,
      buildAss(presentation.edl, presentation.renderSpec)
    );
  }
  const args = ["-hide_banner", "-nostdin", "-loglevel", "warning"];
  for (const segment of sortedSegments) {
    args.push(
      "-ss", seconds(segment.sourceStartMs),
      "-t", seconds(segment.sourceEndMs - segment.sourceStartMs),
      "-i", sourceInput
    );
  }

  const filters = [];
  for (const [index, segment] of sortedSegments.entries()) {
    const segmentPlan = planBySegment.get(segment.id);
    if (!segmentPlan) throw renderError("invalid_reframe_plan");
    if (segmentPlan.mode === "smart_crop") {
      const x = cropExpression(segmentPlan.keyframes);
      filters.push(
        `[${index}:v:0]setpts=PTS-STARTPTS,scale=-2:1920,` +
        `crop=1080:1920:x='(iw-ow)*(${x})':y=0,` +
        `setsar=1,fps=30,format=yuv420p[v${index}]`
      );
    } else {
      filters.push(`[${index}:v:0]setpts=PTS-STARTPTS,split=2[bgsrc${index}][fgsrc${index}]`);
      filters.push(
        `[bgsrc${index}]scale=360:640:force_original_aspect_ratio=increase,` +
        `crop=360:640,gblur=sigma=22,scale=1080:1920[bg${index}]`
      );
      filters.push(
        `[fgsrc${index}]scale=1080:1920:force_original_aspect_ratio=decrease[fg${index}]`
      );
      filters.push(
        `[bg${index}][fg${index}]overlay=(W-w)/2:(H-h)/2,` +
        `setsar=1,fps=30,format=yuv420p[v${index}]`
      );
    }
    const duration = seconds(segment.sourceEndMs - segment.sourceStartMs);
    filters.push(source.hasAudio
      ? `[${index}:a:0]asetpts=PTS-STARTPTS,aresample=48000:async=1:first_pts=0[a${index}]`
      : `anullsrc=r=48000:cl=stereo,atrim=duration=${duration},asetpts=PTS-STARTPTS[a${index}]`
    );
  }
  const concatInputs = sortedSegments.map((_, index) => `[v${index}][a${index}]`).join("");
  const joinedVideoLabel = presentation ? "joinv" : "finalv";
  const joinedAudioLabel = presentation ? "joina" : "finala";
  filters.push(
    `${concatInputs}concat=n=${sortedSegments.length}:v=1:a=1[${joinedVideoLabel}][${joinedAudioLabel}]`
  );
  const durationMs = sortedSegments.reduce(
    (total, segment) => total + segment.sourceEndMs - segment.sourceStartMs,
    0
  );
  if (presentation) {
    let videoLabel = joinedVideoLabel;
    if (presentation.renderSpec.brand.templateId === "signature-v1") {
      filters.push(
        `[${videoLabel}]drawbox=x=0:y=ih-22:w=iw:h=22:color=${presentation.renderSpec.brand.accentColor}:t=fill[branded]`
      );
      videoLabel = "branded";
    }
    if (presentation.renderSpec.captions.cues.length > 0) {
      filters.push(
        `[${videoLabel}]subtitles=filename='${escapeFilterPath(subtitlePath)}'[captioned]`
      );
      videoLabel = "captioned";
    }
    filters.push(`[${videoLabel}]null[finalv]`);

    const audio = [`volume=${decimal(presentation.renderSpec.audio.gainDb)}dB`];
    if (presentation.renderSpec.audio.normalize) audio.push("loudnorm=I=-16:LRA=11:TP=-1.5");
    if (presentation.renderSpec.audio.fadeInMs > 0) {
      audio.push(`afade=t=in:st=0:d=${seconds(presentation.renderSpec.audio.fadeInMs)}`);
    }
    if (presentation.renderSpec.audio.fadeOutMs > 0) {
      audio.push(
        `afade=t=out:st=${seconds(Math.max(0, durationMs - presentation.renderSpec.audio.fadeOutMs))}:d=${seconds(presentation.renderSpec.audio.fadeOutMs)}`
      );
    }
    filters.push(`[${joinedAudioLabel}]${audio.join(",")}[finala]`);
  }
  args.push(
    "-filter_complex", filters.join(";"),
    "-map", "[finalv]",
    "-map", "[finala]",
    "-t", seconds(durationMs),
    "-r", "30",
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "20",
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "192k",
    "-ac", "2",
    "-ar", "48000",
    "-movflags", "+faststart",
    "-max_muxing_queue_size", "4096",
    "-y",
    outputPath
  );
  await run("ffmpeg", args, "reframe_render_failed", 55 * 60 * 1000);
  const output = await probeMedia(outputPath);
  if (
    output.width !== 1080 || output.height !== 1920 ||
    output.videoCodec !== "h264" || output.audioCodec !== "aac" ||
    Math.abs(output.durationMs - durationMs) > 1_000
  ) {
    throw renderError("reframe_render_failed");
  }
  await run("ffmpeg", [
    "-hide_banner", "-nostdin", "-loglevel", "warning",
    "-ss", seconds(Math.min(1_200, Math.max(0, durationMs - 100))),
    "-i", outputPath,
    "-frames:v", "1",
    "-q:v", "2",
    "-y",
    coverPath,
  ], "reframe_render_failed", 2 * 60 * 1000);
  return { outputPath, coverPath, output };
}

function validatePlan(plan, segments) {
  if (!plan || plan.schemaVersion !== 1 || !Array.isArray(plan.segments)) {
    throw renderError("invalid_reframe_plan");
  }
  const expected = new Set(segments.map((segment) => segment.id));
  for (const segment of plan.segments) {
    if (
      !expected.delete(segment.segmentId) ||
      !["smart_crop", "fit_blur"].includes(segment.mode) ||
      !Number.isFinite(segment.confidence) ||
      !Array.isArray(segment.keyframes)
    ) {
      throw renderError("invalid_reframe_plan");
    }
    if (segment.mode === "smart_crop" && segment.keyframes.length === 0) {
      throw renderError("invalid_reframe_plan");
    }
    for (const keyframe of segment.keyframes) {
      if (
        !Number.isInteger(keyframe.timeMs) || keyframe.timeMs < 0 ||
        !Number.isFinite(keyframe.cropX) || keyframe.cropX < 0 || keyframe.cropX > 1
      ) throw renderError("invalid_reframe_plan");
    }
  }
  if (expected.size > 0) throw renderError("invalid_reframe_plan");
}

function cropExpression(keyframes) {
  if (keyframes.length === 1) return decimal(keyframes[0].cropX);
  let expression = decimal(keyframes.at(-1).cropX);
  for (let index = keyframes.length - 2; index >= 0; index -= 1) {
    const start = keyframes[index];
    const end = keyframes[index + 1];
    const startSeconds = start.timeMs / 1000;
    const endSeconds = end.timeMs / 1000;
    const duration = Math.max(0.001, endSeconds - startSeconds);
    const progress = `max(0\\,min(1\\,(t-${decimal(startSeconds)})/${decimal(duration)}))`;
    const interpolated = `${decimal(start.cropX)}+(${decimal(end.cropX)}-${decimal(start.cropX)})*${progress}`;
    expression = `if(lt(t\\,${decimal(endSeconds)})\\,${interpolated}\\,${expression})`;
  }
  return expression;
}

function decimal(value) {
  return Number(value).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function seconds(valueMs) {
  return (valueMs / 1000).toFixed(3);
}

function escapeFilterPath(path) {
  return path.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "'\\''");
}

function run(command, args, errorCode, timeoutMs) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(renderError(errorCode));
    }, timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      if (stdout.length < 1_000_000) stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      if (stderr.length < 16_000) stderr += chunk;
    });
    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(renderError(errorCode, error));
    });
    child.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve({ stdout, stderr });
      else reject(renderError(errorCode, new Error(stderr.slice(0, 500))));
    });
  });
}
