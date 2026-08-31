import assert from "node:assert/strict";
import test from "node:test";

import { createScopedJobToken, verifyScopedJobToken } from "./job-auth";

test("worker tokens are deterministic and scoped to one render job", async () => {
  const token = await createScopedJobToken("test-secret", "job_01");
  assert.equal(await verifyScopedJobToken("test-secret", "job_01", token), true);
  assert.equal(await verifyScopedJobToken("test-secret", "job_02", token), false);
  assert.equal(await verifyScopedJobToken("wrong-secret", "job_01", token), false);
  assert.equal(await verifyScopedJobToken("test-secret", "job_01", "not+a+token"), false);
});
