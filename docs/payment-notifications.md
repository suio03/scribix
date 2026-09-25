# Payment Discord notifications

Updated 2026-09-25. Deployed in Scribix production; the 2026-09-08 dashboard verification below still describes event subscriptions.

- `lib/payment-notification.ts` is the same contract in Pixfy, Scribix and Muzix. Keep copies synchronized.
- Titles distinguish new subscription, renewal, one-time purchase, subscription change and unknown payment, with success/failure status. No payment/customer/user IDs are displayed.
- Fields: email (Scribix shows the account email followed by the Paddle billing email when they differ), country with billing/account provenance, plan and billing cycle, actual transaction amount, provider; failure adds the provider reason. Missing data is `未知`. No webhook-IP geolocation.
- Paddle uses transaction `origin`. Customer/address API enrichment is bounded and falls back to account email/country. Runtime API keys need `customer.read` and `address.read` to enrich billing data.
- Creem subscription success is emitted only from `subscription.paid`; `checkout.completed` still handles existing access/analytics but emits no duplicate subscription notice. Actual paid transaction and customer transaction history distinguish initial/renewal/same-period changes. Incomplete/unavailable evidence stays unknown. History lookup is bounded to 5 seconds / 500 records. Pixfy currently sells subscriptions only.
- Creem failure events expose the last **paid** transaction, not the failed attempt's amount; never reuse that historical amount. Creem's documented webhook list does not provide a generic first-checkout payment-declined event, so coverage is limited to the failure events the provider supplies.
- Existing event ledgers deduplicate webhook redeliveries. Discord failures/timeouts are logged and do not roll back billing; delivery is best effort, without a durable retry outbox.

## Shared Paddle account

Scribix and Muzix share one Paddle account, so both destinations receive every event. Scribix routes by `custom_data.project` first, then by its configured prices; Muzix prices are listed in `SIBLING_PADDLE_PRICE_PROJECTS` (`lib/paddle-webhook-routing.ts`) and acknowledged silently. Only unrecognized prices produce `unowned_event` alerts, so add new Muzix prices to that map. Effective `subscription.canceled`/`paused` events (refund, dunning or scheduled end) expire the user immediately; events for a replaced subscription are ignored.

## Event subscriptions

Preserve all existing subscribed events and channels; add missing events only:

| Provider / project | Required notification events |
| --- | --- |
| Creem / Pixfy | `subscription.paid`, `subscription.past_due` |
| Paddle / Scribix, Muzix | `transaction.completed`, `transaction.payment_failed` |

Paddle `subscription.past_due` no longer emits a second payment failure notification. Muzix retains its existing access-update behavior for that lifecycle event. `transaction.payment_failed` is enabled.

Production dashboard verification on 2026-09-08 using Chrome `ai-publisher`: Scribix and Muzix destinations are Active, Platform usage, with `transaction.completed`, `transaction.payment_failed` and `subscription.past_due` checked. Pixfy is Enabled in Creem live mode, including `subscription.paid` and `subscription.past_due`; recent paid events show Delivered. All required subscriptions already exist. No settings were changed, no live payment was triggered, and no Discord test message was sent. The API 403 was a configuration-read access restriction, not evidence of missing webhook subscriptions.

## Validation

Run `npm run test:payments` (or `pnpm test:payments`). Tests use mocked network and billing storage: classification, currency units, fallback data, HTTP 400/429, duplicate events, Creem event ordering, failure isolation and Paddle project routing.

2026-09-08: 23 notification tests passed across the three projects. Scribix/Muzix Next builds passed. Pixfy lint, app/Worker types, 10 conversion tests and a clean Worker build passed. Pixfy local-only ignored admin pages still declare Edge runtime, so use a clean tracked-file checkout for Worker builds. Muzix has 64 pre-existing type diagnostics; baseline comparison found zero new diagnostics.
