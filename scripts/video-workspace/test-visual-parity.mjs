import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawn } from "node:child_process";
import { renderFinal } from "../../containers/video-preview/final-render.mjs";

const root = resolve(import.meta.dirname, "../..");
const fixture = JSON.parse(await readFile(
  join(import.meta.dirname, "fixtures/presentation-v1.json"),
  "utf8"
));
const work = await mkdtemp(join(tmpdir(), "scribix-visual-parity-"));
const chrome = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

try {
  assert.ok(existsSync(chrome), "Chrome is required for browser preview screenshot validation");
  const sourcePath = join(work, "source.mp4");
  const sourceFramePath = join(work, "source-frame.png");
  const logoPath = join(work, "logo.png");
  const browserPath = join(work, "browser-preview.png");
  const finalPath = join(work, "final-frame.png");

  await command("ffmpeg", [
    "-hide_banner", "-nostdin", "-loglevel", "error",
    "-f", "lavfi", "-i", `testsrc2=size=${fixture.source.width}x${fixture.source.height}:rate=30`,
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=48000",
    "-t", String(fixture.source.durationMs / 1000),
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", "-y", sourcePath,
  ]);
  await command("ffmpeg", [
    "-hide_banner", "-nostdin", "-loglevel", "error",
    "-ss", String(fixture.timelineMs / 1000), "-i", sourcePath,
    "-frames:v", "1", "-y", sourceFramePath,
  ]);
  await command("ffmpeg", [
    "-hide_banner", "-nostdin", "-loglevel", "error",
    "-f", "lavfi", "-i", "color=c=0xff5a1f:s=348x176",
    "-vf", "drawbox=x=12:y=12:w=324:h=152:color=white:t=8",
    "-frames:v", "1", "-y", logoPath,
  ]);

  const lease = finalLease(fixture);
  const rendered = await renderFinal({
    lease,
    workingDirectory: work,
    sourceInput: sourcePath,
    logoPath,
  });
  await command("ffmpeg", [
    "-hide_banner", "-nostdin", "-loglevel", "error",
    "-ss", String(fixture.timelineMs / 1000), "-i", rendered.outputPath,
    "-frames:v", "1", "-y", finalPath,
  ]);

  const geometry = cropGeometry(fixture.source, fixture.crop);
  const htmlPath = join(work, "browser-preview.html");
  await writeFile(htmlPath, browserHtml({
    sourceUrl: pathToFileURL(sourceFramePath).href,
    logoUrl: pathToFileURL(logoPath).href,
    geometry,
    brand: fixture.brand,
  }));
  await command(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--allow-file-access-from-files",
    "--force-device-scale-factor=1",
    "--window-size=1080,1920",
    "--virtual-time-budget=1000",
    `--screenshot=${browserPath}`,
    pathToFileURL(htmlPath).href,
  ]);

  const result = await command("ffmpeg", [
    "-hide_banner", "-nostdin", "-i", browserPath, "-i", finalPath,
    "-lavfi", "ssim", "-f", "null", "-",
  ], true);
  const match = result.stderr.match(/All:([0-9.]+)/);
  assert.ok(match, "FFmpeg did not report an SSIM score");
  const ssim = Number(match[1]);
  assert.ok(
    ssim >= fixture.golden.minimumGeometrySsim,
    `Browser/final geometry SSIM ${ssim} is below ${fixture.golden.minimumGeometrySsim}`
  );
  console.log(JSON.stringify({
    event: "visual_parity_passed",
    ssim,
    timelineMs: fixture.timelineMs,
    crop: fixture.crop,
    artifacts: process.env.KEEP_VISUAL_ARTIFACTS ? work : undefined,
  }));
} finally {
  if (!process.env.KEEP_VISUAL_ARTIFACTS) await rm(work, { recursive: true, force: true });
}

function finalLease(value) {
  return {
    schemaVersion: 1,
    jobId: "m7-visual-parity",
    kind: "final",
    sourceUrl: "https://example.invalid/source.mp4",
    outputVideoUrl: "https://example.invalid/final.mp4",
    outputCoverUrl: "https://example.invalid/cover.jpg",
    logoUrl: null,
    fontUrl: null,
    urlsExpireInSec: 3600,
    edl: {
      schemaVersion: 1,
      segments: [{ id: "segment-1", sourceStartMs: 0, sourceEndMs: value.source.durationMs, order: 0 }],
    },
    renderSpec: {
      schemaVersion: 1,
      outputPresetId: "vertical-1080p-v1",
      canvas: { width: 1080, height: 1920, fps: 30, backgroundColor: "#000000" },
      segments: { "segment-1": { crop: value.crop } },
      captions: { ...value.caption, enabled: true, templateId: "karaoke-v1", fontAssetId: null, cues: [] },
      brand: { ...value.brand, logoAssetId: "fixture-logo" },
      audio: { gainDb: 0, normalize: false, fadeInMs: 0, fadeOutMs: 0 },
      coverTimelineMs: value.timelineMs,
    },
    preset: {
      id: "vertical-1080p-v1", width: 1080, height: 1920, fps: 30,
      videoCodec: "h264", pixelFormat: "yuv420p", audioCodec: "aac",
      audioChannels: 2, container: "mp4",
    },
  };
}

function cropGeometry(source, crop) {
  const targetWidth = even(Math.ceil(1080 * crop.zoom));
  const targetHeight = even(Math.ceil(1920 * crop.zoom));
  const scale = Math.max(targetWidth / source.width, targetHeight / source.height);
  const width = even(Math.ceil(source.width * scale));
  const height = even(Math.ceil(source.height * scale));
  return {
    width,
    height,
    left: -Math.round((width - 1080) * crop.x),
    top: -Math.round((height - 1920) * crop.y),
  };
}

function browserHtml({ sourceUrl, logoUrl, geometry, brand }) {
  const logoWidth = even(Math.max(54, Math.round(1080 * brand.logoScale)));
  const horizontal = brand.logoPosition.endsWith("left") ? "left:65px" : "right:65px";
  const vertical = brand.logoPosition.startsWith("top") ? "top:115px" : "bottom:154px";
  return `<!doctype html><meta charset="utf-8"><style>
    *{box-sizing:border-box}html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#000}
    #stage{position:relative;width:1080px;height:1920px;overflow:hidden;background:#000}
    #source{position:absolute;width:${geometry.width}px;height:${geometry.height}px;left:${geometry.left}px;top:${geometry.top}px}
    #brand{position:absolute;left:0;right:0;bottom:0;height:22px;background:${brand.accentColor}}
    #logo{position:absolute;width:${logoWidth}px;height:auto;${horizontal};${vertical}}
  </style><div id="stage"><img id="source" src="${sourceUrl}"><div id="brand"></div><img id="logo" src="${logoUrl}"></div>`;
}

function even(value) {
  return value % 2 === 0 ? value : value + 1;
}

function command(binary, args, allowFailureOutput = false) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0 || allowFailureOutput) resolvePromise({ code, stdout, stderr });
      else reject(new Error(`${binary} exited ${code}: ${stderr.slice(-1200)}`));
    });
  });
}
