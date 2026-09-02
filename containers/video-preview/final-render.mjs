import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { probeMedia, renderError } from "./preview-render.mjs";

export function validateFinalLease(value) {
  if (
    !value || value.schemaVersion !== 1 || value.kind !== "final" ||
    typeof value.jobId !== "string" || !httpUrl(value.sourceUrl) ||
    !httpUrl(value.outputVideoUrl) || !httpUrl(value.outputCoverUrl)
  ) {
    throw renderError("invalid_render_spec");
  }
  if (
    !value.preset || value.preset.id !== "vertical-1080p-v1" ||
    value.preset.width !== 1080 || value.preset.height !== 1920 ||
    value.preset.videoCodec !== "h264" || value.preset.audioCodec !== "aac"
  ) {
    throw renderError("invalid_render_spec");
  }
  if (!value.edl?.segments?.length || !value.renderSpec?.segments) {
    throw renderError("invalid_edl");
  }
  return value;
}

export async function renderFinal({
  lease,
  workingDirectory,
  sourceInput = lease.sourceUrl,
  logoPath = null,
  fontPath = null,
  reframePlan = null,
}) {
  const outputPath = join(workingDirectory, "final-9x16.mp4");
  const coverPath = join(workingDirectory, "cover.jpg");
  const subtitlePath = join(workingDirectory, "captions.ass");
  const source = await probeMedia(sourceInput);
  const segments = [...lease.edl.segments].sort((left, right) => left.order - right.order);
  if (segments.some((segment) => segment.sourceEndMs > source.durationMs + 250)) {
    throw renderError("invalid_source");
  }
  const fontName = fontPath ? await fontFamilyName(fontPath) : null;
  await writeFile(subtitlePath, buildAss(lease.edl, lease.renderSpec, fontName));

  const args = ["-hide_banner", "-nostdin", "-loglevel", "warning"];
  for (const segment of segments) {
    args.push(
      "-ss", seconds(segment.sourceStartMs),
      "-t", seconds(segment.sourceEndMs - segment.sourceStartMs),
      "-i", sourceInput
    );
  }
  const logoInputIndex = logoPath ? segments.length : null;
  if (logoPath) args.push("-loop", "1", "-i", logoPath);

  const filters = [];
  const reframeBySegment = new Map(
    (reframePlan?.segments ?? []).map((segment) => [segment.segmentId, segment])
  );
  for (const [index, segment] of segments.entries()) {
    const crop = lease.renderSpec.segments[segment.id]?.crop;
    if (!crop) throw renderError("invalid_render_spec");
    const automatic = crop.x === 0.5 && crop.y === 0.5 && crop.zoom === 1;
    const reframe = automatic ? reframeBySegment.get(segment.id) : null;
    if (reframe?.mode === "smart_crop" && reframe.keyframes?.length > 0) {
      filters.push(
        `[${index}:v:0]setpts=PTS-STARTPTS,scale=-2:1920,` +
        `crop=1080:1920:x='(iw-ow)*(${cropExpression(reframe.keyframes)})':y=0,` +
        `setsar=1,fps=30,format=yuv420p[v${index}]`
      );
    } else if (reframe?.mode === "fit_blur") {
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
    } else {
      const geometry = coverCropGeometry(source.width, source.height, crop);
      filters.push(
        `[${index}:v:0]setpts=PTS-STARTPTS,` +
        `scale=${geometry.width}:${geometry.height},` +
        `crop=1080:1920:${geometry.cropX}:${geometry.cropY},` +
        `setsar=1,fps=30,format=yuv420p[v${index}]`
      );
    }
    const duration = seconds(segment.sourceEndMs - segment.sourceStartMs);
    filters.push(source.hasAudio
      ? `[${index}:a:0]asetpts=PTS-STARTPTS,aresample=48000:async=1:first_pts=0[a${index}]`
      : `anullsrc=r=48000:cl=stereo,atrim=duration=${duration},asetpts=PTS-STARTPTS[a${index}]`
    );
  }
  const concatInputs = segments.map((_, index) => `[v${index}][a${index}]`).join("");
  filters.push(`${concatInputs}concat=n=${segments.length}:v=1:a=1[joinv][joina]`);

  let videoLabel = "joinv";
  if (lease.renderSpec.brand.templateId === "signature-v1") {
    filters.push(
      `[${videoLabel}]drawbox=x=0:y=ih-22:w=iw:h=22:color=${lease.renderSpec.brand.accentColor}:t=fill[branded]`
    );
    videoLabel = "branded";
  }
  if (lease.renderSpec.captions.enabled && lease.renderSpec.captions.cues.length > 0) {
    const fontsDir = fontPath ? `:fontsdir='${escapeFilterPath(workingDirectory)}'` : "";
    filters.push(
      `[${videoLabel}]subtitles=filename='${escapeFilterPath(subtitlePath)}'${fontsDir}[captioned]`
    );
    videoLabel = "captioned";
  }
  if (logoPath && logoInputIndex !== null && lease.renderSpec.brand.templateId) {
    const logoWidth = even(Math.max(54, Math.round(1080 * lease.renderSpec.brand.logoScale)));
    filters.push(`[${logoInputIndex}:v:0]scale=${logoWidth}:-2[logo]`);
    const { x, y } = logoOverlay(lease.renderSpec.brand.logoPosition);
    filters.push(`[${videoLabel}][logo]overlay=x=${x}:y=${y}:shortest=1[withlogo]`);
    videoLabel = "withlogo";
  }
  filters.push(`[${videoLabel}]null[finalv]`);

  const durationMs = segments.reduce(
    (total, segment) => total + segment.sourceEndMs - segment.sourceStartMs,
    0
  );
  const audio = [`volume=${decimal(lease.renderSpec.audio.gainDb)}dB`];
  if (lease.renderSpec.audio.normalize) audio.push("loudnorm=I=-16:LRA=11:TP=-1.5");
  if (lease.renderSpec.audio.fadeInMs > 0) {
    audio.push(`afade=t=in:st=0:d=${seconds(lease.renderSpec.audio.fadeInMs)}`);
  }
  if (lease.renderSpec.audio.fadeOutMs > 0) {
    audio.push(
      `afade=t=out:st=${seconds(Math.max(0, durationMs - lease.renderSpec.audio.fadeOutMs))}:d=${seconds(lease.renderSpec.audio.fadeOutMs)}`
    );
  }
  filters.push(`[joina]${audio.join(",")}[finala]`);

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
  await run("ffmpeg", args, "render_failed", 55 * 60 * 1000);
  const output = await probeMedia(outputPath);
  if (
    output.width !== 1080 || output.height !== 1920 ||
    output.videoCodec !== "h264" || output.audioCodec !== "aac" ||
    Math.abs(output.durationMs - durationMs) > 1_000
  ) {
    throw renderError("render_failed");
  }
  await run("ffmpeg", [
    "-hide_banner", "-nostdin", "-loglevel", "warning",
    "-ss", seconds(lease.renderSpec.coverTimelineMs),
    "-i", outputPath,
    "-frames:v", "1",
    "-q:v", "2",
    "-y",
    coverPath,
  ], "render_failed", 2 * 60 * 1000);
  return { outputPath, coverPath, output };
}

export async function downloadAsset(url, path, maxBytes = 5 * 1024 * 1024) {
  if (!url) return null;
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw renderError("download_failed");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > maxBytes) throw renderError("asset_missing");
  await writeFile(path, bytes);
  return path;
}

export function buildAss(edl, renderSpec, customFontName = null) {
  const captions = renderSpec.captions;
  const fontName = customFontName ?? "DejaVu Sans";
  const style = captionStyle(captions.templateId);
  const header = `[Script Info]\nScriptType: v4.00+\nPlayResX: 1080\nPlayResY: 1920\nWrapStyle: 0\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,${fontName},${style.fontSize},${assColor(captions.textColor)},${assColor(captions.highlightColor)},&HCC000000,&H99000000,${style.bold},0,0,0,100,100,0,0,${style.borderStyle},${style.outline},${style.shadow},5,54,54,54,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;
  const timelineStarts = new Map();
  let cursorMs = 0;
  for (const segment of [...edl.segments].sort((left, right) => left.order - right.order)) {
    timelineStarts.set(segment.id, cursorMs);
    cursorMs += segment.sourceEndMs - segment.sourceStartMs;
  }
  const segmentById = new Map(edl.segments.map((segment) => [segment.id, segment]));
  const events = captions.cues.flatMap((cue) => {
    const segment = segmentById.get(cue.segmentId);
    const timelineStart = timelineStarts.get(cue.segmentId);
    if (!segment || timelineStart === undefined) return [];
    const positionY = Math.round(1920 * captions.positionY);
    const boundaries = [...new Set([
      cue.sourceStartMs,
      cue.sourceEndMs,
      ...cue.words.flatMap((word) => [
        Math.max(cue.sourceStartMs, word.sourceStartMs),
        Math.min(cue.sourceEndMs, word.sourceEndMs),
      ]),
    ])].filter((value) => value >= cue.sourceStartMs && value <= cue.sourceEndMs)
      .sort((left, right) => left - right);
    return boundaries.slice(0, -1).flatMap((sourceStartMs, index) => {
      const sourceEndMs = boundaries[index + 1];
      if (sourceEndMs <= sourceStartMs) return [];
      const sampleMs = sourceStartMs + (sourceEndMs - sourceStartMs) / 2;
      const activeIndex = cue.words.findIndex(
        (word) => sampleMs >= word.sourceStartMs && sampleMs < word.sourceEndMs
      );
      const startMs = timelineStart + sourceStartMs - segment.sourceStartMs;
      const endMs = timelineStart + sourceEndMs - segment.sourceStartMs;
      const text = wrapAssWords(
        cue.words,
        captions.maxCharsPerLine,
        captions.maxLines,
        activeIndex,
        captions.highlightColor,
        style.uppercase
      );
      return [`Dialogue: 0,${assTime(startMs)},${assTime(endMs)},Default,,0,0,0,,{\\an5\\pos(540,${positionY})}${text}`];
    });
  });
  return `${header}\n${events.join("\n")}\n`;
}

async function fontFamilyName(path) {
  const bytes = await readFile(path);
  if (bytes.byteLength < 12) throw renderError("asset_missing");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tableCount = view.getUint16(4);
  let nameOffset = -1;
  let nameLength = 0;
  for (let index = 0; index < tableCount; index += 1) {
    const offset = 12 + index * 16;
    if (offset + 16 > bytes.byteLength) break;
    const tag = String.fromCharCode(...bytes.subarray(offset, offset + 4));
    if (tag === "name") {
      nameOffset = view.getUint32(offset + 8);
      nameLength = view.getUint32(offset + 12);
      break;
    }
  }
  if (nameOffset < 0 || nameOffset + nameLength > bytes.byteLength || nameLength < 6) {
    throw renderError("asset_missing");
  }
  const count = view.getUint16(nameOffset + 2);
  const stringOffset = nameOffset + view.getUint16(nameOffset + 4);
  for (let index = 0; index < count; index += 1) {
    const record = nameOffset + 6 + index * 12;
    if (record + 12 > bytes.byteLength) break;
    const platformId = view.getUint16(record);
    const languageId = view.getUint16(record + 4);
    const nameId = view.getUint16(record + 6);
    if (nameId !== 1 || ![0, 1, 3].includes(platformId)) continue;
    if (platformId === 3 && languageId !== 0x0409 && languageId !== 0) continue;
    const length = view.getUint16(record + 8);
    const offset = stringOffset + view.getUint16(record + 10);
    if (offset < 0 || offset + length > bytes.byteLength || length === 0) continue;
    const raw = bytes.subarray(offset, offset + length);
    const decoded = platformId === 0 || platformId === 3
      ? decodeUtf16Be(raw)
      : new TextDecoder("windows-1252").decode(raw);
    const safe = decoded.replace(/[\r\n,]/g, " ").trim().slice(0, 100);
    if (safe) return safe;
  }
  throw renderError("asset_missing");
}

function decodeUtf16Be(bytes) {
  const codeUnits = [];
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    codeUnits.push((bytes[index] << 8) | bytes[index + 1]);
  }
  return String.fromCharCode(...codeUnits);
}

export function wrapAssWords(
  words,
  maxCharsPerLine,
  maxLines,
  activeIndex = -1,
  highlightColor = "#ffffff",
  uppercase = false
) {
  const lines = [[]];
  let lineLength = 0;
  for (const [index, word] of words.entries()) {
    const text = uppercase ? word.text.toLocaleUpperCase("en-US") : word.text;
    const escaped = escapeAss(text);
    const length = [...text].length;
    const nextLength = lineLength + (lineLength > 0 ? 1 : 0) + length;
    if (nextLength > maxCharsPerLine && lines.length < maxLines) {
      lines.push([]);
      lineLength = 0;
    }
    const color = index === activeIndex ? `{\\c${assColor(highlightColor)}}` : "{\\c}";
    lines.at(-1).push(`${color}${escaped}`);
    lineLength += (lineLength > 0 ? 1 : 0) + length;
  }
  return lines.map((line) => line.join(" ")).join("\\N");
}

export function captionStyle(templateId) {
  if (templateId === "boxed-v1") {
    return { fontSize: 72, bold: -1, borderStyle: 3, outline: 0, shadow: 0, uppercase: false };
  }
  if (templateId === "minimal-v1") {
    return { fontSize: 68, bold: 0, borderStyle: 1, outline: 3, shadow: 1, uppercase: false };
  }
  return { fontSize: 82, bold: -1, borderStyle: 1, outline: 5, shadow: 2, uppercase: true };
}

export function logoOverlay(position) {
  if (position === "top-left") return { x: "65", y: "115" };
  if (position === "bottom-left") return { x: "65", y: "H-h-154" };
  if (position === "bottom-right") return { x: "W-w-65", y: "H-h-154" };
  return { x: "W-w-65", y: "115" };
}

export function coverCropGeometry(sourceWidth, sourceHeight, crop) {
  const targetWidth = even(Math.ceil(1080 * crop.zoom));
  const targetHeight = even(Math.ceil(1920 * crop.zoom));
  const scale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = even(Math.ceil(sourceWidth * scale));
  const height = even(Math.ceil(sourceHeight * scale));
  return {
    width,
    height,
    cropX: Math.round((width - 1080) * crop.x),
    cropY: Math.round((height - 1920) * crop.y),
  };
}

function assTime(valueMs) {
  const centiseconds = Math.max(0, Math.round(valueMs / 10));
  const hours = Math.floor(centiseconds / 360000);
  const minutes = Math.floor((centiseconds % 360000) / 6000);
  const secondsValue = Math.floor((centiseconds % 6000) / 100);
  const remainder = centiseconds % 100;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(secondsValue).padStart(2, "0")}.${String(remainder).padStart(2, "0")}`;
}

function assColor(hex) {
  const value = hex.replace("#", "");
  return `&H00${value.slice(4, 6)}${value.slice(2, 4)}${value.slice(0, 2)}`;
}

function escapeAss(value) {
  return value.replaceAll("\\", "\\\\").replaceAll("{", "\\{").replaceAll("}", "\\}").replaceAll("\n", " ");
}

function escapeFilterPath(value) {
  return value.replaceAll("\\", "\\\\").replaceAll(":", "\\:").replaceAll("'", "\\'");
}

function even(value) {
  return value % 2 === 0 ? value : value + 1;
}

function decimal(value) {
  return Number(value).toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

function seconds(valueMs) {
  return (valueMs / 1000).toFixed(3);
}

function cropExpression(keyframes) {
  if (keyframes.length === 1) return preciseDecimal(keyframes[0].cropX);
  let expression = preciseDecimal(keyframes.at(-1).cropX);
  for (let index = keyframes.length - 2; index >= 0; index -= 1) {
    const start = keyframes[index];
    const end = keyframes[index + 1];
    const startSeconds = start.timeMs / 1000;
    const endSeconds = end.timeMs / 1000;
    const duration = Math.max(0.001, endSeconds - startSeconds);
    const progress = `max(0\\,min(1\\,(t-${preciseDecimal(startSeconds)})/${preciseDecimal(duration)}))`;
    const interpolated = `${preciseDecimal(start.cropX)}+(${preciseDecimal(end.cropX)}-${preciseDecimal(start.cropX)})*${progress}`;
    expression = `if(lt(t\\,${preciseDecimal(endSeconds)})\\,${interpolated}\\,${expression})`;
  }
  return expression;
}

function preciseDecimal(value) {
  return Number(value).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
}

function httpUrl(value) {
  return typeof value === "string" && /^https:\/\//.test(value);
}

function run(command, args, errorCode, timeoutMs) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    const timeout = setTimeout(() => {
      process.kill("SIGKILL");
      reject(renderError("job_timed_out"));
    }, timeoutMs);
    process.stderr.setEncoding("utf8");
    process.stderr.on("data", (chunk) => {
      if (stderr.length < 12_000) stderr += chunk;
    });
    process.on("error", (error) => {
      clearTimeout(timeout);
      reject(renderError(errorCode, error));
    });
    process.on("close", (code) => {
      clearTimeout(timeout);
      if (code === 0) resolve({ stderr });
      else reject(renderError(errorCode, new Error(stderr.slice(-4_000))));
    });
  });
}
