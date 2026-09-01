import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveUploadWorkflow,
  videoSourceStorageUpgradeFor,
} from "./upload-policy";

test("all video uploads require the retained-source workflow", () => {
  assert.equal(resolveUploadWorkflow(undefined, true), "video_clips");
  assert.equal(resolveUploadWorkflow("transcript", true), "video_clips");
  assert.equal(resolveUploadWorkflow(undefined, false), "transcript");
  assert.equal(resolveUploadWorkflow("video_clips", false), "video_clips");
});

test("video storage limits offer Pro only when an upgrade exists", () => {
  assert.deepEqual(videoSourceStorageUpgradeFor("free"), {
    canUpgrade: true,
    suggestedTier: "pro",
  });
  assert.deepEqual(videoSourceStorageUpgradeFor("basic"), {
    canUpgrade: true,
    suggestedTier: "pro",
  });
  assert.deepEqual(videoSourceStorageUpgradeFor("pro"), { canUpgrade: false });
});
