import { execFileSync } from "node:child_process";
import path from "node:path";
const root = process.cwd();
{
  const delivery = path.join(root, "public/media/home-demo");
  execFileSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-i",
    path.join(delivery, "scribix-hero-v5.mp4"),
    "-c",
    "copy",
    "-an",
    "-movflags",
    "+faststart",
    path.join(root, ".artifacts/homepage-film/delivery.mp4"),
  ]);
  const { copyFile } = await import("node:fs/promises");
  await copyFile(
    path.join(root, ".artifacts/homepage-film/delivery.mp4"),
    path.join(delivery, "scribix-hero-v5.mp4"),
  );
  execFileSync("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-y",
    "-ss",
    "1",
    "-i",
    path.join(delivery, "scribix-hero-v5.mp4"),
    "-frames:v",
    "1",
    "-q:v",
    "2",
    path.join(delivery, "scribix-hero-v5.jpg"),
  ]);
}
