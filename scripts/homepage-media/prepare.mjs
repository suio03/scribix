// Prepares the Hero's inputs from three Pexels clips of one cottonbro studio
// interview (https://www.pexels.com/license/): 6878732 (wide two-shot, 4096×2160),
// 6883839 (guest, 2160×4096) and 6883833 (host, 2160×4096).
// Usage: node scripts/homepage-media/prepare.mjs /path/to/downloaded/clips
import { copyFile, mkdir, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";

const source = process.argv[2];
if (!source)
  throw new Error(
    "Usage: node scripts/homepage-media/prepare.mjs /path/to/clips",
  );
const destination = path.resolve(".artifacts/homepage-film/public");
await mkdir(destination, { recursive: true });
const files = await readdir(source);
const find = (id) => {
  const name = files.find(
    (file) => file.startsWith(`${id}-`) && file.endsWith(".mp4"),
  );
  if (!name) throw new Error(`Missing Pexels ${id} in ${source}`);
  return path.join(source, name);
};

// [output, Pexels id, start s, length s, filter]. The guest crop is a plain
// full-height 9:16 window of the wide shot, the same framing Scribix produces.
const encode = ["-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-an"];
for (const [name, id, start, length, filter] of [
  ["source", 6878732, 0, 20, "scale=1920:1080"],
  ["short-guest", 6883839, 0, 8, "scale=1080:1920"],
  ["short-host", 6883833, 5, 8, "scale=1080:1920"],
  ["short-crop", 6878732, 6, 8, "crop=1215:2160:2700:0,scale=1080:1920"],
]) {
  execFileSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    String(start),
    "-t",
    String(length),
    "-i",
    find(id),
    "-vf",
    `${filter},fps=30`,
    ...encode,
    path.join(destination, `${name}.mp4`),
  ]);
}
await copyFile(
  path.resolve(
    "node_modules/next/dist/next-devtools/server/font/geist-latin.woff2",
  ),
  path.join(destination, "body.woff2"),
);
await copyFile(
  path.resolve("public/fonts/NotoSansJP-Bold.woff2"),
  path.join(destination, "caption.woff2"),
);
await copyFile(
  path.resolve("public/youtube-icon.png"),
  path.join(destination, "youtube.png"),
);
await copyFile(
  path.resolve("public/brand/linkedin.png"),
  path.join(destination, "linkedin.png"),
);
