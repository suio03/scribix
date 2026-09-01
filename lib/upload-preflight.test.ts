import assert from "node:assert/strict";
import test from "node:test";
import { ONE_GIB } from "./plans";
import { validateUploadPreflight } from "./upload-preflight";

test("every accepted video uses direct upload so the source can be retained", () => {
  assert.deepEqual(validateUploadPreflight({
    filename: "interview.mp4",
    bytes: 250 * 1024 * 1024,
    mime: "video/mp4",
    durationSec: 1_800,
    isVideo: true,
  }, "free"), { pipeline: "direct_video" });

  assert.deepEqual(validateUploadPreflight({
    filename: "interview.mp4",
    bytes: ONE_GIB + 1,
    mime: "video/mp4",
    durationSec: 1_800,
    isVideo: true,
  }, "free"), { pipeline: "direct_video", fallbackReason: "over_1gb" });
});

test("audio uploads keep the existing single-upload transcription path", () => {
  assert.deepEqual(validateUploadPreflight({
    filename: "interview.mp3",
    bytes: 20 * 1024 * 1024,
    mime: "audio/mpeg",
    durationSec: 1_800,
    isVideo: false,
  }, "free"), { pipeline: "extracted_audio" });
});
