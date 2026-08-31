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
  "lib/video-workspace/validation.test.ts",
  "lib/video-workspace/job-auth.test.ts",
  "lib/video-workspace/timeline.test.ts",
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
      "--outDir",
      outputDirectory,
    ],
    { cwd: root, encoding: "utf8" }
  );
  if (compile.stdout) process.stdout.write(compile.stdout);
  if (compile.stderr) process.stderr.write(compile.stderr);
  if (compile.status !== 0) process.exit(compile.status ?? 1);

  const testFiles = [
    join(outputDirectory, "validation.test.js"),
    join(outputDirectory, "job-auth.test.js"),
    join(outputDirectory, "timeline.test.js"),
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
