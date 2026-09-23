import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(path) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, Date, Math, require() {
    throw new Error("Unexpected runtime import");
  } });
  return exports;
}

const plans = load("lib/plans.ts");
const paddle = load("lib/paddle-plans.ts");
const periods = load("lib/quota-period.ts");
const priceEnv = {
  PADDLE_BASIC_MONTHLY_PRICE_ID: "legacy-starter-monthly",
  PADDLE_BASIC_YEARLY_PRICE_ID: "legacy-starter-yearly",
  PADDLE_PRO_MONTHLY_PRICE_ID: "legacy-pro-monthly",
  PADDLE_PRO_YEARLY_PRICE_ID: "legacy-pro-yearly",
  PADDLE_HISTORICAL_PRO_MONTHLY_PRICE_ID: "historical-pro-monthly",
  PADDLE_HISTORICAL_PRO_YEARLY_PRICE_ID: "historical-pro-yearly",
  PADDLE_V2_STARTER_MONTHLY_PRICE_ID: "v2-starter-monthly",
  PADDLE_V2_STARTER_YEARLY_PRICE_ID: "v2-starter-yearly",
  PADDLE_V2_PRO_MONTHLY_PRICE_ID: "v2-pro-monthly",
  PADDLE_V2_PRO_YEARLY_PRICE_ID: "v2-pro-yearly",
};

test("price IDs identify their tier, cycle and version without replacing legacy renewals", () => {
  for (const [id, tier, cycle, version] of [
    ["legacy-starter-monthly", "basic", "monthly", "legacy"],
    ["legacy-pro-yearly", "pro", "yearly", "legacy"],
    ["historical-pro-monthly", "pro", "monthly", "legacy"],
    ["v2-starter-yearly", "basic", "yearly", "v2"],
    ["v2-pro-monthly", "pro", "monthly", "v2"],
  ]) {
    const result = paddle.findPaddlePlanByPriceId(priceEnv, id);
    assert.equal(result.tier, tier);
    assert.equal(result.cycle, cycle);
    assert.equal(result.version, version);
  }
  assert.equal(paddle.getV2PaddlePlan(priceEnv, "basic", "monthly").priceId, "v2-starter-monthly");
  assert.equal(paddle.findPaddlePlanByPriceId(priceEnv, "unknown"), null);
});

test("v2 allowances differ from legacy without changing existing subscriptions", () => {
  assert.equal(plans.quotaMinutesFor("basic", "yearly"), 7200);
  assert.equal(plans.quotaMinutesFor("pro", "monthly"), 2400);
  assert.equal(plans.aiQuestionsFor("basic", "monthly"), 3);
  assert.equal(plans.youtubeImportsFor("basic", "monthly"), 100);
  assert.equal(plans.quotaMinutesFor("basic", "yearly", "v2"), 600);
  assert.equal(plans.quotaMinutesFor("pro", "yearly", "v2"), 1800);
  assert.equal(plans.aiQuestionsFor("basic", "yearly", "v2"), 100);
  assert.equal(plans.youtubeImportsFor("basic", "yearly", "v2"), 500);
  assert.equal(plans.socialAccountLimitFor("basic", "v2"), 6);
  assert.equal(plans.socialAccountLimitFor("pro", "v2"), 18);
  assert.equal(plans.socialAccountLimitFor("basic", null), null);
  assert.equal(plans.youtubeImportsFor("free", null), 10);
  assert.equal(plans.youtubeImportsFor("free", null, "v2"), 5);
  assert.equal(plans.effectivePlanVersion("free", null, false), null);
  assert.equal(plans.effectivePlanVersion("free", null, true), "v2");
  assert.equal(plans.effectivePlanVersion("basic", null, true), null);
});

test("v2 Starter annual allowance refreshes monthly while legacy Starter annual does not", async () => {
  const now = new Date("2026-03-15T00:00:00Z");
  const row = {
    id: "user", tier: "basic", billing_cycle: "yearly", plan_version: "v2",
    minutes_used_this_period: 500, youtube_imports_used_this_period: 200,
    ai_questions_used_this_period: 80, period_started_at: "2026-02-01T00:00:00Z",
    period_ends_at: "2027-01-31T00:00:00Z",
  };
  let updated = false;
  const db = { prepare(sql) { return { bind() { return { async run() {
    assert.match(sql, /tier = 'basic' AND plan_version = 'v2'/);
    updated = true;
    return { meta: { changes: 1 } };
  } }; } }; } };
  const fresh = await periods.maybeResetAllowancePeriod(db, row, now);
  assert.equal(updated, true);
  assert.equal(fresh.minutes_used_this_period, 0);
  assert.equal(fresh.youtube_imports_used_this_period, 0);
  assert.equal(fresh.ai_questions_used_this_period, 0);
  updated = false;
  await periods.maybeResetAllowancePeriod(db, { ...row, plan_version: null }, now);
  assert.equal(updated, false);
});
