import assert from "node:assert/strict";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "../..");
const image = process.env.VIDEO_RENDER_IMAGE || "scribix-video-render:local";
const result = spawnSync("docker", [
  "run", "--rm",
  "-v", `${root}:/workspace`,
  "-w", "/workspace",
  "--entrypoint", "node",
  image,
  "scripts/video-workspace/benchmark-render-suite.mjs",
], { stdio: "inherit" });
assert.equal(result.status, 0, `render benchmark failed in ${image}`);
