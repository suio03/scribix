import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const publicEnv = loadPublicEnv(".dev.vars", [
  "NEXT_PUBLIC_PADDLE_ENV",
  "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN",
]);

const env = { ...process.env, ...publicEnv };

run("npx", ["opennextjs-cloudflare", "build"], env);
run("npx", ["opennextjs-cloudflare", "deploy"], env);

function run(command, args, env) {
  const result = spawnSync(command, args, {
    env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function loadPublicEnv(path, names) {
  const parsed = parseEnv(readFileSync(path, "utf8"));
  const values = {};

  for (const name of names) {
    const value = parsed[name]?.trim();
    if (!value) {
      throw new Error(`Missing ${name} in ${path}`);
    }
    values[name] = value;
  }

  return values;
}

function parseEnv(text) {
  const values = {};

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1);
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }

  return values;
}
