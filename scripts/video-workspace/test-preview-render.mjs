import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  probeMedia,
  renderProxy,
} from "../../containers/video-preview/preview-render.mjs";

const directory = mkdtempSync(join(tmpdir(), "scribix-preview-render-"));
const input = join(directory, "source.mp4");
const output = join(directory, "preview.mp4");

try {
  command("ffmpeg", [
    "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30:duration=8",
    "-f", "lavfi", "-i", "sine=frequency=880:sample_rate=48000:duration=8",
    "-c:v", "libx264", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-shortest", "-y", input,
  ]);
  const source = await probeMedia(input);
  await renderProxy({
    input,
    output,
    source,
    segment: {
      proxySourceStartMs: 1_000,
      proxySourceEndMs: 7_000,
    },
  });
  const result = await probeMedia(output);
  assert.equal(result.videoCodec, "h264");
  assert.equal(result.audioCodec, "aac");
  assert.equal(result.width, 1280);
  assert.equal(result.height, 720);
  assert.ok(Math.abs(result.durationMs - 6_000) <= 200, `duration=${result.durationMs}`);
  console.log(JSON.stringify({ event: "preview_render_fixture_passed", ...result }));
} finally {
  rmSync(directory, { recursive: true, force: true });
}

function command(executable, args) {
  const result = spawnSync(executable, args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`${executable}_failed:${result.stderr.slice(0, 500)}`);
  }
}
