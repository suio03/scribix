import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const SOURCE_DIR = "chrome-extension-youtube-transcript";
const BUILD_ROOT = ".extension-build";
const LOCAL_API_BASE = "http://localhost:3000";
const PROD_API_BASE = "https://scribix.io";
const TARGETS = ["chrome", "edge", "firefox"];

const firstArg = process.argv[2];
const secondArg = process.argv[3];
const shouldZip = process.argv.includes("--zip");
const legacyUsage = firstArg === "local" || firstArg === "prod";
const target = legacyUsage ? "chrome" : firstArg;
const mode = legacyUsage ? firstArg : secondArg;

if (
  (!TARGETS.includes(target) && target !== "all") ||
  (mode !== "local" && mode !== "prod")
) {
  console.error(
    "Usage: node scripts/build-extension.mjs [chrome|edge|firefox|all] <local|prod> [--zip]"
  );
  console.error("Legacy Chrome usage remains supported: <local|prod> [--zip]");
  process.exit(1);
}

const buildTargets = target === "all" ? TARGETS : [target];
for (const buildTarget of buildTargets) {
  buildExtension(buildTarget, mode, shouldZip);
}

function buildExtension(buildTarget, buildMode, zip) {
  const outDir = join(BUILD_ROOT, buildTarget, buildMode);

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  copyExtensionSource(SOURCE_DIR, outDir);

  const manifestPath = join(outDir, "manifest.json");
  const backgroundPath = join(outDir, "background.js");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  if (buildMode === "local") {
    rewriteApiBase(backgroundPath, LOCAL_API_BASE);
    manifest.host_permissions = unique([
      ...(manifest.host_permissions ?? []),
      `${LOCAL_API_BASE}/*`,
    ]);
  } else {
    rewriteApiBase(backgroundPath, PROD_API_BASE);
    manifest.host_permissions = (manifest.host_permissions ?? []).filter(
      (permission) => !permission.includes("localhost")
    );
  }

  configureManifest(manifest, buildTarget);
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  validateBuild(outDir, buildMode, buildTarget, manifest);

  if (zip) {
    const zipName = zipFilename(buildTarget, manifest.version);
    const zipPath = join(process.cwd(), zipName);
    rmSync(zipPath, { force: true });
    run("zip", ["-r", zipPath, "."], outDir);
    console.log(`Created ${zipName}`);
  } else {
    console.log(`Built ${outDir}`);
  }
}

function configureManifest(manifest, buildTarget) {
  if (buildTarget !== "firefox") return;

  manifest.background = {
    scripts: ["background.js"],
  };
  manifest.browser_specific_settings = {
    gecko: {
      id: "youtube-transcript@scribix.io",
      strict_min_version: "140.0",
      data_collection_permissions: {
        required: [
          "authenticationInfo",
          "browsingActivity",
          "websiteContent",
        ],
      },
    },
    gecko_android: {
      strict_min_version: "142.0",
    },
  };
}

function zipFilename(buildTarget, version) {
  if (buildTarget === "chrome") {
    return `scribix-youtube-transcript-extension-${version}.zip`;
  }
  return `scribix-youtube-transcript-${buildTarget}-extension-${version}.zip`;
}

function copyExtensionSource(sourceDir, targetDir) {
  cpSync(sourceDir, targetDir, {
    recursive: true,
    filter: (source) => {
      const name = source.split(/[/\\]/).pop();
      return name !== "README.md" && name !== ".DS_Store";
    },
  });
}

function rewriteApiBase(filePath, apiBase) {
  const source = readFileSync(filePath, "utf8");
  const next = source.replace(
    /^const API_BASE = ".*";$/m,
    `const API_BASE = "${apiBase}";`
  );
  if (!next.includes(`const API_BASE = "${apiBase}";`)) {
    throw new Error(`Could not rewrite API_BASE in ${filePath}`);
  }
  writeFileSync(filePath, next);
}

function validateBuild(dir, buildMode, buildTarget, manifest) {
  const files = listTextFiles(dir);
  const text = files.map((file) => readFileSync(file, "utf8")).join("\n");

  if (buildMode === "prod" && /localhost|ngrok|http:\/\//i.test(text)) {
    throw new Error("Production extension build contains localhost, ngrok, or http://");
  }
  if (buildMode === "local" && !text.includes(LOCAL_API_BASE)) {
    throw new Error("Local extension build does not point to localhost");
  }
  if (buildTarget === "firefox") {
    if (!Array.isArray(manifest.background?.scripts)) {
      throw new Error("Firefox build must declare background.scripts");
    }
    if (manifest.background?.service_worker) {
      throw new Error("Firefox build must not declare background.service_worker");
    }
    if (!manifest.browser_specific_settings?.gecko?.id) {
      throw new Error("Firefox build must declare a Gecko extension ID");
    }
  } else if (!manifest.background?.service_worker) {
    throw new Error(`${buildTarget} build must declare background.service_worker`);
  }

  run("node", ["--check", join(dir, "background.js")]);
  run("node", ["--check", join(dir, "content.js")]);
}

function listTextFiles(dir) {
  const files = [];
  collect(dir);
  return files.filter((file) => /\.(js|json|css|html|txt)$/i.test(file));

  function collect(current) {
    const result = spawnSync("find", [current, "-type", "f"], { encoding: "utf8" });
    if (result.status !== 0) {
      throw new Error(result.stderr || `Failed to list ${current}`);
    }
    files.push(...result.stdout.trim().split("\n").filter(Boolean));
  }
}

function unique(values) {
  return Array.from(new Set(values));
}

function run(command, args, cwd = process.cwd()) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}
