import { mkdir, copyFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
const source = process.argv[2];
if (!source)
  throw new Error(
    "Usage: node scripts/homepage-media/prepare.mjs /path/to/scribix-hero-visual/assets",
  );
const destination = path.resolve(".artifacts/homepage-film/public");
await mkdir(destination, { recursive: true });
for (const asset of [
  "source-sync.mp4",
  "clip1.mp4",
  "clip3.mp4",
  "clip4.mp4",
  "body.ttf",
]) {
  await copyFile(path.join(source, asset), path.join(destination, asset));
}
for (const [name, time] of [
  ["source-sync", 7.8],
  ["clip1", 24],
  ["clip3", 4],
  ["clip4", 10],
]) {
  execFileSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    String(time),
    "-i",
    path.join(destination, `${name}.mp4`),
    "-frames:v",
    "1",
    "-q:v",
    "2",
    path.join(destination, `${name}.jpg`),
  ]);
}
for (const name of ["podcast", "cooking", "travel", "design"]) {
  await copyFile(
    path.resolve(`public/media/home-artwork/${name}.webp`),
    path.join(destination, `${name}.webp`),
  );
}
await copyFile(
  path.resolve("public/youtube-icon.png"),
  path.join(destination, "youtube.png"),
);
await copyFile(
  path.resolve("public/brand/linkedin.png"),
  path.join(destination, "linkedin.png"),
);
