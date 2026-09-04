import assert from "node:assert/strict";
import test from "node:test";
import { videoWorkspaceAccessFor } from "./access";

test("Free cannot use editing or brand controls", () => {
  assert.deepEqual(videoWorkspaceAccessFor("free"), {
    canEditClips: false,
    canUseBrandControls: false,
  });
});

test("paid plans retain editing and brand controls", () => {
  for (const tier of ["basic", "pro"] as const) {
    assert.deepEqual(videoWorkspaceAccessFor(tier), {
      canEditClips: true,
      canUseBrandControls: true,
    });
  }
});
