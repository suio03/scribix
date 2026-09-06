import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

test("production explicitly overrides OpenNext's bundled local polling default", () => {
  const config = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const { vars } = vm.runInNewContext(`(${config})`);
  assert.equal(vars.ASSEMBLYAI_COMPLETION_MODE, "webhook");
});

// Exercise the actual server modules with isolated env, provider, and bindings.
function loadModule(path, globals = {}, imports = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports, Response, AbortSignal,
    require(name) {
      assert.ok(name in imports, `Unexpected import: ${name}`);
      return imports[name];
    },
    ...globals,
  }, { filename: path });
  return exports;
}

for (const mode of [undefined, "webhook", "polling"]) {
  test(`submission in ${mode ?? "default"} mode sends the expected callback fields`, async () => {
    let sent;
    const aai = loadModule("lib/aai.ts", {
      process: { env: { ASSEMBLYAI_COMPLETION_MODE: mode, ASSEMBLYAI_API_KEY: "test-key" } },
      fetch: async (_url, init) => {
        sent = JSON.parse(init.body);
        return Response.json({ id: "aai-existing", status: "queued" });
      },
    });
    const body = {
      audio_url: "https://media.example/source.mp4",
      speech_models: ["universal-2"],
      speaker_labels: true,
      webhook_url: "https://old-tunnel.example/api/webhook/assemblyai",
      webhook_auth_header_name: "X-Scribix-Token",
      webhook_auth_header_value: "test-token",
    };
    const result = await aai.submitTranscript(body);
    assert.equal(result.transcript.id, "aai-existing");
    const expected = { ...body };
    if (mode === "polling") {
      delete expected.webhook_url;
      delete expected.webhook_auth_header_name;
      delete expected.webhook_auth_header_value;
    }
    assert.deepEqual(sent, expected);
    assert.equal(body.webhook_auth_header_value, "test-token", "caller input is unchanged");
  });
}

function statusFixture({ mode, ageMinutes = 0, status = "queued", providerStatus = "completed",
  owner = "user-1", providerFails = false, hasAaiId = true } = {}) {
  const row = {
    id: "transcript-1", user_id: owner, status,
    aai_transcript_id: hasAaiId ? "aai-existing" : null,
    created_at: new Date(Date.now() - ageMinutes * 60_000).toISOString().slice(0, 19).replace("T", " "),
    error: null, completed_at: null,
  };
  const calls = { provider: 0, apply: 0 };
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind() { return this; },
          async first() { return { ...row }; },
          async run() {
            assert.ok(sql.includes("SET status = 'processing'"));
            row.status = "processing";
            return { meta: { changes: 1 } };
          },
        };
      },
    },
  };
  const aai = loadModule("lib/aai.ts", {
    process: { env: { ASSEMBLYAI_COMPLETION_MODE: mode, ASSEMBLYAI_API_KEY: "test-key" } },
    fetch: async (url) => {
      calls.provider += 1;
      assert.equal(url, "https://api.assemblyai.com/v2/transcript/aai-existing");
      if (providerFails) throw new Error("temporary network failure");
      return Response.json({ id: "aai-existing", status: providerStatus });
    },
  });
  const route = loadModule("app/api/transcripts/[id]/status/route.ts", {}, {
    "@/auth": { auth: async () => ({ user: { id: "user-1" } }) },
    "@/lib/aai": aai,
    "@/lib/cf": { cf: async () => env },
    "@/lib/current-user": { getOrCreateCurrentUser: async () => ({ id: "user-1" }) },
    "@/lib/discord": { discordAlert: async () => assert.fail("Unexpected alert") },
    "@/lib/quota": { reconcileQuota: async () => assert.fail("Unexpected refund") },
    "@/lib/aai-result": {
      applyAaiResult: async (bindings, transcript, result) => {
        calls.apply += 1;
        assert.equal(bindings, env);
        assert.equal(transcript.id, row.id);
        row.status = result.status;
      },
    },
  });
  return {
    calls,
    run: () => route.GET(new Request("http://localhost/api/transcripts/transcript-1/status"), {
      params: Promise.resolve({ id: row.id }),
    }),
  };
}

for (const status of ["queued", "processing", "completed", "error"]) {
  test(`local polling handles provider ${status} immediately using the existing job`, async () => {
    const fixture = statusFixture({ mode: "polling", providerStatus: status });
    const response = await fixture.run();
    assert.equal((await response.json()).status, status);
    assert.equal(fixture.calls.provider, 1);
    assert.equal(fixture.calls.apply, ["completed", "error"].includes(status) ? 1 : 0);
  });
}

for (const mode of [undefined, "webhook"]) {
  test(`${mode ?? "default"} mode preserves the 15-minute recovery window`, async () => {
    const fresh = statusFixture({ mode });
    assert.equal((await (await fresh.run()).json()).status, "queued");
    assert.equal(fresh.calls.provider, 0);
    const stale = statusFixture({ mode, ageMinutes: 16 });
    assert.equal((await (await stale.run()).json()).status, "completed");
    assert.equal(stale.calls.apply, 1);
  });
}

test("terminal jobs and jobs without an AAI ID never query the provider", async () => {
  for (const options of [{ status: "completed" }, { status: "error" }, { hasAaiId: false }]) {
    const fixture = statusFixture({ mode: "polling", ...options });
    await fixture.run();
    assert.equal(fixture.calls.provider, 0);
    assert.equal(fixture.calls.apply, 0);
  }
});

test("other users cannot trigger provider polling or result application", async () => {
  const fixture = statusFixture({ mode: "polling", owner: "another-user" });
  assert.equal((await fixture.run()).status, 403);
  assert.equal(fixture.calls.provider, 0);
  assert.equal(fixture.calls.apply, 0);
});

test("transient provider failure preserves status for the next poll", async () => {
  const fixture = statusFixture({ mode: "polling", providerFails: true });
  assert.equal((await (await fixture.run()).json()).status, "queued");
  assert.equal(fixture.calls.apply, 0);
  await fixture.run();
  assert.equal(fixture.calls.provider, 2);
});
