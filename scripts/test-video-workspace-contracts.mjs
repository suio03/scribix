import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const outputDirectory = mkdtempSync(join(tmpdir(), "scribix-video-workspace-contracts-"));
const tsc = resolve(root, "node_modules/.bin/tsc");
const sources = [
  "lib/video-workspace/contracts.ts",
  "lib/video-workspace/candidate-generation.ts",
  "lib/video-workspace/validation.ts",
  "lib/video-workspace/source-policy.ts",
  "lib/video-workspace/r2-keys.ts",
  "lib/video-workspace/job-auth.ts",
  "lib/video-workspace/timeline.ts",
  "lib/video-workspace/presentation.ts",
  "lib/video-workspace/operations.ts",
  "lib/video-workspace/asset-content.ts",
  "lib/video-workspace/events.ts",
  "lib/video-workspace/rollout.ts",
  "lib/video-workspace/upload-policy.ts",
  "lib/upload-preflight.ts",
  "lib/video-workspace/validation.test.ts",
  "lib/video-workspace/job-auth.test.ts",
  "lib/video-workspace/timeline.test.ts",
  "lib/video-workspace/presentation.test.ts",
  "lib/video-workspace/operations.test.ts",
  "lib/video-workspace/asset-content.test.ts",
  "lib/video-workspace/events.test.ts",
  "lib/video-workspace/rollout.test.ts",
  "lib/video-workspace/upload-policy.test.ts",
  "lib/upload-preflight.test.ts",
];

try {
  const compile = spawnSync(
    tsc,
    [
      ...sources,
      "--module",
      "commonjs",
      "--moduleResolution",
      "node",
      "--target",
      "es2022",
      "--esModuleInterop",
      "--skipLibCheck",
      "--types",
      "node,@cloudflare/workers-types",
      "--rootDir",
      "lib",
      "--outDir",
      outputDirectory,
    ],
    { cwd: root, encoding: "utf8" }
  );
  if (compile.stdout) process.stdout.write(compile.stdout);
  if (compile.stderr) process.stderr.write(compile.stderr);
  if (compile.status !== 0) process.exit(compile.status ?? 1);

  const testFiles = [
    join(outputDirectory, "video-workspace/validation.test.js"),
    join(outputDirectory, "video-workspace/job-auth.test.js"),
    join(outputDirectory, "video-workspace/timeline.test.js"),
    join(outputDirectory, "video-workspace/presentation.test.js"),
    join(outputDirectory, "video-workspace/operations.test.js"),
    join(outputDirectory, "video-workspace/asset-content.test.js"),
    join(outputDirectory, "video-workspace/events.test.js"),
    join(outputDirectory, "video-workspace/rollout.test.js"),
    join(outputDirectory, "video-workspace/upload-policy.test.js"),
    join(outputDirectory, "upload-preflight.test.js"),
  ];
  const run = spawnSync(process.execPath, ["--test", ...testFiles], {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
  });
  process.exitCode = run.status ?? 1;
} finally {
  rmSync(outputDirectory, { recursive: true, force: true });
}
