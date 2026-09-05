import assert from "node:assert/strict";
import test from "node:test";
import { validateClientEventProperties } from "./events";

test("pilot event properties reject free text and unknown fields", () => {
  assert.deepEqual(validateClientEventProperties("editor_opened", {}), {});
  assert.deepEqual(validateClientEventProperties("edit_saved", {
    elapsedMs: 12_000,
    revision: 3,
    segmentCount: 2,
  }), { elapsedMs: 12_000, revision: 3, segmentCount: 2 });
  assert.equal(validateClientEventProperties("edit_saved", {
    elapsedMs: 12_000,
    revision: 3,
    segmentCount: 2,
    transcript: "private content",
  }), null);
  assert.deepEqual(validateClientEventProperties("render_downloaded", { assetKind: "video" }), {
    assetKind: "video",
  });
  assert.deepEqual(validateClientEventProperties("render_downloaded", { assetKind: "package" }), {
    assetKind: "package",
  });
  assert.equal(validateClientEventProperties("external_edit_required", { reason: "free text" }), null);
});
