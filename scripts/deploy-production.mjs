import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const wranglerVars = loadWranglerVars("wrangler.jsonc");
validateProductionEnv(wranglerVars);

const env = {
  ...process.env,
  ...wranglerVars,
};

run(process.execPath, ["scripts/check-locales.mjs"], env);
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

function loadWranglerVars(path) {
  const config = JSON.parse(stripJsonComments(readFileSync(path, "utf8")));
  return config.vars ?? {};
}

function validateProductionEnv(vars) {
  requireValue(vars, "NEXT_PUBLIC_APP_URL");
  requireValue(vars, "NEXTAUTH_URL");
  requireValue(vars, "EDGE_EXTENSION_ID");
  requireValue(vars, "NEXT_PUBLIC_PADDLE_ENV");
  requireValue(vars, "NEXT_PUBLIC_PADDLE_CLIENT_TOKEN");

  if (!/^[a-p]{32}$/.test(vars.EDGE_EXTENSION_ID)) {
    throw new Error(
      "Production deploy requires a valid 32-character EDGE_EXTENSION_ID in wrangler.jsonc."
    );
  }
  if (vars.NEXT_PUBLIC_PADDLE_ENV !== "production") {
    throw new Error("Production deploy requires NEXT_PUBLIC_PADDLE_ENV=production in wrangler.jsonc.");
  }
  if (!vars.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN.startsWith("live_")) {
    throw new Error("Production deploy requires a live_ NEXT_PUBLIC_PADDLE_CLIENT_TOKEN in wrangler.jsonc.");
  }
}

function requireValue(vars, name) {
  if (!String(vars[name] ?? "").trim()) {
    throw new Error(`Missing ${name} in wrangler.jsonc vars.`);
  }
}

function stripJsonComments(text) {
  let out = "";
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inString) {
      out += char;
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      out += char;
      continue;
    }

    if (char === "/" && next === "/") {
      while (i < text.length && text[i] !== "\n") i += 1;
      out += "\n";
      continue;
    }

    if (char === "/" && next === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i += 1;
      i += 1;
      continue;
    }

    out += char;
  }

  return out;
}
