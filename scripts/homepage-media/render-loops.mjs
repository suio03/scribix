// Renders the looping homepage demos in loops.jsx.
// Usage: REMOTION_TOOLCHAIN_DIR=/path node scripts/homepage-media/render-loops.mjs [id ...]
import { createRequire } from "node:module";
import path from "node:path";
import { copyFile, mkdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const film = path.join(root, ".artifacts/homepage-film");
const publicDir = path.join(film, "loops-public");
const outDir = path.join(film, "loops");
const toolchain = process.env.REMOTION_TOOLCHAIN_DIR;
if (!toolchain)
  throw new Error("Set REMOTION_TOOLCHAIN_DIR to a directory with Remotion 4.0.484 installed.");

// Pexels stock clips (https://www.pexels.com/license/) saved under
// .artifacts/homepage-film/stock/<name>.mp4. Each render reads a trimmed,
// silent 1920×1080 30 fps copy; values are [Pexels id, start s, length s].
const STOCK = {
  "wall-01": [7586489, 0, 8],
  "wall-02": [8048247, 2, 8],
  "wall-03": [7414133, 0, 7],
  "wall-04": [8617284, 8, 8],
  "wall-05": [14791149, 0, 8],
  "wall-06": [12691778, 8, 8],
  "wall-07": [6248321, 5, 8],
  "wall-08": [7823739, 0, 8],
  "wall-09": [6332572, 4, 8],
  "wall-10": [7594692, 3, 8],
  "feat-framing": [16068998, 10, 8],
  "feat-select": [8529661, 4, 8],
  "feat-captions": [7999352, 0, 8],
  "feat-trim": [6985493, 6, 8],
  "feat-cover": [8626274, 0, 8],
  "feat-publish": [4569680, 2, 8],
};
await mkdir(path.join(publicDir, "stock"), { recursive: true });
for (const [name, [, start, length]] of Object.entries(STOCK)) {
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-ss", String(start), "-t", String(length),
    "-i", path.join(film, "stock", `${name}.mp4`),
    "-vf", "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30",
    "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-an",
    path.join(publicDir, "stock", `${name}.mp4`),
  ]);
}
// Cover loop: six 9:16 frames from the cover clip, face-centred.
await mkdir(path.join(publicDir, "frames"), { recursive: true });
for (const [i, at] of [0.5, 1.8, 3.1, 4.4, 5.7, 7].entries()) {
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-ss", String(at),
    "-i", path.join(publicDir, "stock", "feat-cover.mp4"),
    "-frames:v", "1", "-vf", "crop=608:1080:656:0,scale=540:960", "-q:v", "3",
    path.join(publicDir, "frames", `cover-${i}.jpg`),
  ]);
}
await copyFile(path.join(root, "node_modules/next/dist/next-devtools/server/font/geist-latin.woff2"), path.join(publicDir, "body.woff2"));
await copyFile(path.join(root, "public/fonts/NotoSansJP-Bold.woff2"), path.join(publicDir, "caption.woff2"));

const require = createRequire(path.resolve(toolchain, "package.json"));
const { bundle } = require("@remotion/bundler");
const { renderMedia, selectComposition, getCompositions } = require("@remotion/renderer");
const modules = path.resolve(toolchain, "node_modules");
const serveUrl = await bundle({
  entryPoint: path.join(root, "scripts/homepage-media/loops.jsx"),
  publicDir,
  outDir: path.join(film, "loops-bundle"),
  webpackOverride: (c) => ({
    ...c,
    resolve: {
      ...c.resolve,
      modules: [modules, ...(c.resolve.modules || [])],
      alias: {
        ...c.resolve.alias,
        react: path.join(modules, "react"),
        "react-dom": path.join(modules, "react-dom"),
        remotion: path.join(modules, "remotion"),
      },
    },
  }),
});
const browserExecutable =
  process.env.REMOTION_BROWSER || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const base = { serveUrl, browserExecutable };
const wanted = process.argv.slice(2);
const ids = (await getCompositions(serveUrl, { browserExecutable }))
  .map((c) => c.id)
  .filter((id) => !wanted.length || wanted.includes(id));

await mkdir(outDir, { recursive: true });
for (const id of ids) {
  const composition = await selectComposition({ ...base, id });
  const master = path.join(outDir, `${id}.master.mp4`);
  await renderMedia({
    ...base,
    composition,
    codec: "h264",
    pixelFormat: "yuv420p",
    crf: 16,
    concurrency: 4,
    outputLocation: master,
  });
  const vertical = composition.height > composition.width;
  // Web delivery: silent, faststart, feature loops downscaled to 1280 wide.
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-i", master,
    ...(vertical ? [] : ["-vf", "scale=1280:-2:flags=lanczos"]),
    "-c:v", "libx264", "-preset", "slow", "-crf", vertical ? "26" : "25",
    "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart",
    path.join(outDir, `${id}.mp4`),
  ]);
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y", "-ss", "1", "-i", path.join(outDir, `${id}.mp4`),
    "-frames:v", "1", "-q:v", "3", path.join(outDir, `${id}.jpg`),
  ]);
  console.log(`Rendered ${id}`);
}

// Workflow and audience media are plain trims of stock clips, no overlays.
// Crops are [x offset in the 1920×1080 source]; one person per section.
if (!wanted.length || wanted.includes("sections")) {
  const ff = (args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
  const src = (name) => path.join(film, "stock", `${name}.mp4`);
  const out = (name) => path.join(outDir, name);
  const web = ["-c:v", "libx264", "-preset", "slow", "-crf", "27", "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart"];
  ff(["-ss", "0", "-t", "6", "-i", src("flow-source"), "-vf", "scale=640:360,fps=30", ...web, out("workflow-source.mp4")]);
  ff(["-ss", "1", "-i", out("workflow-source.mp4"), "-frames:v", "1", "-q:v", "3", out("workflow-source.jpg")]);
  for (const [i, [at, left]] of [[2, 906], [7, 906], [12, 1060]].entries()) {
    ff(["-ss", String(at), "-i", src("flow-source"), "-frames:v", "1", "-vf", `crop=608:1080:${left}:0,scale=160:284`, "-q:v", "3", out(`workflow-clip-${i}.jpg`)]);
  }
  for (const [name, clip, start, left] of [
    ["creators", "use-fitness", 0, 231],
    ["podcasters", "use-podcast", 10, 327],
    ["teams", "use-business", 4, 135],
  ]) {
    ff(["-ss", String(start), "-t", "8", "-i", src(clip), "-vf", `crop=1458:1080:${left}:0,scale=810:600,fps=30`, ...web, out(`audience-${name}.mp4`)]);
    ff(["-ss", "1", "-i", out(`audience-${name}.mp4`), "-frames:v", "1", "-q:v", "3", out(`audience-${name}.jpg`)]);
  }
  console.log("Rendered sections");
}
