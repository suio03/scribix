const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}) {
  const filename = path.join(root, file);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, Date, Response, Object,
    console: { error() {}, info() {}, warn() {} },
    require(name) {
      if (name in mocks) return mocks[name];
      if (name.startsWith('@/lib/')) return load(name.slice(2) + '.ts', mocks);
      throw Error(`Unexpected import ${name}`);
    } });
  return module.exports;
}

const SCRIBIX_PRICE = 'pri_scribix_starter_monthly';
const MUZIX_PRICE = 'pri_01krxwhyrfvyp61ah9nbw6x1vq';
const routing = load('lib/paddle-webhook-routing.ts');
const known = (id) => id === SCRIBIX_PRICE;

test('sibling product prices without project metadata are foreign, not unknown', () => {
  const scope = routing.resolvePaddleEventScope({ items: [{ price: { id: MUZIX_PRICE } }] }, 'scribix', known);
  assert.equal(scope.kind, 'foreign');
  assert.equal(scope.project, 'muzix');
});

test('unregistered prices still alert as unknown; own prices and metadata still win', () => {
  assert.equal(routing.resolvePaddleEventScope({ items: [{ price: { id: 'pri_new' } }] }, 'scribix', known).kind, 'unknown');
  assert.equal(routing.resolvePaddleEventScope({ items: [{ price: { id: SCRIBIX_PRICE } }] }, 'scribix', known).kind, 'owned');
  assert.equal(routing.resolvePaddleEventScope({ custom_data: { project: 'scribix' }, items: [{ price: { id: MUZIX_PRICE } }] }, 'scribix', known).kind, 'owned');
  assert.equal(routing.resolvePaddleEventScope({ custom_data: { project: 'muzix' }, items: [{ price: { id: SCRIBIX_PRICE } }] }, 'scribix', known).kind, 'conflict');
  assert.equal(routing.resolvePaddleEventScope({ items: [{ price: { id: MUZIX_PRICE } }] }, 'muzix', () => false).kind, 'unknown');
});

function fakeDb(user) {
  const writes = [];
  return {
    writes,
    prepare(sql) {
      const statement = { sql, args: [] };
      return {
        bind(...args) { statement.args = args; return this; },
        async first() { return /FROM users/.test(sql) ? user : null; },
        async run() { writes.push(statement); return { meta: { changes: 1 } }; },
      };
    },
    async batch(statements) { writes.push({ sql: 'batch' }); return statements; },
  };
}

function loadRoute(db, alerts, notices = [], billingEmail) {
  return load('app/api/webhook/paddle/route.ts', {
    '@/lib/cf': { cf: async () => ({ DB: db, PADDLE_WEBHOOK_SECRET: 'secret', NEXT_PUBLIC_PADDLE_ENV: 'production' }) },
    '@/lib/discord': { discordAlert: async (kind, payload) => alerts.push({ kind, payload }) },
    '@/lib/paddle': { verifyPaddleSignature: async () => true, getPaddleTransaction: async () => { throw Error('unexpected'); }, paddleEnvironment: (value) => value },
    '@/lib/paddle-plans': { findPaddlePlanByPriceId: (_env, id) => (id === SCRIBIX_PRICE ? { tier: 'basic', cycle: 'monthly', priceId: id, version: 'v1' } : null) },
    '@/lib/payment-notification': { sendPaymentNotification: async (notice) => notices.push(notice) },
    '@/lib/paddle-payment-notification': { paddlePaymentDetails: async () => ({ email: billingEmail }), paddlePaymentKind: () => 'unknown' },
    '@/lib/plans': { PLANS: { free: { minutesPerCycle: 30, youtubeImportsPerCycle: 5 } } },
  });
}

async function post(route, eventType, data) {
  const req = new Request('https://scribix.io/api/webhook/paddle', {
    method: 'POST',
    body: JSON.stringify({ event_id: 'evt_test', event_type: eventType, occurred_at: '2026-09-22T00:00:00Z', data }),
  });
  return (await route.POST(req)).json();
}

const paidUser = {
  id: 'user_1', email: 'user@example.com', country: null, tier: 'basic', billing_cycle: 'monthly',
  customer_id: 'ctm_1', subscription_id: 'sub_1', period_started_at: '2026-09-18 00:00:00', period_ends_at: '2026-10-18 00:00:00',
};
// Shape of an effective cancellation: no current period, future-looking item dates.
const canceledSubscription = {
  id: 'sub_1', status: 'canceled', customer_id: 'ctm_1', custom_data: { project: 'scribix', userId: 'user_1' },
  current_billing_period: null, next_billed_at: null, scheduled_change: null, canceled_at: '2026-09-22T00:00:00Z',
  items: [{ status: 'active', price: { id: SCRIBIX_PRICE }, previously_billed_at: '2026-09-18T00:00:00Z', next_billed_at: null }],
};

test('effective cancellation (refund or dunning) expires the user to free immediately', async () => {
  const db = fakeDb(paidUser);
  const alerts = [];
  const result = await post(loadRoute(db, alerts), 'subscription.canceled', canceledSubscription);
  assert.equal(result.ok, true);
  const update = db.writes.find((w) => /UPDATE users/.test(w.sql));
  assert.match(update.sql, /tier = 'free'/);
  assert.match(update.sql, /subscription_status = 'expired'/);
  assert.deepEqual(alerts.map((a) => a.kind), ['subscription_expired']);
});

test('ended event for a replaced subscription leaves the current plan alone', async () => {
  const db = fakeDb({ ...paidUser, subscription_id: 'sub_2' });
  const alerts = [];
  await post(loadRoute(db, alerts), 'subscription.canceled', canceledSubscription);
  assert.equal(db.writes.some((w) => /UPDATE users/.test(w.sql)), false);
  assert.equal(alerts.length, 0);
});

test('sibling product events are acknowledged without alerts or writes', async () => {
  const db = fakeDb(paidUser);
  const alerts = [];
  const result = await post(loadRoute(db, alerts), 'subscription.updated', {
    id: 'sub_muzix', status: 'active', custom_data: { userId: 'someone' }, items: [{ price: { id: MUZIX_PRICE } }],
  });
  assert.deepEqual(result, { ok: true, ignored: 'foreign' });
  assert.equal(alerts.length, 0);
  assert.equal(db.writes.length, 0);
});

test('payment notice shows the Scribix login beside a different Paddle email', async () => {
  const transaction = {
    id: 'txn_1', status: 'completed', customer_id: 'ctm_1', subscription_id: 'sub_1',
    custom_data: { project: 'scribix', userId: 'user_1' }, items: [{ price: { id: SCRIBIX_PRICE } }],
  };
  for (const [billingEmail, expected] of [
    ['payer@mail.example', 'user@example.com（付款邮箱：payer@mail.example）'],
    ['USER@example.com', 'USER@example.com'],
    [undefined, 'user@example.com'],
  ]) {
    const notices = [];
    await post(loadRoute(fakeDb(paidUser), [], notices, billingEmail), 'transaction.completed', transaction);
    assert.equal(notices[0].email, expected);
  }
});
