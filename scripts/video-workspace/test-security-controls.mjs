import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "../..");
const dockerfile = await readFile(join(root, "containers/video-preview/Dockerfile"), "utf8");
assert.match(dockerfile, /^FROM .+@sha256:[a-f0-9]{64}$/m);
assert.match(dockerfile, /^USER node$/m);
assert.match(dockerfile, /ffmpeg="\$\{FFMPEG_VERSION\}"/);

const dispatcherPolicy = JSON.parse(await readFile(
  join(root, "docs/video-workspace/aws/dispatcher-iam-policy.json"),
  "utf8"
));
const dispatcherActions = dispatcherPolicy.Statement.flatMap((statement) => (
  Array.isArray(statement.Action) ? statement.Action : [statement.Action]
));
assert.deepEqual(new Set(dispatcherActions), new Set([
  "batch:SubmitJob",
  "batch:DescribeJobs",
  "batch:TerminateJob",
]));

const executionPolicy = JSON.parse(await readFile(
  join(root, "docs/video-workspace/aws/execution-role-policy.json"),
  "utf8"
));
const executionActions = executionPolicy.Statement.flatMap((statement) => (
  Array.isArray(statement.Action) ? statement.Action : [statement.Action]
));
assert.equal(executionActions.some((action) => action.startsWith("s3:") || action.startsWith("r2:")), false);

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
  dispatcherActions,
  containerHasObjectStoreCredentials: false,
  imageScan,
}));
