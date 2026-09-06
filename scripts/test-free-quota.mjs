import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

function load(path, imports = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const exports = {};
  vm.runInNewContext(outputText, { exports, Intl, require(name) {
    assert.ok(name in imports, `Unexpected import: ${name}`);
    return imports[name];
  } });
  return exports;
}
const plans = load("lib/plans.ts");
const quota = load("lib/quota.ts", {
  "./plans": plans,
  "./quota-period": load("lib/quota-period.ts"),
  "./quota-policy": load("lib/quota-policy.ts"),
});
function database(used = 0) {
  const user = { id: "free-user", tier: "free", billing_cycle: null, minutes_used_this_period: used };
  return { user, prepare(sql) { return { bind(...args) { return {
    async first() { return { ...user }; },
    async run() {
      assert.match(sql, /minutes_used_this_period \+ \?1 <= \?3/);
      const [amount, id, cap] = args;
      assert.equal(id, user.id);
      const changes = user.minutes_used_this_period + amount <= cap ? 1 : 0;
      if (changes) user.minutes_used_this_period += amount;
      return { meta: { changes } };
    },
  }; } }; } };
}
test("Free accepts 60 minutes, then refuses further processing", async () => {
  const db = database();
  const preflight = await quota.checkQuota(db, "free-user", 60, { requireFullEstimate: true });
  assert.equal(preflight.ok, true);
  assert.equal(preflight.capMin, 60);
  const result = await quota.reserveQuota(db, "free-user", 60, { requireFullEstimate: true });
  assert.equal(result.reservedMin, 60);
  assert.equal(db.user.minutes_used_this_period, 60);
  assert.equal((await quota.reserveQuota(db, "free-user", 1)).error, "no_quota");
});
test("61-minute full upload is refused; partial processing stops at 60", async () => {
  const db = database();
  assert.equal((await quota.checkQuota(db, "free-user", 61, { requireFullEstimate: true })).error, "insufficient_quota");
  assert.equal((await quota.reserveQuota(db, "free-user", 61, { requireFullEstimate: true })).error, "insufficient_quota");
  assert.equal(db.user.minutes_used_this_period, 0);
  assert.equal((await quota.reserveQuota(db, "free-user", 61, { allowPartial: true })).reservedMin, 60);
});
test("Existing Free usage stays intact and receives the extra 15 minutes", async () => {
  const db = database(45);
  assert.equal((await quota.checkQuota(db, "free-user", 15, { requireFullEstimate: true })).remainingMin, 15);
  assert.equal((await quota.reserveQuota(db, "free-user", 15, { requireFullEstimate: true })).reservedMin, 15);
  assert.equal(db.user.minutes_used_this_period, 60);
});
test("Creator stays at 2,400 minutes for both billing cycles", () => {
  assert.equal(plans.quotaMinutesFor("pro", "monthly"), 2400);
  assert.equal(plans.quotaMinutesFor("pro", "yearly"), 2400);
});
const { resolvePlanMessages } = load("i18n/plan-messages.ts", { "../lib/plans": plans });
for (const locale of ["en", "de", "es", "fr", "it", "ja"]) {
  test(`${locale} resolves shared quota facts in nested and raw messages`, () => {
    const raw = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8"));
    const before = JSON.stringify(raw);
    const copy = resolvePlanMessages(raw, locale);
    assert.equal(JSON.stringify(raw), before);
    assert.match(copy.VideoHome.hero.ctaNote, /60/);
    assert.match(copy.PricingPage.plans[0].summary, /60/);
    assert.ok(copy.PricingPage.plans[1].summary.includes(new Intl.NumberFormat(locale).format(2400)));
    assert.doesNotMatch(JSON.stringify(copy), /\{(?:freeTrialMinutes|creatorMonthlyMinutes)\}/);
    assert.ok(copy.PricingPage.faqs[0].answer.includes("{freeMinutes, number}"));
  });
}
