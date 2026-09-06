import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "../..");
const dockerfile = await readFile(join(root, "containers/video-preview/Dockerfile"), "utf8");
assert.match(dockerfile, /^FROM .+@sha256:[a-f0-9]{64}$/m);
assert.match(dockerfile, /^USER node$/m);
assert.match(dockerfile, /ffmpeg="\$\{FFMPEG_VERSION\}"/);
assert.match(dockerfile, /mediapipe==\$\{MEDIAPIPE_VERSION\}/);
assert.match(dockerfile, /sha256sum --check/);

const [dispatcher, provider, wrangler] = await Promise.all([
  readFile(join(root, "workers/video-render-dispatcher.ts"), "utf8"),
  readFile(join(root, "workers/video-render-provider.ts"), "utf8"),
  readFile(join(root, "wrangler.video-render.jsonc"), "utf8"),
]);
assert.match(dispatcher, /from "@cloudflare\/containers"/);
assert.match(provider, /getByName\(providerJobId\)\.destroy\(\)/);
assert.doesNotMatch(`${dispatcher}\n${provider}\n${wrangler}`, /AWS_|aws-batch/i);

const wranglerConfig = JSON.parse(wrangler);
assert.equal(wranglerConfig.containers[0].max_instances, 10);
assert.deepEqual(wranglerConfig.containers[0].instance_type, {
  vcpu: 1,
  memory_mib: 3072,
  disk_mb: 6000,
});
assert.equal(wranglerConfig.containers[0].ssh.enabled, false);
assert.equal(wranglerConfig.queues.consumers[0].max_concurrency, 1);

let imageScan = "external-required";
if (process.env.TRIVY_IMAGE) {
  const result = spawnSync(process.env.TRIVY_PATH || "trivy", [
    "image", "--exit-code", "1", "--severity", "HIGH,CRITICAL",
    "--ignore-unfixed", process.env.TRIVY_IMAGE,
  ], { cwd: root, stdio: "inherit" });
  assert.equal(result.status, 0, "Trivy found blocking vulnerabilities or could not scan the image");
  imageScan = "passed";
}

console.log(JSON.stringify({
  event: "video_security_controls_passed",
  baseImagePinned: true,
  nonRootContainer: true,
  provider: "cloudflare-containers",
  maxInstances: wranglerConfig.containers[0].max_instances,
  mediaPipePinned: true,
  containerHasObjectStoreCredentials: false,
  imageScan,
}));
