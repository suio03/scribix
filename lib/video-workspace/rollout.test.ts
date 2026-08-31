import assert from "node:assert/strict";
import test from "node:test";
import { stableBucket, videoWorkspaceEnabledForUser } from "./rollout";

test("video workspace rollout is stable, bounded, and pilot-overridable", () => {
  const userId = "user-rollout-fixture";
  assert.equal(stableBucket(userId), stableBucket(userId));
  assert.ok(stableBucket(userId) >= 0 && stableBucket(userId) < 100);
  assert.equal(videoWorkspaceEnabledForUser(userId, {
    VIDEO_WORKSPACE_ROLLOUT_PERCENT: "0",
    VIDEO_WORKSPACE_PILOT_USER_IDS: "pilot-1,user-rollout-fixture",
  }), true);
  assert.equal(videoWorkspaceEnabledForUser(userId, {
    VIDEO_WORKSPACE_ROLLOUT_PERCENT: "0",
    VIDEO_WORKSPACE_PILOT_USER_IDS: "pilot-1",
  }), false);
  assert.equal(videoWorkspaceEnabledForUser(userId, {
    VIDEO_WORKSPACE_ROLLOUT_PERCENT: "100",
    VIDEO_WORKSPACE_PILOT_USER_IDS: "",
  }), true);
});
