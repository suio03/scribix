const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, globals = {}, mocks = {}) {
  const filename = path.join(root, file);
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { module, exports: module.exports, Intl, Date, AbortSignal,
    process: { env: {} }, console: { error() {}, info() {} },
    fetch: async () => { throw Error('Unexpected network call'); },
    require(name) {
      if (name in mocks) return mocks[name];
      if (name.startsWith('./')) return load(path.relative(root, path.resolve(path.dirname(filename), name + '.ts')), globals, mocks);
      throw Error(`Unexpected import ${name}`);
    }, ...globals });
  return module.exports;
}
const contract = load('lib/payment-notification.ts');
test('all purchase categories have distinct success/failure titles; IDs never appear', () => {
  const titles = new Set();
  for (const project of ['Pixfy', 'Scribix', 'Muzix']) {
    for (const kind of ['new_subscription', 'renewal', 'one_time', 'subscription_change', 'unknown']) {
      for (const failed of [false, true]) {
        const payload = contract.buildPaymentPayload({ project, provider: 'Paddle', kind, failed, email: 'test@example.com', country: 'AU', countrySource: 'billing', amount: 'USD 0.00', paymentId: 'secret-id' });
        titles.add(payload.embeds[0].title);
        assert.ok(payload.embeds[0].fields.some(f => f.value === 'USD 0.00'));
        assert.ok(payload.embeds[0].fields.some(f => f.value === 'Australia（账单地区）'));
        assert.equal(JSON.stringify(payload).includes('secret-id'), false);
        assert.equal(payload.allowed_mentions.parse.length, 0);
      }
    }
  }
  assert.equal(titles.size, 30);
});
test('currency units, zero, malformed amounts and absent region remain truthful', () => {
  assert.equal(contract.formatMinorAmount('1900', 'USD'), 'USD 19.00');
  assert.equal(contract.formatMinorAmount('1900', 'JPY'), 'JPY 1900');
  assert.equal(contract.formatMinorAmount(0, 'USD'), 'USD 0.00');
  for (const v of [null, undefined, '', 'NaN', -1]) assert.equal(contract.formatMinorAmount(v, 'USD'), '未知');
  const payload = contract.buildPaymentPayload({ project: 'Pixfy', provider: 'Creem', kind: 'renewal', failed: true, country: 'XX' });
  assert.equal(payload.embeds[0].fields[1].value, '未知');
  assert.equal(payload.embeds[0].fields.at(-1).value, '支付平台未提供');
});
test('Discord 400/429 and network failure are reported without rejecting billing', async () => {
  for (const status of [204, 400, 429]) {
    const helper = load('lib/payment-notification.ts', { fetch: async (_url, init) => {
      assert.ok(init.signal); assert.ok(JSON.parse(init.body).embeds); return { ok: status === 204, status };
    } });
    assert.equal(await helper.sendPaymentNotification({ project: 'Pixfy', provider: 'Creem', kind: 'renewal' }, 'https://discord.invalid'), status === 204);
  }
  assert.equal(await contract.sendPaymentNotification({ project: 'Pixfy', provider: 'Creem', kind: 'renewal' }, 'https://discord.invalid'), false);
});
if (fs.existsSync(path.join(root, 'lib/paddle-payment-notification.ts'))) {
  const paddle = load('lib/paddle-payment-notification.ts');
  test('Paddle origin distinguishes initial, recurring, packs and plan changes', () => {
    assert.equal(paddle.paddlePaymentKind('subscription_recurring', true), 'renewal');
    assert.equal(paddle.paddlePaymentKind('api', true), 'new_subscription');
    assert.equal(paddle.paddlePaymentKind('web', false), 'one_time');
    assert.equal(paddle.paddlePaymentKind('subscription_update', true), 'subscription_change');
    assert.equal(paddle.paddlePaymentKind('subscription_payment_method_change', true), 'unknown');
    assert.equal(paddle.paddlePaymentKind(undefined, true), 'unknown');
  });
  test('Paddle enriches customer and billing address, falls back safely on lookup errors', async () => {
    const helper = load('lib/paddle-payment-notification.ts', { fetch: async url => ({ ok: true, json: async () => ({ data: url.includes('/addresses/') ? { country_code: 'AU' } : { email: 'billing@example.com' } }) }) });
    const data = { customer_id: 'ctm_test', address_id: 'add_test', details: { totals: { grand_total: '1200' } }, currency_code: 'USD' };
    const result = await helper.paddlePaymentDetails(data, { email: 'account@example.com', country: 'US' }, { apiKey: 'fake', environment: 'production' });
    assert.equal(result.email, 'billing@example.com'); assert.equal(result.country, 'AU'); assert.equal(result.countrySource, 'billing');
    const fallback = await paddle.paddlePaymentDetails(data, { email: 'account@example.com', country: 'US' }, { apiKey: 'fake' });
    assert.equal(fallback.email, 'account@example.com'); assert.equal(fallback.countrySource, 'account');
    assert.equal(fallback.amount, 'USD 12.00');
  });
  test('failure reason uses most recent attempt, not an earlier decline', () => {
    assert.equal(paddle.paddleFailureReason([{ created_at: '2026-01-02', error_code: 'expired_card' }, { created_at: '2026-01-01', error_code: 'insufficient_funds' }]), '银行卡已过期');
  });
} else {
  const creem = load('lib/creem-payment-notification.ts');
  const first = { id: 'tran_first', subscription: 'sub_test', status: 'paid', created_at: 1000, period_start: 900 };
  const renewal = { ...first, id: 'tran_renew', created_at: 2000, period_start: 1900 };
  test('Creem historical transactions distinguish first payment, renewal and change without arrival-order assumptions', () => {
    assert.equal(creem.classifyCreemPayment(first, [renewal, first], true), 'new_subscription');
    assert.equal(creem.classifyCreemPayment(renewal, [first, renewal], true), 'renewal');
    assert.equal(creem.classifyCreemPayment({ ...renewal, period_start: 900 }, [first], true), 'subscription_change');
    assert.equal(creem.classifyCreemPayment(first, [], false), 'unknown');
    assert.equal(creem.classifyCreemPayment(null, [], true), 'unknown');
  });
  test('Creem failure never displays the previous successful charge as failed amount', async () => {
    const result = await creem.creemPaymentDetails({ id: 'sub_test', last_transaction_id: 'tran_paid', last_transaction: { amount_paid: 1900, currency: 'USD' }, customer: { email: 'test@example.com', country: 'AU' } }, null, true);
    assert.equal(result.amount, '未知'); assert.equal(result.kind, 'renewal');
  });
}
module.exports = { load };

function webhookHarness() {
  const pixfy = fs.existsSync(path.join(root, 'lib/creem-payment-notification.ts'));
  const scribix = fs.existsSync(path.join(root, 'lib/cf.ts'));
  const notices = [], claims = new Set(), writes = [];
  const user = { id: 'user_test', email: 'account@example.com', country: 'AU', tier: 'pro', credits: 100, billing_cycle: 'monthly', customer_id: 'ctm_test', subscription_id: 'sub_test', period_started_at: '2026-08-01', period_ends_at: '2026-09-01' };
  const db = { prepare(sql) { let args = []; return {
    bind(...values) { args = values; return this; },
    async first() { return sql.includes('paddle_checkout_intents') ? { user_id: user.id } : user; },
    async run() {
      if (sql.includes('INSERT OR IGNORE INTO paddle_events')) {
        const inserted = !claims.has(args[0]); claims.add(args[0]); return { meta: { changes: Number(inserted) } };
      }
      writes.push(sql); return { meta: { changes: 1 } };
    },
  }; }, async batch() { writes.push('batch'); return []; } };
  const plan = { tier: 'pro', cycle: 'monthly', priceId: 'pri_test', name: 'Pro', type: 'subscription', credits: 100, isYearly: false };
  const environment = { PADDLE_WEBHOOK_SECRET: 'fake', NEXT_PUBLIC_PADDLE_ENV: 'production', DB: db };
  const mocks = {
    'next/server': { NextResponse: Response }, 'next/headers': { headers: () => new Headers() },
    '@/lib/cf': { cf: async () => environment }, '@/config': { default: { domainName: 'example.invalid' } },
    '@/lib/discord': { discordAlert: async () => {}, sendDiscordAlert: async () => {} },
    '@/lib/payment-notification': { sendPaymentNotification: async notice => { notices.push(notice); return true; } },
    '@/lib/paddle-payment-notification': { ...(!pixfy ? load('lib/paddle-payment-notification.ts') : {}), paddlePaymentDetails: async () => ({ email: user.email, country: user.country, countrySource: 'account', amount: 'USD 19.00' }) },
    '@/lib/creem-payment-notification': { creemPaymentDetails: async (_subscription, account, failed) => ({ kind: 'renewal', email: account?.email, amount: failed ? '未知' : 'USD 19.00' }) },
    '@/lib/paddle': { verifyPaddleWebhookSignature: async () => true, verifyPaddleSignature: async () => true },
    '@/lib/creem': { verifyCreemWebhookSignature: async () => true },
    '@/lib/report-error': { reportError: async () => {} },
    '@/lib/paddle-plans': { findPlanByPriceId: () => plan, findPaddlePlanByPriceId: () => plan },
    '@/lib/creem-plans': { findPlanByProductId: () => plan },
    '@/lib/paddle-webhook-routing': { resolvePaddleEventScope: data => data.custom_data?.project === 'foreign' ? { kind: 'foreign' } : { kind: 'owned', source: 'price', priceIds: ['pri_test'] } },
    '@/lib/server-analytics': { trackServerEvent: async () => {} },
    '@/lib/checkout-analytics': { sanitizeCheckoutProps: data => data },
    '@/lib/plans': { PLANS: { pro: { monthly: {}, yearly: {} } } },
  };
  const route = load(`app/api/webhook/${pixfy ? 'creem' : 'paddle'}/route.ts`, {
    Response, Request, Headers, process: { env: { WORKER_URL: 'https://worker.invalid', NEXT_PUBLIC_PADDLE_ENV: 'production' } },
    fetch: async (url, init = {}) => {
      if (url.includes('/api/payment-events')) {
        const body = JSON.parse(init.body);
        if (url.includes('action=claim')) {
          const status = claims.has(body.eventId) ? 'processed' : 'acquired'; claims.add(body.eventId);
          return Response.json({ status });
        }
        return Response.json({ status: 'processed' });
      }
      if (url.includes('/api/paddle-events')) {
        const body = JSON.parse(init.body); const inserted = !claims.has(body.event_id); claims.add(body.event_id);
        return Response.json({ inserted });
      }
      if (url.includes('/api/user')) {
        if (init.method === 'PUT' || init.method === 'POST') writes.push(JSON.parse(init.body));
        return Response.json({ user });
      }
      if (url.includes('actone.app')) return new Response(null, { status: 204 });
      throw Error(`Unexpected request ${url}`);
    },
  }, mocks);
  async function send(type, id, origin = 'subscription_recurring', foreign = false) {
    const data = {
      id: 'txn_test', origin, customer_id: 'ctm_test', subscription_id: 'sub_test',
      items: [{ price: { id: 'pri_test' } }], custom_data: { userId: user.id, project: foreign ? 'foreign' : scribix ? 'scribix' : 'muzix' },
      billing_period: { starts_at: '2026-09-01T00:00:00Z', ends_at: '2026-10-01T00:00:00Z' },
    };
    const object = { id: 'sub_test', customer: { id: 'cust_test', email: user.email }, product: { id: 'prod_test' }, last_transaction_id: 'tran_test', metadata: { userId: user.id }, order: { id: 'ord_test', amount: 1900, currency: 'USD' } };
    return route.POST(new Request('https://example.invalid/webhook', { method: 'POST', body: JSON.stringify(pixfy ? { id, eventType: type, object } : { event_id: id, event_type: type, data, occurred_at: '2026-09-01T00:00:00Z' }) }));
  }
  return { send, notices, writes, pixfy };
}
test('webhook payment success and failure are deduplicated; failure notification never grants credits', async () => {
  const h = webhookHarness();
  const paid = h.pixfy ? 'subscription.paid' : 'transaction.completed';
  const failed = h.pixfy ? 'subscription.past_due' : 'transaction.payment_failed';
  assert.equal((await h.send(paid, 'evt_paid')).status, 200);
  assert.equal((await h.send(paid, 'evt_paid')).status, 200);
  assert.equal(h.notices.length, 1); assert.equal(h.notices[0].kind, 'renewal');
  const writes = h.writes.length;
  assert.equal((await h.send(failed, 'evt_failed')).status, 200);
  assert.equal((await h.send(failed, 'evt_failed')).status, 200);
  assert.equal(h.notices.length, 2); assert.equal(h.notices[1].failed, true);
  // Scribix also updates the event ledger; none of these writes may touch users.
  assert.ok(h.writes.slice(writes).every(w => typeof w === 'string' && w.includes('paddle_events')));
});
test('Creem checkout cannot double-notify first payment in either delivery order; Paddle ignores foreign projects', async () => {
  for (const reversed of [false, true]) {
    const h = webhookHarness();
    if (h.pixfy) {
      const types = ['checkout.completed', 'subscription.paid']; if (reversed) types.reverse();
      for (const type of types) assert.equal((await h.send(type, `evt_${type}`)).status, 200);
      assert.equal(h.notices.length, 1);
    } else {
      assert.equal((await h.send('transaction.payment_failed', 'evt_foreign', undefined, true)).status, 200);
      assert.equal(h.notices.length, 0); assert.equal(h.writes.length, 0);
    }
  }
});
