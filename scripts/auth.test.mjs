import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

let callbacks;
const source = readFileSync(new URL("../auth.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const imports = {
  "next-auth": { default(config) { callbacks = config.callbacks; return {}; } },
  "next-auth/providers/google": { default: (config) => config },
  "next-auth/providers/credentials": { default: (config) => config },
  "@opennextjs/cloudflare": {},
};
vm.runInNewContext(outputText, {
  exports: {}, process: { env: {} },
  require(name) {
    assert.ok(name in imports, `Unexpected import: ${name}`);
    return imports[name];
  },
});

test("Google OAuth keeps the database identity instead of Auth.js generated ID", async () => {
  const token = await callbacks.jwt({
    token: { sub: "generated-uuid" },
    profile: { sub: "google-sub" },
    user: { id: "generated-uuid" },
  });
  const session = await callbacks.session({ session: { user: {} }, token });
  assert.equal(session.user.id, "google-sub");
});

test("One Tap identity survives subsequent session refreshes", async () => {
  const token = await callbacks.jwt({ token: {}, user: { id: "google-sub" } });
  const refreshed = await callbacks.jwt({ token });
  const session = await callbacks.session({ session: { user: {} }, token: refreshed });
  assert.equal(session.user.id, "google-sub");
});
