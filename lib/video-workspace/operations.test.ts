import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateRenderCost,
  parseRenderCostRates,
  percentile,
  renderErrorCategory,
} from "./operations";

test("render costs use the configured model and fixed resource profile", () => {
  const rates = parseRenderCostRates({
    VIDEO_RENDER_VCPU_MICROUSD_PER_HOUR: "40000",
    VIDEO_RENDER_MEMORY_GB_MICROUSD_PER_HOUR: "5000",
    VIDEO_RENDER_PER_JOB_MICROUSD: "100",
    VIDEO_RENDER_COST_MODEL: "fixture-v1",
  });
  assert.ok(rates);
  assert.equal(estimateRenderCost("final", 60_000, rates), 1_017);
  assert.equal(parseRenderCostRates({}), null);
});

test("metrics percentiles and stable error categories are deterministic", () => {
  assert.equal(percentile([500, 100, 300, 200, 400], 0.5), 300);
  assert.equal(percentile([500, 100, 300, 200, 400], 0.95), 500);
  assert.equal(percentile([], 0.95), null);
  assert.equal(renderErrorCategory("invalid_source"), "input");
  assert.equal(renderErrorCategory("upload_failed"), "storage");
  assert.equal(renderErrorCategory("provider_unavailable"), "provider");
  assert.equal(renderErrorCategory("render_failed"), "renderer");
});
