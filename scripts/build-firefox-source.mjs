import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const SOURCE_DIR = "chrome-extension-youtube-transcript";
const BUILD_SCRIPT = "scripts/build-extension.mjs";
const BUILD_README = "docs/firefox-extension-source-readme.md";
const manifest = JSON.parse(
  readFileSync(join(SOURCE_DIR, "manifest.json"), "utf8")
);
const archiveName =
  `scribix-youtube-transcript-firefox-source-${manifest.version}.zip`;
const archivePath = join(process.cwd(), archiveName);
const temporaryRoot = mkdtempSync(join(tmpdir(), "scribix-firefox-source-"));
const stagingDir = join(temporaryRoot, "source");

try {
  mkdirSync(join(stagingDir, "scripts"), { recursive: true });
  cpSync(SOURCE_DIR, join(stagingDir, SOURCE_DIR), {
    recursive: true,
    filter: (source) => {
      const name = source.split(/[/\\]/).pop();
      return name !== "README.md" && name !== ".DS_Store";
    },
  });
  cpSync(BUILD_SCRIPT, join(stagingDir, BUILD_SCRIPT));
  cpSync(BUILD_README, join(stagingDir, "README.md"));

  rmSync(archivePath, { force: true });
  run("zip", ["-r", archivePath, "."], stagingDir);
  console.log(`Created ${archiveName}`);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
